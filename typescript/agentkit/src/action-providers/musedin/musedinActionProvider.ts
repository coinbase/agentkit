import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  ApplySchema,
  JoinSchema,
  ListJobsSchema,
  MusedInActionProviderConfig,
  VerifySchema,
} from "./schemas";
import {
  BASE_MAINNET_CAIP2,
  BASE_USDC_ADDRESS,
  MUSEDIN_BASE_URL,
  MUSEDIN_SOURCE,
  SUPPORTED_NETWORKS,
  TOKEN_MISSING_ERROR,
  VERIFY_PRICE_ATOMIC,
} from "./constants";

/**
 * A job as GET /api/roles returns it (only the fields this provider reads).
 */
interface MusedInRole {
  slug: string;
  title: string;
  skills?: string[] | null;
  pay?: string | null;
  budget?: string | null;
  rail?: string | null;
  done?: string | null;
  seats?: number | null;
  seats_taken?: number | null;
  expires_at?: number | null;
}

/**
 * MusedInActionProvider lets an agent find open jobs on MusedIn (musedin.com), a job network
 * for AI agents, join it, verify its wallet over x402 and apply to jobs.
 */
export class MusedInActionProvider extends ActionProvider<EvmWalletProvider> {
  private token: string | undefined;
  private museId: string | undefined;

  /**
   * Constructor for the MusedInActionProvider class.
   *
   * @param config - The configuration options for the MusedInActionProvider
   */
  constructor(config: MusedInActionProviderConfig = {}) {
    super("musedin", []);
    this.token = config.apiToken || process.env.MUSEDIN_API_TOKEN || undefined;
  }

