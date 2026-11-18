import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { ListTasksSchema, GetTaskSchema, ListSubmissionsSchema, CreateTaskSchema } from "./schemas";
import {
  TASKMARKET_API_BASE,
  TASKMARKET_APP_URL,
  USDC_DECIMALS,
  BASE_CHAIN_ID,
  DEFAULT_MAX_TASK_SPEND_USDC,
  TASKMARKET_CLI,
  TASKMARKET_CLI_TIMEOUT_MS,
  TASKMARKET_TASK_ID_REGEX,
} from "./constants";

const execFileAsync = promisify(execFile);

/**
 * Configuration for the Taskmarket action provider.
 */
interface TaskmarketConfig {
  apiBase: string;
  maxSpendUsdc: number;
  cli: string;
  cliTimeoutMs: number;
}

/**
 * Resolves Taskmarket configuration from environment defaults.
 *
 * @returns The resolved configuration.
 */
function resolveConfig(): TaskmarketConfig {
  return {
    apiBase: TASKMARKET_API_BASE,
    maxSpendUsdc: DEFAULT_MAX_TASK_SPEND_USDC,
    cli: TASKMARKET_CLI,
    cliTimeoutMs: TASKMARKET_CLI_TIMEOUT_MS,
  };
}

/**
 * TaskmarketActionProvider provides actions for discovering, tracking, and
 * creating work on the Taskmarket onchain task marketplace (USDC on Base).
 *
 * Reads (list/get/submissions) call the public Taskmarket REST API and need no
 * wallet or secrets. Creating a task is a funded onchain write: the action
 * computes the exact cost, enforces a hard max-spend cap, requires fresh,
 * explicit user authorization, and delegates the actual USDC escrow to the
 * first-party `taskmarket` CLI (which handles legal acceptance, X402 payment,
 * idempotency and wallet signing) so no private key ever touches the agent.
 */
