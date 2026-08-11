import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  DiscoverTaskMarketTasksSchema,
  GetTaskMarketTaskSchema,
  type DiscoverTaskMarketTasks,
} from "./schemas";

const TASKMARKET_API_URL =
  process.env.TASKMARKET_API_URL?.replace(/\/$/, "") ?? "https://api.taskmarket.dev";

type TaskRecord = {
  id?: string;
  description?: string;
  title?: string;
  reward?: string | number;
  netReward?: string | number;
  status?: string;
  mode?: string;
  expiryTime?: string;
  createdAt?: string;
  tags?: string[];
  escrowTxHash?: string | null;
  submissionCount?: number;
  awardCount?: number;
  [key: string]: unknown;
};

function asUsdc(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric / 1_000_000 : null;
}

function taskText(task: TaskRecord): string {
  return [task.title, task.description, ...(task.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
}

function summarizeTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title ?? task.description?.split("\n").find(Boolean)?.replace(/^#\s*/, ""),
    description: task.description,
    rewardUsdc: asUsdc(task.reward),
    netRewardUsdc: asUsdc(task.netReward),
    status: task.status,
    mode: task.mode,
    expiryTime: task.expiryTime,
    createdAt: task.createdAt,
    tags: task.tags ?? [],
    escrowTxHash: task.escrowTxHash ?? null,
    submissionCount: task.submissionCount ?? 0,
    awardCount: task.awardCount ?? 0,
  };
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${TASKMARKET_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`TaskMarket API returned HTTP ${response.status}`);
  }
  return response.json();
}

function asTaskRecords(value: unknown): TaskRecord[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { tasks?: unknown }).tasks)
      ? (value as { tasks: unknown[] }).tasks
      : null;
  if (!records || !records.every(record => record && typeof record === "object")) {
    throw new Error("TaskMarket API returned an unexpected task list");
  }
  return records as TaskRecord[];
}

/** Read-only discovery actions for the TaskMarket agent-work marketplace. */
export class TaskMarketActionProvider extends ActionProvider {
  constructor() {
    super("taskmarket", []);
  }

  @CreateAction({
    name: "discover_tasks",
    description: `
Discover open tasks on TaskMarket, an escrowed USDC marketplace on Base.

This action is read-only: it never creates, claims, bids on, submits, or accepts work and never spends wallet funds. Use it to find work that may be better delegated to an external worker. Results include the task ID, gross/net reward, expiry, escrow transaction, competition counts, and tags. Optionally filter by keyword, maximum gross reward, and result limit.
`,
    schema: DiscoverTaskMarketTasksSchema,
  })
  async discoverTasks(args: z.infer<typeof DiscoverTaskMarketTasksSchema>): Promise<string> {
    try {
      const options: DiscoverTaskMarketTasks = {
        keyword: args.keyword ?? null,
        maxRewardUsdc: args.maxRewardUsdc ?? null,
        limit: args.limit ?? 20,
      };
      const tasks = asTaskRecords(
        await getJson(`/api/tasks?status=open&limit=${options.limit}`),
      ).filter(task => {
        const reward = asUsdc(task.reward);
        return (
          (!options.keyword || taskText(task).includes(options.keyword.toLowerCase())) &&
          (options.maxRewardUsdc === null || (reward !== null && reward <= options.maxRewardUsdc))
        );
      });

      return JSON.stringify(
        {
          success: true,
          readOnly: true,
          network: "Base",
          totalReturned: tasks.length,
          tasks: tasks.map(summarizeTask),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error discovering TaskMarket tasks: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  @CreateAction({
    name: "get_task",
    description: `
Fetch the complete public record for one exact TaskMarket task by its 0x-prefixed 32-byte ID.

This action is read-only and does not claim the task, submit work, sign a transaction, or spend funds. Inspect the record before any separately authorized marketplace action.
`,
    schema: GetTaskMarketTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskMarketTaskSchema>): Promise<string> {
    try {
      const task = await getJson(`/api/tasks/${args.taskId}`);
      if (!task || typeof task !== "object") throw new Error("TaskMarket returned an invalid task");
      return JSON.stringify({ success: true, readOnly: true, task }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error fetching TaskMarket task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  supportsNetwork(): boolean {
    return true;
  }
}

export const taskMarketActionProvider = () => new TaskMarketActionProvider();