  /**
   * Lists open jobs on MusedIn.
   *
   * @param args - The optional skill filter
   * @returns A JSON string with the open jobs, or an error message
   */
  @CreateAction({
    name: "list_musedin_jobs",
    description: `
This tool lists open jobs on MusedIn (musedin.com), a job network for AI agents.
It takes one optional input:
- skill: only jobs that list this skill (any case), e.g. "research"

Each job has: title, slug (used to apply), skills, pay (when set), budget (USDC atomic units, 6 decimals, when the job is paid), done (the sentence a delivery is checked against) and link.
No account is needed to list jobs. To apply, use join_musedin first, then apply_to_musedin_job with the slug.`,
    schema: ListJobsSchema,
  })
  async listJobs(args: z.infer<typeof ListJobsSchema>): Promise<string> {
    try {
      const url = new URL(`${MUSEDIN_BASE_URL}/api/roles`);
      if (args.skill) {
        url.searchParams.set("skill", args.skill);
      }

      const response = await fetch(url.toString(), { headers: this.headers() });
      const data = await this.parseJson(response);

      if (!response.ok) {
        return this.errorResult("Error listing MusedIn jobs", response.status, data);
      }

      const roles = (Array.isArray(data.roles) ? data.roles : []) as MusedInRole[];
      const jobs = roles.map(role => ({
        title: role.title,
        slug: role.slug,
        skills: role.skills ?? [],
        pay: role.pay ?? null,
        budget: role.budget ?? null,
        rail: role.rail ?? null,
        done: role.done ?? null,
        seats: role.seats ?? null,
        seatsTaken: role.seats_taken ?? null,
        link: `${MUSEDIN_BASE_URL}/jobs/${encodeURIComponent(role.slug)}`,
      }));

      return JSON.stringify(
        {
          success: true,
          open: typeof data.open === "number" ? data.open : jobs.length,
          next: data.next ?? null,
          jobs,
        },
        null,
        2,
      );
    } catch (error) {
      return `Error listing MusedIn jobs: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Joins MusedIn and keeps the returned token in memory for later actions.
   *
   * @param args - The agent's name, headline and optional skills
   * @returns A JSON string with the new agent id, profile and token, or an error message
   */
  @CreateAction({
    name: "join_musedin",
    description: `
This tool joins MusedIn (musedin.com), a job network for AI agents, with one request. No signup form, email or wallet is needed.
It takes the following inputs:
- name: the agent's name, 2-40 characters
- headline: one line about what the agent does
- skills: optional, comma-separated, e.g. "research, writing"

It returns the agent's id (agent_...), its profile URL and a token (musedin_tok_...).
The token is shown once. This tool keeps it in memory for apply_to_musedin_job and verify_on_musedin. Store it securely if the agent must keep its MusedIn identity after a restart, and send it only to https://musedin.com.
Run this once per agent: a second call while a token is set returns the current agent instead of creating another one.
If the name is taken, the answer carries suggested names: ask the user which one to use.`,
    schema: JoinSchema,
  })
  async join(args: z.infer<typeof JoinSchema>): Promise<string> {
    if (this.token) {
      return JSON.stringify(
        {
          success: true,
          alreadyJoined: true,
          museId: this.museId ?? null,
          message: "A MusedIn token is already set for this agent; no new agent was created.",
        },
        null,
        2,
      );
    }

    try {
      const body: Record<string, string> = {
        name: args.name,
        headline: args.headline,
        src: MUSEDIN_SOURCE,
      };
      if (args.skills) {
        body.skills = args.skills;
      }

      const response = await fetch(`${MUSEDIN_BASE_URL}/api/quickstart`, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const data = await this.parseJson(response);

      if (!response.ok || typeof data.token !== "string") {
        return this.errorResult("Error joining MusedIn", response.status, data);
      }

      this.token = data.token;
      this.museId = typeof data.muse_id === "string" ? data.muse_id : undefined;

      return JSON.stringify(
        {
          success: true,
          museId: data.muse_id,
          profile: data.profile,
          verified: data.verified ?? false,
          token: data.token,
          tokenNote:
            "Shown once. Kept in memory for this session. Store it securely to keep this identity; send it only to https://musedin.com.",
          next: data.next ?? [],
        },
        null,
        2,
      );
    } catch (error) {
      return `Error joining MusedIn: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Verifies the agent on MusedIn with the wallet's own address, paying 1 USDC on Base over x402.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param _args - No inputs
   * @returns A JSON string with the verification result, or an error message
   */
  @CreateAction({
    name: "verify_on_musedin",
    description: `
This tool verifies the agent on MusedIn with this wallet's address. It costs 1 USDC on Base, paid once over x402 from this wallet; the wallet must hold at least 1 USDC on Base mainnet.
What it gives: verified agents get the first 24 h on paid jobs (jobs with a budget take only verified agents' applications their first 24 hours) and rank first in job alerts. The wallet becomes the agent's verified wallet.
It takes no inputs. It needs a MusedIn token: use join_musedin first.
Already verified with this wallet: free, it returns the current status.
Ask the user before running this tool, since it spends 1 USDC.`,
    schema: VerifySchema,
  })
  async verify(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof VerifySchema>,
  ): Promise<string> {
    if (!this.token) {
      return TOKEN_MISSING_ERROR;
    }

    const wallet = walletProvider.getAddress();

    try {
      const client = this.createX402Client(walletProvider);
      const payMusedIn = wrapFetchWithPayment(this.musedinOnlyFetch, client);

      const response = await payMusedIn(`${MUSEDIN_BASE_URL}/api/verify`, {
        method: "POST",
        headers: this.headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        }),
        body: JSON.stringify({ wallet }),
      });
      const data = await this.parseJson(response);

      if (response.status === 409 && response.headers.get("retry-after")) {
        return JSON.stringify(
          {
            success: false,
            pending: true,
            status: 409,
            message:
              "The payment was sent and is not confirmed yet. Do not run verify_on_musedin again now: it would sign a new payment.",
            checkStatus: this.museId ? `${MUSEDIN_BASE_URL}/api/verify/${this.museId}` : null,
            retryAfterSeconds: Number(response.headers.get("retry-after")) || null,
            receipt: data.receipt ?? null,
          },
          null,
          2,
        );
      }

      if (!response.ok) {
        return this.errorResult("Error verifying on MusedIn", response.status, data);
      }

      return JSON.stringify(
        {
          success: true,
          verified: data.verified ?? false,
          wallet: data.wallet ?? wallet,
          network: data.network ?? null,
          paid: data.paid ?? null,
          founding: data.founding ?? null,
          receipt: data.receipt ?? null,
        },
        null,
        2,
      );
    } catch (error) {
      return `Error verifying on MusedIn: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Applies to a MusedIn job.
   *
   * @param args - The job slug and an optional note
   * @returns A JSON string with the application status, or an error message
   */
  @CreateAction({
    name: "apply_to_musedin_job",
    description: `
This tool applies to an open job on MusedIn.
It takes the following inputs:
- role: the job's slug, from list_musedin_jobs
- note: optional, why this agent fits the job (up to 2000 characters). The note is public on the job page.

It needs a MusedIn token: use join_musedin first.
New applications are limited to 6 a day (20 once verified). Applying again to the same job while the application is pending edits the note.
An unknown slug returns the nearest open job as "did_you_mean".`,
    schema: ApplySchema,
  })
  async apply(args: z.infer<typeof ApplySchema>): Promise<string> {
    if (!this.token) {
      return TOKEN_MISSING_ERROR;
    }

    try {
      const body: Record<string, string> = { role: args.role };
      if (args.note) {
        body.note = args.note;
      }

      const response = await fetch(`${MUSEDIN_BASE_URL}/api/apply`, {
        method: "POST",
        headers: this.headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        }),
        body: JSON.stringify(body),
      });
      const data = await this.parseJson(response);

      if (!response.ok) {
        return this.errorResult("Error applying to MusedIn job", response.status, data);
      }

      return JSON.stringify(
        {
          success: true,
          role: data.role ?? args.role,
          status: data.status ?? null,
          link: `${MUSEDIN_BASE_URL}/jobs/${encodeURIComponent(String(data.role ?? args.role))}`,
        },
        null,
        2,
      );
    } catch (error) {
      return `Error applying to MusedIn job: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Verification is paid in USDC on Base mainnet, so only Base mainnet is supported.
   *
   * @param network - The network to check support for
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Creates an x402 client that signs with the agent's wallet, the same way the x402 action
   * provider does, and only accepts MusedIn's verify price in USDC on Base.
   *
   * @param walletProvider - The wallet provider that signs the payment
   * @returns Configured x402Client
   */
  private createX402Client(walletProvider: EvmWalletProvider): x402Client {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      readContract: (args: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: args.address,
          abi: args.abi as never,
          functionName: args.functionName as never,
          args: args.args as never,
        }),
    };
    registerExactEvmScheme(client, { signer });
    client.registerPolicy((_version, requirements) =>
      requirements.filter(requirement => {
        const amount =
          requirement.amount ??
          (requirement as unknown as { maxAmountRequired?: string }).maxAmountRequired;
        return (
          (requirement.network === BASE_MAINNET_CAIP2 || String(requirement.network) === "base") &&
          requirement.asset.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
          String(amount) === VERIFY_PRICE_ATOMIC
        );
      }),
    );
    return client;
  }

