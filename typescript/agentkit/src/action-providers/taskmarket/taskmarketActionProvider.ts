import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  CreateTaskmarketTaskSchema,
  GetTaskmarketTaskSchema,
  ListTaskmarketSubmissionsSchema,
  ListTaskmarketTasksSchema,
  PreviewTaskmarketTaskSchema,
} from "./schemas";
import {
  CONFIRMATION_TTL_MS,
  TASKMARKET_NETWORK,
  TaskPreviewPayload,
  issueConfirmationToken,
  normalizePayload,
  validateConfirmationToken,
} from "./confirmation";
import {
  DEFAULT_TASKMARKET_API_BASE,
  FetchTaskmarketApiClient,
  TaskmarketApiClient,
  summarizeTask,
  toUsdc,
} from "./api";
import { SpawnTaskmarketCli, TaskmarketCli } from "./cli";

/**
 * Configuration for the Taskmarket action provider.
 */
export interface TaskmarketActionProviderConfig {
  /**
   * Maximum USDC the provider is allowed to escrow per create. Defaults to 0
   * (creates are blocked until the operator sets a limit).
   */
  maxSpendUsdc?: number;

  /**
   * Public Taskmarket API base. Defaults to https://api.taskmarket.dev/api
   */
  apiBase?: string;

  /**
   * Path to the first-party `taskmarket` CLI used only for authorized creates.
   */
  cliPath?: string;

  /**
   * Injected API client. Tests only.
   */
  apiClient?: TaskmarketApiClient;

  /**
   * Injected CLI runner. Tests only.
   */
  cli?: TaskmarketCli;
}

interface ResolvedConfig {
  maxSpendUsdc: number;
  apiBase: string;
}

const PLATFORM_FEE_BPS = 750;

/**
 * TaskmarketActionProvider lets an AgentKit agent browse Taskmarket work,
 * preview a requester create-flow, and (only after fresh explicit authorization)
 * create a task through the official CLI. It never accepts or rejects submissions.
 */
export class TaskmarketActionProvider extends ActionProvider {
  private readonly config: ResolvedConfig;
  private readonly api: TaskmarketApiClient;
  private readonly cli: TaskmarketCli;
  private lastCreateFingerprint: string | null = null;
  private lastCreateUnknownSettlement = false;

  /**
   * Creates a new TaskmarketActionProvider.
   *
   * @param config - Spend limit, API base, and optional test doubles
   */
  constructor(config: TaskmarketActionProviderConfig = {}) {
    super("taskmarket", []);

    this.config = {
      maxSpendUsdc: config.maxSpendUsdc ?? Number(process.env.TASKMARKET_MAX_SPEND_USDC ?? "0"),
      apiBase: config.apiBase ?? process.env.TASKMARKET_API_BASE ?? DEFAULT_TASKMARKET_API_BASE,
    };
    this.api = config.apiClient ?? new FetchTaskmarketApiClient(this.config.apiBase);
    this.cli = config.cli ?? new SpawnTaskmarketCli({ command: config.cliPath });
  }

