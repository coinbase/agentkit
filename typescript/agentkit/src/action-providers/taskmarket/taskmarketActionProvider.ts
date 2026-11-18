import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { z } from "zod";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  CreateTaskmarketTaskSchema,
  GetTaskmarketTaskSchema,
  ListTaskmarketTasksSchema,
} from "./schemas";
import { DEFAULT_MAX_REWARD_USDC, TASKMARKET_BASE_URL } from "./constants";

/**
 * Configuration for the Taskmarket action provider.
 */
export interface TaskmarketActionProviderConfig {
  /** Base URL for the Taskmarket REST API. */
  apiUrl?: string;
  /** Maximum amount of USDC the create action may escrow in one call. */
  maxRewardUsdc?: number;
}

type TaskmarketTask = {
  id?: string;
  description?: string;
  reward?: string;
  netReward?: string;
  status?: string;
  phase?: string;
  mode?: string;
  tags?: string[];
  expiryTime?: string;
  submissionCount?: number;
  awardCount?: number;
};

type TaskmarketListResponse = {
  tasks?: TaskmarketTask[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

/**
 * Convert a whole-USDC amount to the six-decimal base-unit representation
 * required by the Taskmarket API.
 *
 * @param amountUsdc - Amount in whole USDC.
 * @returns Amount in USDC base units.
 */
export function toTaskmarketBaseUnits(amountUsdc: number): string {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("USDC amount must be a positive finite number");
  }

  return String(Math.round(amountUsdc * 1_000_000));
}

/**
 * Convert a Taskmarket base-unit amount to a display amount in USDC.
 *
 * @param baseUnits - Amount in six-decimal USDC base units.
 * @returns Amount in whole USDC, or null when the value is not numeric.
 */
export function fromTaskmarketBaseUnits(baseUnits: unknown): number | null {
  const value =
    typeof baseUnits === "string" || typeof baseUnits === "number" ? Number(baseUnits) : NaN;
  return Number.isFinite(value) ? value / 1_000_000 : null;
}

/**
 * Action provider for discovering and explicitly authorizing Taskmarket work.
 *
 * Read actions are available on every wallet network. Creating a task is
 * restricted to Base mainnet and requires both the explicit `confirm: true`
 * input and the configured per-call escrow limit.
 */
export class TaskmarketActionProvider extends ActionProvider<WalletProvider> {
  private readonly apiUrl: string;
  private readonly maxRewardUsdc: number;

  /**
   * Creates a Taskmarket action provider.
   *
   * @param config - Optional API and escrow guardrail configuration.
   */
  constructor(config: TaskmarketActionProviderConfig = {}) {
    super("taskmarket", []);

    const apiUrl = config.apiUrl ?? TASKMARKET_BASE_URL;
    try {
      new URL(apiUrl);
    } catch {
      throw new Error(`Invalid Taskmarket API URL: ${apiUrl}`);
    }

    const maxRewardUsdc = config.maxRewardUsdc ?? DEFAULT_MAX_REWARD_USDC;
    if (!Number.isFinite(maxRewardUsdc) || maxRewardUsdc <= 0) {
      throw new Error("maxRewardUsdc must be a positive finite number");
    }

    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.maxRewardUsdc = maxRewardUsdc;
  }

  /**
   * Lists Taskmarket tasks using the public, read-only task feed.
   *
   * @param args - Discovery filters and pagination options.
   * @returns A JSON result containing compact task summaries.
   */
  @CreateAction({
    name: "list_tasks",
    description: `Discover work on Taskmarket, the USDC-escrowed task marketplace.
Use this read-only action to find external work before deciding whether to solve it locally or delegate a request. Results include the task id, description, gross and net rewards, deadline, competition mode, and submission counts. The default status is 'open'.`,
    schema: ListTaskmarketTasksSchema,
  })
  async listTasks(args: z.infer<typeof ListTaskmarketTasksSchema>): Promise<string> {
    try {
      const url = new URL(`${this.apiUrl}/api/tasks`);
      url.searchParams.set("status", args.status ?? "open");
      if (args.phase) url.searchParams.set("phase", args.phase);
      if (args.mode) url.searchParams.set("mode", args.mode);
      for (const tag of args.tags ?? []) url.searchParams.append("tags", tag);
      if (args.minRewardUsdc !== undefined) {
        url.searchParams.set("minReward", toTaskmarketBaseUnits(args.minRewardUsdc));
      }
      if (args.maxRewardUsdc !== undefined) {
        url.searchParams.set("maxReward", toTaskmarketBaseUnits(args.maxRewardUsdc));
      }
      if (args.deadlineHours !== undefined) {
        url.searchParams.set("deadlineHours", String(args.deadlineHours));
      }
      if (args.sort) url.searchParams.set("sort", args.sort);
      if (args.limit !== undefined) url.searchParams.set("limit", String(args.limit));
      if (args.cursor) url.searchParams.set("cursor", args.cursor);

      const response = await fetch(url);
      const data = (await response.json()) as TaskmarketListResponse;
      if (!response.ok)
        return this.errorResult(`Taskmarket returned HTTP ${response.status}`, data);

      return JSON.stringify(
        {
          success: true,
          tasks: (data.tasks ?? []).map(task => this.summarizeTask(task)),
          hasMore: data.hasMore ?? false,
          nextCursor: data.nextCursor ?? null,
        },
        null,
        2,
      );
    } catch (error) {
      return this.errorResult("Failed to list Taskmarket tasks", error);
    }
  }

  /**
   * Retrieves one Taskmarket task and its currently available next actions.
   *
   * @param args - The public task id.
   * @returns The task detail as JSON.
   */
  @CreateAction({
    name: "get_task",
    description:
      "Fetch one Taskmarket task by id. Use this after list_tasks to inspect the full specification, escrow state, submission window, and available next actions before doing any work or payment-related operation.",
    schema: GetTaskmarketTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskmarketTaskSchema>): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tasks/${encodeURIComponent(args.taskId)}`);
      const data = (await response.json()) as TaskmarketTask | null;
      if (!response.ok)
        return this.errorResult(`Taskmarket returned HTTP ${response.status}`, data);
      if (data === null) return this.errorResult("Taskmarket task was not found", null);

      return JSON.stringify({ success: true, task: data }, null, 2);
    } catch (error) {
      return this.errorResult("Failed to fetch the Taskmarket task", error);
    }
  }

  /**
   * Creates a Taskmarket task after an explicit confirmation guard.
   *
   * The first call with `confirm: false` is a dry-run and does not contact the
   * paid endpoint. A second call with `confirm: true` pays the requested
   * reward into Taskmarket escrow through x402. The configured maximum reward
   * is enforced before any payment attempt.
   *
   * @param walletProvider - EVM wallet used for the Base mainnet x402 payment.
   * @param args - Task specification and explicit payment confirmation.
   * @returns A JSON result containing either the confirmation preview or task id.
   */
  @CreateAction({
    name: "create_task",
    description: `Create a Taskmarket task with USDC escrow on Base mainnet.
This action has a hard safety gate: call it first with confirm=false to preview the task and payment, then call it again with confirm=true only after the user explicitly approves the exact reward and specification. The provider's configured maximum escrow is enforced before any payment attempt. Never treat confirm=true as permission to spend more than the supplied rewardUsdc.`,
    schema: CreateTaskmarketTaskSchema,
  })
  async createTask(
    walletProvider: WalletProvider,
    args: z.infer<typeof CreateTaskmarketTaskSchema>,
  ): Promise<string> {
    if (!args.confirm) {
      return JSON.stringify(
        {
          status: "confirmation_required",
          message: "No request was sent and no funds were moved.",
          task: this.buildCreatePayload(args),
          rewardUsdc: args.rewardUsdc,
          maxRewardUsdc: this.maxRewardUsdc,
          nextStep: "Repeat with confirm=true only after explicit user approval.",
        },
        null,
        2,
      );
    }

    if (args.rewardUsdc > this.maxRewardUsdc) {
      return this.errorResult(
        `Requested reward ${args.rewardUsdc} USDC exceeds the configured maximum of ${this.maxRewardUsdc} USDC`,
        null,
      );
    }

    if (walletProvider.getNetwork().networkId !== "base-mainnet") {
      return this.errorResult("Taskmarket escrow creation requires an EVM wallet on Base mainnet", {
        networkId: walletProvider.getNetwork().networkId ?? null,
        requiredNetwork: "base-mainnet",
      });
    }

    if (walletProvider.getNetwork().protocolFamily !== "evm") {
      return this.errorResult("Taskmarket escrow creation requires an EVM wallet", null);
    }

    try {
      const evmWalletProvider = walletProvider as EvmWalletProvider;
      const response = await this.createWithX402(evmWalletProvider, this.buildCreatePayload(args));
      const data = await this.parseResponse(response);

      if (!response.ok) {
        return this.errorResult(`Taskmarket create returned HTTP ${response.status}`, data);
      }

      return JSON.stringify(
        {
          success: true,
          taskmarket: data,
          escrow: {
            network: "base-mainnet",
            rewardUsdc: args.rewardUsdc,
            settled: Boolean(response.headers.get("payment-response")),
          },
        },
        null,
        2,
      );
    } catch (error) {
      return this.errorResult("Taskmarket task creation failed", error);
    }
  }

  /**
   * Taskmarket's public discovery and detail endpoints work with every
   * AgentKit wallet network; the paid create action performs its own Base
   * mainnet check.
   *
   * @param _ - Current wallet network.
   * @returns Always true because read-only discovery is network-agnostic.
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Build the API payload for a task creation request.
   *
   * @param args - User-provided task details.
   * @returns Taskmarket create request body.
   */
  private buildCreatePayload(args: z.infer<typeof CreateTaskmarketTaskSchema>) {
    return {
      description: args.description,
      reward: toTaskmarketBaseUnits(args.rewardUsdc),
      duration: args.durationHours,
      mode: args.mode ?? "bounty",
      tags: args.tags ?? [],
      taskVisibility: args.taskVisibility ?? "public",
    };
  }

  /**
   * Create a Taskmarket x402 client bound to an EVM wallet.
   *
   * @param walletProvider - Wallet used to sign the payment authorization.
   * @returns Configured x402 client.
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
    return client;
  }

  /**
   * Send a task creation request through x402.
   *
   * @param walletProvider - Wallet used for payment authorization.
   * @param payload - Taskmarket create request body.
   * @returns The HTTP response from Taskmarket.
   */
  private async createWithX402(
    walletProvider: EvmWalletProvider,
    payload: ReturnType<TaskmarketActionProvider["buildCreatePayload"]>,
  ): Promise<Response> {
    const fetchWithPayment = wrapFetchWithPayment(fetch, this.createX402Client(walletProvider));
    return fetchWithPayment(`${this.apiUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Parse JSON where possible and fall back to text for diagnostics.
   *
   * @param response - HTTP response to parse.
   * @returns Parsed response body.
   */
  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Return a compact task summary for an LLM context.
   *
   * @param task - Raw Taskmarket task.
   * @returns Compact, display-oriented task data.
   */
  private summarizeTask(task: TaskmarketTask) {
    return {
      id: task.id ?? null,
      description: task.description?.slice(0, 2_000) ?? null,
      descriptionTruncated: Boolean(task.description && task.description.length > 2_000),
      rewardUsdc: fromTaskmarketBaseUnits(task.reward),
      netRewardUsdc: fromTaskmarketBaseUnits(task.netReward),
      status: task.status ?? null,
      phase: task.phase ?? null,
      mode: task.mode ?? null,
      tags: task.tags ?? [],
      expiryTime: task.expiryTime ?? null,
      submissionCount: task.submissionCount ?? null,
      awardCount: task.awardCount ?? null,
    };
  }

  /**
   * Format a consistent action error without throwing into the agent loop.
   *
   * @param message - Short error message.
   * @param details - Optional diagnostic value.
   * @returns JSON error result.
   */
  private errorResult(message: string, details: unknown): string {
    return JSON.stringify({ success: false, error: message, details }, null, 2);
  }
}

/**
 * Factory for the Taskmarket action provider.
 *
 * @param config - Optional API and escrow guardrail configuration.
 * @returns A configured Taskmarket action provider.
 */
export const taskmarketActionProvider = (config: TaskmarketActionProviderConfig = {}) =>
  new TaskmarketActionProvider(config);