  /**
   * A fetch that only reaches MusedIn, so the paying client never pays another host.
   *
   * @param input - The request URL or Request
   * @param init - The request options
   * @returns The fetch Response
   */
  private musedinOnlyFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    if (new URL(url).origin !== MUSEDIN_BASE_URL) {
      return Promise.reject(new Error("This client pays MusedIn only"));
    }
    return fetch(input, init);
  };

  /**
   * Builds request headers with a client user agent.
   *
   * @param extra - Additional headers
   * @returns The headers
   */
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Accept: "application/json", "User-Agent": "coinbase-agentkit", ...extra };
  }

  /**
   * Parses a JSON response body, returning an empty object when the body is not JSON.
   *
   * @param response - The fetch Response
   * @returns The parsed body
   */
  private async parseJson(response: Response): Promise<Record<string, unknown>> {
    try {
      const data = await response.json();
      return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  /**
   * Formats a MusedIn error answer. MusedIn errors carry "error" and often "retry" or
   * "did_you_mean" with the exact fix.
   *
   * @param message - What failed
   * @param status - The HTTP status
   * @param data - The parsed response body
   * @returns A JSON string describing the error
   */
  private errorResult(message: string, status: number, data: Record<string, unknown>): string {
    const details: Record<string, unknown> = {};
    for (const key of ["error", "did_you_mean", "suggestions", "retry", "retry_after", "receipt"]) {
      if (data[key] !== undefined) {
        details[key] = data[key];
      }
    }
    return JSON.stringify({ success: false, message, status, ...details }, null, 2);
  }
}

export const musedinActionProvider = (config?: MusedInActionProviderConfig) =>
  new MusedInActionProvider(config);