  /**
   * Lists live Taskmarket tasks from the public API. Read-only. No spend.
   *
   * @param args - Optional filters
   * @returns JSON string of summarized tasks
   */
  @CreateAction({
    name: "list_taskmarket_tasks",
    description: `
Lists live Taskmarket bounties and other paid work. Read-only. Does not spend funds
and does not require a wallet.

Use this when a user request is better delegated to an external worker market than
solved by more inference. Always show reward, deadline, mode, and the Taskmarket URL.

Taskmarket runs on Base mainnet (chain 8453).`,
    schema: ListTaskmarketTasksSchema,
  })
  async listTasks(args: z.infer<typeof ListTaskmarketTasksSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.set("status", args.status ?? "open");
      params.set("mode", args.mode ?? "ALL");
      params.set("limit", String(args.limit ?? 10));
      if (args.rewardMinUsdc !== undefined) {
        params.set("minReward", String(Math.round(args.rewardMinUsdc * 1_000_000)));
      }
      if (args.tags) {
        params.set("tags", args.tags);
      }

      const payload = (await this.api.getJson(`/tasks?${params.toString()}`)) as {
        tasks?: Record<string, unknown>[];
        data?: { tasks?: Record<string, unknown>[] };
      };
      const tasks = payload.tasks ?? payload.data?.tasks ?? [];
      return JSON.stringify(
        {
          success: true,
          network: TASKMARKET_NETWORK,
          count: tasks.length,
          tasks: tasks.map(summarizeTask),
          note: "Browse only. Creating a task requires preview_taskmarket_task then an explicit authorized create.",
        },
        null,
        2,
      );
    } catch (error) {
      return this.fail("Failed to list Taskmarket tasks", error);
    }
  }

  /**
   * Fetches one Taskmarket task and its live status. Read-only.
   *
   * @param args - Task id
   * @returns JSON string with task details and live status
   */
  @CreateAction({
    name: "get_taskmarket_task",
    description: `
Fetches one Taskmarket task by id and returns live status, reward, deadline,
submission count, and the public URL. Read-only. Does not spend funds.
Never accept or reject work from this action.`,
    schema: GetTaskmarketTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskmarketTaskSchema>): Promise<string> {
    try {
      const payload = (await this.api.getJson(`/tasks/${args.taskId}`)) as
        | Record<string, unknown>
        | { data?: Record<string, unknown> };
      const task = ((payload as { data?: Record<string, unknown> }).data ??
        payload) as Record<string, unknown>;
      return JSON.stringify(
        {
          success: true,
          network: TASKMARKET_NETWORK,
          task: summarizeTask(task),
          status: task.status,
          phase: task.phase,
          submissionCount: task.submissionCount,
          awardCount: task.awardCount,
          primaryAward: task.primaryAward ?? null,
          url: `https://taskmarket.dev/tasks/${args.taskId}`,
        },
        null,
        2,
      );
    } catch (error) {
      return this.fail("Failed to fetch Taskmarket task", error);
    }
  }

  /**
   * Previews a create-task request. Shows every spend field. Does not create or fund.
   *
   * @param args - Proposed task
   * @returns Preview plus a confirmation token
   */
  @CreateAction({
    name: "preview_taskmarket_task",
    description: `
Prepares a Taskmarket requester create-flow WITHOUT spending any funds.

You MUST call this before create_taskmarket_task. Show the user every field:
description, deliverables, gross reward, estimated platform fee, max spend cap,
duration, mode, network (Base, chain 8453), and the confirmation token.

Do not create the task until the user explicitly authorizes the spend.`,
    schema: PreviewTaskmarketTaskSchema,
  })
  async previewTask(args: z.infer<typeof PreviewTaskmarketTaskSchema>): Promise<string> {
    const payload = normalizePayload({
      description: args.description,
      rewardUsdc: args.rewardUsdc,
      durationHours: args.durationHours,
      mode: args.mode ?? "bounty",
      tags: args.tags ?? "",
      deliverables: args.deliverables,
    });

    const spendCheck = this.checkSpend(payload.rewardUsdc);
    if (spendCheck) {
      return spendCheck;
    }

    const feeUsdc = Number(((payload.rewardUsdc * PLATFORM_FEE_BPS) / 10_000).toFixed(6));
    const netToWorkers = Number((payload.rewardUsdc - feeUsdc).toFixed(6));
    const token = issueConfirmationToken(payload);

    return JSON.stringify(
      {
        success: true,
        action: "preview_only",
        fundsMoved: false,
        network: TASKMARKET_NETWORK,
        confirmationToken: token,
        confirmationExpiresInMinutes: CONFIRMATION_TTL_MS / 60_000,
        preview: {
          description: payload.description,
          deliverables: payload.deliverables,
          rewardUsdc: payload.rewardUsdc,
          estimatedPlatformFeeUsdc: feeUsdc,
          estimatedNetToWorkersUsdc: netToWorkers,
          durationHours: payload.durationHours,
          mode: payload.mode,
          tags: payload.tags,
          maxSpendUsdc: this.config.maxSpendUsdc,
          network: "Base",
          chainId: 8453,
        },
        nextSteps: [
          "Show this preview to the user in full.",
          "Do not create the task unless the user explicitly authorizes the spend.",
          "If authorized, call create_taskmarket_task with the SAME fields, this confirmationToken, and iAuthorizeSpend=true.",
        ],
      },
      null,
      2,
    );
  }

  /**
   * Creates a Taskmarket task through the official CLI after preview + explicit authorization.
   *
   * @param args - Exact preview payload plus confirmation
   * @returns Created task id/link or a hard stop if settlement is unknown
   */
  @CreateAction({
    name: "create_taskmarket_task",
    description: `
Creates and funds a Taskmarket task on Base using the official Taskmarket CLI.

HARD RULES:
- Call preview_taskmarket_task first and reuse its confirmationToken.
- iAuthorizeSpend must be true from a fresh, explicit user authorization. Never invent it.
- Reward must be <= the configured maxSpendUsdc.
- Network is Base mainnet only (chain 8453).
- If the CLI times out or settlement is unknown, DO NOT retry. Report the unknown state.
- This action never accepts or rejects worker submissions.`,
    schema: CreateTaskmarketTaskSchema,
  })
  async createTask(args: z.infer<typeof CreateTaskmarketTaskSchema>): Promise<string> {
    if (this.lastCreateUnknownSettlement) {
      return JSON.stringify(
        {
          error: true,
          message: "Refusing to create: a previous create has unknown settlement status.",
          details:
            "The last CLI invocation timed out or returned no exit code. Retrying could double-spend. Inspect the Taskmarket CLI / wallet activity before doing anything else.",
        },
        null,
        2,
      );
    }

    if (args.iAuthorizeSpend !== true) {
      return JSON.stringify(
        {
          error: true,
          message: "Create blocked: missing explicit spend authorization.",
          details:
            "iAuthorizeSpend must be true from a fresh user confirmation. Preview the task and ask the user first.",
        },
        null,
        2,
      );
    }

    const payload: TaskPreviewPayload = normalizePayload({
      description: args.description,
      rewardUsdc: args.rewardUsdc,
      durationHours: args.durationHours,
      mode: args.mode ?? "bounty",
      tags: args.tags ?? "",
      deliverables: args.deliverables,
    });

    const tokenError = validateConfirmationToken(args.confirmationToken, payload);
    if (tokenError) {
      return JSON.stringify({ error: true, message: tokenError }, null, 2);
    }

    const spendCheck = this.checkSpend(payload.rewardUsdc);
    if (spendCheck) {
      return spendCheck;
    }

    const fingerprint = JSON.stringify(payload);
    if (this.lastCreateFingerprint === fingerprint) {
      return JSON.stringify(
        {
          error: true,
          message: "Create blocked: this exact payload was already submitted in this session.",
          details: "Ask the user before creating a different task. Do not blindly retry.",
        },
        null,
        2,
      );
    }

    const cliArgs = [
      "task",
      "create",
      "--description",
      payload.description,
      "--reward",
      String(payload.rewardUsdc),
      "--duration",
      String(payload.durationHours),
      "--mode",
      payload.mode,
    ];
    if (payload.tags) {
      cliArgs.push("--tags", payload.tags);
    }

    const result = await this.cli.run(cliArgs);

    if (result.timedOut || result.exitCode === null) {
      this.lastCreateUnknownSettlement = true;
      return JSON.stringify(
        {
          error: true,
          settlementUnknown: true,
          message: "Create invoked, but settlement status is unknown.",
          details:
            "The official CLI timed out or did not return an exit code. Do not retry. Check wallet activity and `taskmarket inbox` before taking any other spend action.",
          stderr: result.stderr.slice(0, 1000),
          stdout: result.stdout.slice(0, 1000),
        },
        null,
        2,
      );
    }

    if (result.exitCode !== 0) {
      return JSON.stringify(
        {
          error: true,
          settlementUnknown: false,
          message: "Taskmarket CLI refused to create the task.",
          exitCode: result.exitCode,
          stderr: result.stderr.slice(0, 1500),
          stdout: result.stdout.slice(0, 1500),
        },
        null,
        2,
      );
    }

    this.lastCreateFingerprint = fingerprint;
    const created = this.extractCreatedTask(result.stdout);
    return JSON.stringify(
      {
        success: true,
        fundsMoved: true,
        network: TASKMARKET_NETWORK,
        taskId: created.taskId,
        url: created.taskId ? `https://taskmarket.dev/tasks/${created.taskId}` : undefined,
        raw: result.stdout.slice(0, 2000),
        nextSteps: [
          "Return the task id and URL to the user.",
          "Use get_taskmarket_task to retrieve live status.",
          "Use list_taskmarket_submissions to present work for HUMAN review.",
          "Never accept or reject a submission automatically.",
        ],
      },
      null,
      2,
    );
  }

  /**
   * Lists submissions for a task so a human can review them. Never accepts or rejects.
   *
   * @param args - Task id
   * @returns JSON string of submissions for review
   */
  @CreateAction({
    name: "list_taskmarket_submissions",
    description: `
Lists worker submissions for a Taskmarket task so a HUMAN can review them.

This action never accepts, rejects, rates, or pays a submission. Present the
results to the user and stop. Any accept/reject must be done by the user in
the official Taskmarket CLI or UI.`,
    schema: ListTaskmarketSubmissionsSchema,
  })
  async listSubmissions(args: z.infer<typeof ListTaskmarketSubmissionsSchema>): Promise<string> {
    try {
      const payload = await this.api.getJson(`/tasks/${args.taskId}/submissions`);
      const submissions = Array.isArray(payload)
        ? payload
        : ((payload as { data?: unknown }).data ?? payload);

      return JSON.stringify(
        {
          success: true,
          taskId: args.taskId,
          url: `https://taskmarket.dev/tasks/${args.taskId}`,
          reviewOnly: true,
          autoAccept: false,
          autoReject: false,
          submissions,
          instruction:
            "Present these submissions to the user. Do not accept or reject them. The user must review in the official Taskmarket UI or CLI.",
        },
        null,
        2,
      );
    } catch (error) {
      return this.fail("Failed to list Taskmarket submissions", error);
    }
  }

  /**
   * Taskmarket requester flows settle on Base mainnet only.
   *
   * @param network - AgentKit network
   * @returns True for Base mainnet or when network is unset
   */
  supportsNetwork(network: Network): boolean {
    if (!network.networkId && !network.chainId) {
      return true;
    }
    if (network.networkId === TASKMARKET_NETWORK.networkId) {
      return true;
    }
    return String(network.chainId) === String(TASKMARKET_NETWORK.chainId);
  }

  private checkSpend(rewardUsdc: number): string | null {
    if (!Number.isFinite(this.config.maxSpendUsdc) || this.config.maxSpendUsdc <= 0) {
      return JSON.stringify(
        {
          error: true,
          message: "Create blocked: maxSpendUsdc is 0.",
          details:
            "Set TaskmarketActionProvider({ maxSpendUsdc }) or TASKMARKET_MAX_SPEND_USDC before any create. This is a spending limit, not a default reward.",
          maxSpendUsdc: this.config.maxSpendUsdc,
        },
        null,
        2,
      );
    }
    if (rewardUsdc > this.config.maxSpendUsdc) {
      return JSON.stringify(
        {
          error: true,
          message: "Create blocked: reward exceeds maxSpendUsdc.",
          rewardUsdc,
          maxSpendUsdc: this.config.maxSpendUsdc,
          network: TASKMARKET_NETWORK,
        },
        null,
        2,
      );
    }
    return null;
  }

  private extractCreatedTask(stdout: string): { taskId?: string } {
    const hex = stdout.match(/0x[0-9a-fA-F]{64}/);
    if (hex) {
      return { taskId: hex[0] };
    }
    try {
      const parsed = JSON.parse(stdout) as {
        data?: { id?: string; taskId?: string };
        id?: string;
        taskId?: string;
      };
      return { taskId: parsed.data?.id ?? parsed.data?.taskId ?? parsed.id ?? parsed.taskId };
    } catch {
      return {};
    }
  }

  private fail(message: string, error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ error: true, message, details }, null, 2);
  }
}

/**
 * Factory for TaskmarketActionProvider.
 *
 * @param config - Spend limit and optional test doubles
 * @returns Provider instance
 */
export const taskmarketActionProvider = (config: TaskmarketActionProviderConfig = {}) =>
  new TaskmarketActionProvider(config);

export { toUsdc };
