import { z } from "zod";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { TASKMARKET_API_BASE_URL, TASKMARKET_PROVIDER_NAME } from "./constants";
import {
  TaskMarketDelegateSchema,
  TaskMarketListTasksSchema,
  TaskMarketTaskSchema,
} from "./schemas";
import type {
  TaskMarketActionProviderConfig,
  TaskMarketCreateTask,
  TaskMarketDelegationPlan,
} from "./types";

type JsonRecord = Record<string, unknown>;

/**
 * TaskMarketActionProvider exposes competitive external work as an AgentKit
 * option while keeping payment and acceptance behind an application-owned
 * authorization boundary.
 */
export class TaskMarketActionProvider extends ActionProvider {
  private readonly apiBaseUrl: string;
  private readonly request: typeof globalThis.fetch;
  private readonly createTaskAdapter?: TaskMarketCreateTask;

  /**
   * Create a provider with public API access and an optional authorized write adapter.
   *
   * @param config - Public API and host-owned write adapter configuration.
   */
  constructor(config: TaskMarketActionProviderConfig = {}) {
    super(TASKMARKET_PROVIDER_NAME, []);
    this.apiBaseUrl = (config.apiBaseUrl ?? TASKMARKET_API_BASE_URL).replace(/\/$/, "");
    this.request = config.fetch ?? globalThis.fetch;
    this.createTaskAdapter = config.createTask;
  }

  /**
   * List open TaskMarket jobs matching optional reward, tag, and deadline filters.
   *
   * @param args - Search filters.
   * @returns A JSON string containing matching jobs.
   */
  @CreateAction({
    name: "list_taskmarket_tasks",
    description:
      "Find open TaskMarket jobs that may be better delegated to external workers. This is read-only and never spends funds.",
    schema: TaskMarketListTasksSchema,
  })
  async listTasks(args: z.infer<typeof TaskMarketListTasksSchema>): Promise<string> {
    const params = new URLSearchParams({
      status: "open",
      limit: String(args.limit),
    });
    if (args.tags?.length) params.set("tags", args.tags.join(","));
    if (args.minRewardUsdc !== undefined) {
      params.set("minReward", String(Math.round(args.minRewardUsdc * 1_000_000)));
    }
    if (args.maxRewardUsdc !== undefined) {
      params.set("maxReward", String(Math.round(args.maxRewardUsdc * 1_000_000)));
    }
    if (args.deadlineHours !== undefined) params.set("deadlineHours", String(args.deadlineHours));

    return this.getJson(`/api/tasks?${params.toString()}`);
  }

  /**
   * Read a TaskMarket job and its current lifecycle state.
   *
   * @param args - The TaskMarket task id.
   * @returns A JSON string containing task details.
   */
  @CreateAction({
    name: "get_taskmarket_task",
    description:
      "Inspect one TaskMarket job, including its reward, deadline, submission window, and lifecycle actions. This is read-only.",
    schema: TaskMarketTaskSchema,
  })
  async getTask(args: z.infer<typeof TaskMarketTaskSchema>): Promise<string> {
    return this.getJson(`/api/tasks/${encodeURIComponent(args.taskId)}`);
  }

  /**
   * List submissions so the host can present them for review.
   *
   * @param args - The TaskMarket task id.
   * @returns A JSON string containing submissions.
   */
  @CreateAction({
    name: "list_taskmarket_submissions",
    description:
      "Track submissions for a TaskMarket job so the host agent can present them for human or policy review. This is read-only.",
    schema: TaskMarketTaskSchema,
  })
  async listSubmissions(args: z.infer<typeof TaskMarketTaskSchema>): Promise<string> {
    return this.getJson(`/api/tasks/${encodeURIComponent(args.taskId)}/submissions`);
  }

  /**
   * Prepare or execute a bounded, explicitly confirmed delegation.
   *
   * @param args - Delegation details, spending cap, and confirmation flag.
   * @returns A JSON string containing a plan or creation result.
   */
  @CreateAction({
    name: "delegate_to_taskmarket",
    description: `Prepare an external-work delegation and, only when confirm=true, call the host application's explicitly authorized TaskMarket payment adapter.
The reward must not exceed maxSpendUsdc. With confirm=false this action only returns a reviewable plan. The provider never receives or exposes private keys and never silently accepts a worker submission.`,
    schema: TaskMarketDelegateSchema,
  })
  async delegate(args: z.infer<typeof TaskMarketDelegateSchema>): Promise<string> {
    if (args.rewardUsdc > args.maxSpendUsdc) {
      return JSON.stringify({
        status: "rejected",
        reason: "reward_exceeds_spending_limit",
        rewardUsdc: args.rewardUsdc,
        maxSpendUsdc: args.maxSpendUsdc,
      });
    }

    const plan: TaskMarketDelegationPlan = {
      description: args.description,
      rewardUsdc: args.rewardUsdc,
      durationHours: args.durationHours,
      ...(args.tags ? { tags: args.tags } : {}),
      maxSpendUsdc: args.maxSpendUsdc,
      requiresExplicitConfirmation: true,
      payment: "TaskMarket escrow in USDC; host adapter owns authorization and signing",
    };

    if (!args.confirm) {
      return JSON.stringify({ status: "awaiting_confirmation", plan });
    }

    if (!this.createTaskAdapter) {
      return JSON.stringify({
        status: "blocked",
        reason: "no_authorized_payment_adapter",
        plan,
        nextStep:
          "Inject createTask when the host has an explicitly authorized signer, spending policy, and TaskMarket payment adapter.",
      });
    }

    const result = await this.createTaskAdapter({
      description: args.description,
      rewardUsdc: args.rewardUsdc,
      durationHours: args.durationHours,
      ...(args.tags ? { tags: args.tags } : {}),
    });
    return JSON.stringify({ status: "created", plan, result });
  }

  /**
   * AgentKit action providers are network-agnostic for TaskMarket reads.
   *
   * @param _ - The selected AgentKit network.
   * @returns Always true because the public TaskMarket API is network-agnostic.
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Fetch and serialize a public TaskMarket API response.
   *
   * @param path - API path relative to the configured TaskMarket base URL.
   * @returns A JSON string containing the response body.
   */
  private async getJson(path: string): Promise<string> {
    const response = await this.request(`${this.apiBaseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    const body = (await response.json()) as unknown;
    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "message" in body
          ? String((body as JsonRecord).message)
          : `TaskMarket request failed with HTTP ${response.status}`;
      throw new Error(message);
    }
    return JSON.stringify(body);
  }
}

export const taskmarketActionProvider = (config: TaskMarketActionProviderConfig = {}) =>
  new TaskMarketActionProvider(config);