export class TaskmarketActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: TaskmarketConfig;

  /**
   * Constructs a new TaskmarketActionProvider.
   *
   * @param config - Optional overrides for API base, spend cap, and CLI.
   */
  constructor(config: Partial<TaskmarketConfig> = {}) {
    super("taskmarket", []);
    const defaults = resolveConfig();
    this.config = {
      apiBase: config.apiBase ?? defaults.apiBase,
      maxSpendUsdc: config.maxSpendUsdc ?? defaults.maxSpendUsdc,
      cli: config.cli ?? defaults.cli,
      cliTimeoutMs: config.cliTimeoutMs ?? defaults.cliTimeoutMs,
    };
  }

  /**
   * Lists or browses open Taskmarket tasks.
   *
   * @param args - Optional mode / reward / search / cursor filters.
   * @returns A JSON string of tasks and a pagination cursor.
   */
  @CreateAction({
    name: "list_tasks",
    description: `
This tool lists open (submittable) tasks on the Taskmarket onchain marketplace so an agent can recognize work it would rather delegate to external workers and browse candidate tasks.

It takes the following optional inputs:
- mode: bounty, claim, pitch, benchmark, or auction
- maxRewardUsdc: return only tasks with reward at or below this many whole USDC
- search: return only tasks whose description contains this substring
- cursor: a pagination cursor from a previous call to continue paging

Important notes:
- This is a read-only action; it never spends funds or requires a wallet.
- Only tasks with status=open, phase=active and submissionWindowOpen=true are currently submittable.
- Rewards are reported in whole USDC.
`,
    schema: ListTasksSchema,
  })
  async listTasks(args: z.infer<typeof ListTasksSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.mode) params.set("mode", args.mode);
      if (args.search) params.set("search", args.search);
      if (args.cursor) params.set("cursor", args.cursor);

      const response = await fetch(`${this.config.apiBase}/tasks?${params.toString()}`);
      if (!response.ok) {
        return JSON.stringify({ success: false, error: `HTTP error! status: ${response.status}` });
      }

      const data = (await response.json()) as {
        tasks: Array<Record<string, unknown>>;
        nextCursor?: string | null;
        hasMore?: boolean;
      };
      const tasks = (data.tasks ?? []).map(task => {
        const reward = typeof task.reward === "string" ? task.reward : "0";
        const item: Record<string, unknown> = {
          id: task.id,
          description: String(task.description ?? "").slice(0, 200),
          rewardUsdc: this.fromBaseUnits(reward),
          mode: task.mode,
          status: task.status,
          phase: task.phase,
          submissionWindowOpen: task.submissionWindowOpen,
          submissionCount: task.submissionCount,
          awardCount: task.awardCount,
          expiryTime: task.expiryTime,
        };
        return item;
      });

      const maxReward = args.maxRewardUsdc;
      const filtered = maxReward ? tasks.filter(t => (t.rewardUsdc as number) <= maxReward) : tasks;

      return JSON.stringify({
        success: true,
        count: filtered.length,
        tasks: filtered,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Failed to list tasks: ${error}` });
    }
  }

  /**
   * Fetches the live status of a single Taskmarket task.
   *
   * @param args - The task id.
   * @returns A JSON string with the task's current live status.
   */
  @CreateAction({
    name: "get_task",
    description: `
This tool fetches the current live status of a single Taskmarket task by id, so an agent can track a task it posted or is monitoring.

It takes the following inputs:
- taskId: the 0x-prefixed task id

Returns: status, phase, mode, rewardUsdc, submissionWindowOpen, submissionCount, awardCount, expiryTime, visibility, and the task description.

Important notes:
- This is a read-only action; it never spends funds or requires a wallet.
- Only tasks with status=open, phase=active and submissionWindowOpen=true are currently submittable.
`,
    schema: GetTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskSchema>): Promise<string> {
    try {
      const response = await fetch(
        `${this.config.apiBase}/tasks/${encodeURIComponent(args.taskId)}`,
      );
      if (!response.ok) {
        return JSON.stringify({ success: false, error: `HTTP error! status: ${response.status}` });
      }

      const task = (await response.json()) as Record<string, unknown>;
      return JSON.stringify({
        success: true,
        task: {
          id: task.id,
          description: String(task.description ?? "").slice(0, 500),
          rewardUsdc: typeof task.reward === "string" ? this.fromBaseUnits(task.reward) : undefined,
          mode: task.mode,
          status: task.status,
          phase: task.phase,
          submissionWindowOpen: task.submissionWindowOpen,
          submissionCount: task.submissionCount,
          awardCount: task.awardCount,
          expiryTime: task.expiryTime,
          taskVisibility: task.taskVisibility,
          submissionVisibility: task.submissionVisibility,
          platformFeeBps: task.platformFeeBps,
        },
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Failed to fetch task: ${error}` });
    }
  }

  /**
   * Lists the submissions of a Taskmarket task so they can be presented for
   * human review.
   *
   * @param args - The task id and optional max results.
   * @returns A JSON string of submissions (never auto-accepts or auto-rejects).
   */
  @CreateAction({
    name: "list_submissions",
    description: `
This tool lists the submissions on a Taskmarket task so a requester can review them. It helps present candidates to a human for a decision.

It takes the following inputs:
- taskId: the 0x-prefixed task id
- maxResults: (optional) maximum number of submissions to return, default 50

Important notes:
- This is a read-only action and NEVER accepts or rejects work. All accept/reject decisions must be made by a human using the first-party Taskmarket CLI.
- For tasks with a non-public submissionVisibility, the REST API only returns what the caller is entitled to see; the requester's own signed identity is handled by the official tooling.
`,
    schema: ListSubmissionsSchema,
  })
  async listSubmissions(args: z.infer<typeof ListSubmissionsSchema>): Promise<string> {
    try {
      const limit = Math.min(args.maxResults ?? 50, 200);
      const response = await fetch(
        `${this.config.apiBase}/tasks/${encodeURIComponent(args.taskId)}/submissions`,
      );
      if (!response.ok) {
        return JSON.stringify({ success: false, error: `HTTP error! status: ${response.status}` });
      }

      const submissions = (await response.json()) as Array<Record<string, unknown>>;
      const rows = submissions.slice(0, limit).map(sub => ({
        id: sub.id,
        workerAddress: sub.workerAddress,
        submittedAt: sub.submittedAt,
        rejectedAt: sub.rejectedAt,
        workerAgentId: sub.workerAgentId,
        deliverableHash: sub.deliverableHash,
        status: sub.rejectedAt ? "rejected" : "pending_review",
      }));

      return JSON.stringify({
        success: true,
        count: rows.length,
        total: submissions.length,
        submissions: rows,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Failed to list submissions: ${error}` });
    }
  }

  /**
   * Creates a Taskmarket task as a requester, with explicit user authorization
   * and a hard max-spend cap.
   *
   * The funded write is delegated to the first-party `taskmarket` CLI so legal
   * acceptance, X402 payment, idempotency and wallet signing are handled by
   * official tooling. This action NEVER pays without (1) the wallet being on
   * Base, (2) the exact cost being computed and returned, (3) a fresh, explicit
   * authorization string, and (4) the total staying under the max-spend cap.
   *
   * @param walletProvider - The wallet provider (must be on Base).
   * @param args - The task specification, spend cap, and explicit authorization.
   * @returns A JSON string with the created task id/link, or a refusal reason.
   */
  @CreateAction({
    name: "create_task",
    description: `
This tool creates (and funds) a Taskmarket task as a requester, so an agent can delegate work to external Taskmarket workers on the USDC/Base marketplace.

It takes the following inputs:
- description: the task description shown to workers
- rewardUsdc: the reward offered to the completing worker in whole USDC
- durationHours: how long the task stays open, in hours
- mode: bounty (default), claim, pitch, benchmark, or auction
- taskVisibility: public (default), unlisted, or private
- submissionVisibility: public (default), reveal_all, winner_only, or never
- tags: optional up to 10 tags
- maxSpendUsdc: (optional) hard cap on total spend; defaults to the provider limit
- authorization: the REQUIRED explicit, fresh user authorization. It must contain the exact phrase "I authorize paying <total> USDC" where <total> is the total cost the agent must first surface to the user.

CRITICAL safeguards (enforced in code, not optional):
- The wallet MUST be connected to Base (chain 8453). Creating on any other network is refused.
- The total cost must stay under the max-spend cap. A task that exceeds it is refused.
- Without an exact, explicit authorization string the action REFUSES to create anything.
- The write is delegated to the first-party taskmarket CLI; no private key is requested, stored, logged, or committed.
- If the result is ambiguous (in-flight), the action reports it and NEVER blindly retries the payment.

Example authorization to pass for a 5 USDC task: "I authorize paying 5 USDC"
`,
    schema: CreateTaskSchema,
  })
  async createTask(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateTaskSchema>,
  ): Promise<string> {
    try {
      // 1. Hard network guard: Taskmarket escrows USDC on Base only.
      const network = walletProvider.getNetwork();
      if (network.chainId !== String(BASE_CHAIN_ID)) {
        return JSON.stringify({
          success: false,
          error: `Taskmarket tasks can only be created on Base (chain id ${BASE_CHAIN_ID}); the wallet is on chain id ${network.chainId ?? "unknown"}. Refusing to create.`,
        });
      }

      // 2. Compute the exact total cost (reward in whole USDC; the CLI shows the exact on-chain total).
      const totalUsdc = args.rewardUsdc;

      // 3. Hard max-spend cap.
      const maxSpendUsdc = args.maxSpendUsdc ?? this.config.maxSpendUsdc;
      if (totalUsdc > maxSpendUsdc) {
        return JSON.stringify({
          success: false,
          error: `Refusing to create task: reward ${totalUsdc} USDC exceeds the max-spend cap of ${maxSpendUsdc} USDC. Lower the reward or raise maxSpendUsdc explicitly.`,
        });
      }

      // 4. Fresh, explicit user authorization bound to the exact amount.
      const expectedAuthorization = `I authorize paying ${totalUsdc} USDC`;
      if (!args.authorization.includes(expectedAuthorization)) {
        return JSON.stringify({
          success: false,
          error: `Refusing to create task: no valid explicit authorization. The user must authorize the exact total by including the phrase "${expectedAuthorization}".`,
        });
      }

      // 5. Build a safe argv array (no shell) and delegate the funded write to the first-party CLI.
      const mode = args.mode ?? "bounty";
      const taskVisibility = args.taskVisibility ?? "public";
      const submissionVisibility = args.submissionVisibility ?? "public";
      const tags = args.tags ?? [];

      const cliArgs = [
        "task",
        "create",
        "--description",
        args.description,
        "--reward",
        String(args.rewardUsdc),
        "--duration",
        String(args.durationHours),
        "--mode",
        mode,
        "--task-visibility",
        taskVisibility,
        "--submission-visibility",
        submissionVisibility,
      ];
      if (tags.length > 0) {
        cliArgs.push("--tags", tags.join(","));
      }

      let created = false;
      let output = "";
      let errMessage: string | undefined;
      try {
        const { stdout, stderr } = await execFileAsync(this.config.cli, cliArgs, {
          timeout: this.config.cliTimeoutMs,
          env: { ...process.env },
        });
        output = `${stdout}\n${stderr}`.trim();
        created = true;
      } catch (cliError) {
        // An unknown settlement status must NOT be blindly retried: report it.
        errMessage = cliError instanceof Error ? cliError.message : String(cliError);
      }

      const taskIdMatch = output.match(TASKMARKET_TASK_ID_REGEX);
      const taskId = taskIdMatch ? taskIdMatch[0] : undefined;

      if (created && taskId) {
        return JSON.stringify({
          success: true,
          taskId,
          taskUrl: `${TASKMARKET_APP_URL}/tasks/${taskId}`,
          network: "base:8453",
          totalUsdc,
          authorization: expectedAuthorization,
          note: "Track the task's live status with get_task. If the CLI reported an in-flight/ambiguous result, poll get_task by this id — do not resubmit.",
        });
      }

      // Created but id not parsed from output: surface output verbatim, never guess.
      if (created) {
        return JSON.stringify({
          success: true,
          taskId: undefined,
          rawOutput: output.slice(0, 2000),
          note: "The CLI reported success. Re-run get_task or the CLI to retrieve the task id. Do not resubmit.",
        });
      }

      return JSON.stringify({
        success: false,
        error: `Taskmarket task creation failed: ${errMessage ?? "unknown error"}. If this was an in-flight/ambiguous result, poll the previous task by id instead of re-submitting.`,
        rawOutput: output.slice(0, 2000),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Failed to create task: ${error}` });
    }
  }

  /**
   * Checks if the Taskmarket action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True for EVM networks (writes are Base-gated inside create_task).
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Converts whole USDC to base units (6 decimals) as expected by the API.
   *
   * @param usdc - Whole USDC amount.
   * @returns Base-unit string.
   */
  private toBaseUnits(usdc: number): string {
    return BigInt(Math.round(usdc * 10 ** USDC_DECIMALS)).toString();
  }

  /**
   * Converts base-unit string reward to whole USDC.
   *
   * @param baseUnits - Base-unit reward string from the API.
   * @returns Whole USDC number.
   */
  private fromBaseUnits(baseUnits: string): number {
    return Number(baseUnits) / 10 ** USDC_DECIMALS;
  }
}

export const taskmarketActionProvider = () => new TaskmarketActionProvider();
