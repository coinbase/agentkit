import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  AssessRepositorySchema,
  GetJobStatusSchema,
  ListBountiesSchema,
  QuoteMaintenanceSchema,
} from "./schemas";
import { isGithubName, MIZUKI_API_URL, REQUEST_TIMEOUT_MS } from "./constants";

/**
 * MizukiActionProvider is an action provider for Mizuki, a service that fixes an
 * authorized issue in a public GitHub repository for a price fixed before payment.
 *
 * Mizuki returns a pull request that passes the repository's own checks, or refunds
 * the quoted amount. Payment is an exact USDC transfer on Solana mainnet with a
 * sponsored fee payer, so a caller needs USDC but not SOL.
 *
 * These actions cover the read and quote side of that flow. Paying a quote requires a
 * Solana wallet signature over an x402 challenge, which the caller performs with its
 * own signer.
 */
export class MizukiActionProvider extends ActionProvider {
  private readonly apiUrl: string;

  /**
   * Constructor for the MizukiActionProvider class.
   *
   * @param config - Configuration for the provider
   * @param config.apiUrl - Mizuki API base URL, defaulting to the public service
   */
  constructor(config: { apiUrl?: string } = {}) {
    super("mizuki", []);
    this.apiUrl = (config.apiUrl ?? MIZUKI_API_URL).replace(/\/$/, "");
  }

  /**
   * Quotes fixed-price maintenance for one GitHub issue.
   *
   * @param args - The issue to quote
   * @returns A JSON string carrying the quote and its payment requirements, or the refusal
   */
  @CreateAction({
    name: "quote_maintenance",
    description: `This tool quotes fixed-price maintenance for one issue in a public GitHub repository.
It takes the following input:
- The URL of an open GitHub issue

Important notes:
- The price is fixed before payment and pinned to the repository head it was priced against
- The quote is valid for 15 minutes and includes the x402 payment requirements
- Payment is USDC on Solana mainnet with a sponsored fee payer, so the payer needs USDC but not SOL
- The repository must be public and must have authorized Mizuki
- This does not pay for or start any work`,
    schema: QuoteMaintenanceSchema,
  })
  async quoteMaintenance(args: z.infer<typeof QuoteMaintenanceSchema>): Promise<string> {
    try {
      const { status, body } = await this.request("/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ github_issue_url: args.githubIssueUrl }),
      });
      if (status >= 400) {
        return `Mizuki declined to quote this issue: ${JSON.stringify(body)}`;
      }
      return `Mizuki quote:\n${JSON.stringify(body, null, 2)}`;
    } catch (error) {
      return `Error quoting Mizuki maintenance: ${error}`;
    }
  }

  /**
   * Reads the current state of a maintenance job.
   *
   * @param args - The job to read
   * @returns A JSON string carrying the job state, or the failure
   */
  @CreateAction({
    name: "get_job_status",
    description: `This tool reads the current state of a Mizuki maintenance job.
It takes the following input:
- The job identifier returned when the job was submitted

Important notes:
- Reports delivery, pull request, validation, and refund state
- A job that could not be delivered is refunded, and a refund that cannot be broadcast yet stays visible as refund_pending until it settles`,
    schema: GetJobStatusSchema,
  })
  async getJobStatus(args: z.infer<typeof GetJobStatusSchema>): Promise<string> {
    try {
      const { status, body } = await this.request(`/v1/jobs/${encodeURIComponent(args.jobId)}`);
      if (status === 404) return `No Mizuki job found with id ${args.jobId}.`;
      if (status >= 400) return `Could not read that Mizuki job: ${JSON.stringify(body)}`;
      return `Mizuki job:\n${JSON.stringify(body, null, 2)}`;
    } catch (error) {
      return `Error reading Mizuki job status: ${error}`;
    }
  }

  /**
   * Assesses whether a repository qualifies for Mizuki maintenance.
   *
   * @param args - The repository to assess
   * @returns A JSON string carrying the assessment, or the failure
   */
  @CreateAction({
    name: "assess_repository",
    description: `This tool reports whether a public GitHub repository qualifies for Mizuki maintenance, and which command Mizuki would run to validate a change.
It takes the following inputs:
- The GitHub owner or organisation
- The repository name

Important notes:
- Reads the repository's root manifests to detect the validation command
- This is not a quote and reserves nothing
- Use it before quoting to avoid paying for work on a repository Mizuki cannot validate`,
    schema: AssessRepositorySchema,
  })
  async assessRepository(args: z.infer<typeof AssessRepositorySchema>): Promise<string> {
    if (!isGithubName(args.owner) || !isGithubName(args.repo)) {
      return "The owner and repo must be GitHub names.";
    }
    try {
      const { status, body } = await this.request(
        `/x402/assess/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`,
      );
      if (status === 402) {
        return `This assessment is a paid endpoint. Pay the x402 challenge in the payment-required header to read it:\n${JSON.stringify(body, null, 2)}`;
      }
      if (status >= 400) return `Could not assess that repository: ${JSON.stringify(body)}`;
      return `Repository assessment:\n${JSON.stringify(body, null, 2)}`;
    } catch (error) {
      return `Error assessing repository: ${error}`;
    }
  }

  /**
   * Lists open public maintenance bounties.
   *
   * @param _args - No inputs
   * @returns A JSON string carrying the open bounties, or the failure
   */
  @CreateAction({
    name: "list_bounties",
    description: `This tool lists Mizuki's open public maintenance bounties.
It takes no inputs.

Important notes:
- A bounty is opened after an eligible job is fully refunded, so the work is still wanted
- Each bounty carries its claim requirements and funded escrow status`,
    schema: ListBountiesSchema,
  })
  async listBounties(_args: z.infer<typeof ListBountiesSchema>): Promise<string> {
    try {
      const { status, body } = await this.request("/v1/bounties");
      if (status >= 400) return `Could not list Mizuki bounties: ${JSON.stringify(body)}`;
      return `Mizuki bounties:\n${JSON.stringify(body, null, 2)}`;
    } catch (error) {
      return `Error listing Mizuki bounties: ${error}`;
    }
  }

  /**
   * Mizuki reads and quotes over HTTP and is not tied to the agent's own network.
   *
   * @returns Always true
   */
  supportsNetwork(): boolean {
    return true;
  }

  /**
   * Reads JSON from the Mizuki API, returning the parsed body for any status.
   *
   * A refusal carries a reason the agent should relay rather than retry, so the
   * status alone is not the answer.
   *
   * @param path - Path relative to the API base URL
   * @param init - Optional fetch options
   * @returns The response status and parsed body
   */
  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // A non-JSON body from an upstream is a failure to answer, not a verdict.
    }
    return { status: response.status, body };
  }
}

/**
 * Creates a new instance of the Mizuki action provider.
 *
 * @param config - Configuration for the provider
 * @param config.apiUrl - Mizuki API base URL, defaulting to the public service
 * @returns A new Mizuki action provider
 */
export const mizukiActionProvider = (config: { apiUrl?: string } = {}) =>
  new MizukiActionProvider(config);
