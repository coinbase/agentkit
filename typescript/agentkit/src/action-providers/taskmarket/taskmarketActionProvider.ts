import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { FetchOpenTasksSchema, GetTaskSchema } from "./schemas";
import { TASKMARKET_BASE_URL, TASKMARKET_TASKS_URL } from "./constants";

/** A TaskMarket board task as returned by the public API. */
export interface TaskMarketTask {
  id?: string;
  title?: string;
  description?: string;
  reward?: number;
  status?: string;
  mode?: string;
  submissionCount?: number;
  expiryTime?: string;
  tags?: string[];
  [key: string]: unknown;
}

function asTaskList(payload: unknown): TaskMarketTask[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const list: unknown = record.tasks ?? record.items ?? record.data;
  return Array.isArray(list) ? (list as TaskMarketTask[]) : [];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * TaskMarketActionProvider is an action provider for TaskMarket (api.taskmarket.dev),
 * the XDEV-agent worker marketplace. It lets an agent browse open paid tasks and
 * decide whether a request is better delegated to external workers.
 *
 * Read-only: no API key required; no spend. Write actions (create/submit) require
 * the TASKMARKET_API_KEY secret and are intentionally NOT exposed in this package
 * (operators must explicitly authorize spend).
 */
export class TaskMarketActionProvider extends ActionProvider {
  constructor() {
    super("taskmarket", []);
  }

  /**
   * Fetches open TaskMarket tasks, ranked winnable-first (fewest submissions first).
   *
   * @param args - filter parameters (optional query keyword, min reward, limit)
   * @returns A JSON string of open tasks or an error message
   */
  @CreateAction({
    name: "fetch_open_tasks",
    description: `This tool will fetch open, winnable tasks from the TaskMarket agent-worker
marketplace (api.taskmarket.dev) and rank them by competitiveness (lowest submission
count first).

It takes the following optional inputs:
- query: a keyword to filter tasks by (matched against the description)
- minReward: only tasks with reward >= this value (in MOLT)
- limit: max tasks to return (default 20, max 100)

Returns for each task: id, reward (MOLT), submissionCount, expiryTime, mode,
tags, and a short description. Use this to decide whether delegating a request to
an external worker is cheaper or more reliable than burning inference locally.`,
    schema: FetchOpenTasksSchema,
  })
  async fetchOpenTasks(
    args: z.infer<typeof FetchOpenTasksSchema>,
  ): Promise<string> {
    try {
      const query = new URLSearchParams({ limit: String(args.limit ?? 20) });
      const response = await fetch(`${TASKMARKET_TASKS_URL}?${query}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload: unknown = await response.json();
      let open = asTaskList(payload).filter(
        (task) => task.status === "open" && task.submissionWindowOpen !== false,
      );
      open = open.sort(
        (a, b) => (a.submissionCount ?? 0) - (b.submissionCount ?? 0),
      );

      if (args.query) {
        const needle = args.query.toLowerCase();
        open = open.filter((task) =>
          String(task.description ?? "").toLowerCase().includes(needle),
        );
      }
      if (args.minReward !== undefined) {
        const minReward = args.minReward;
        open = open.filter((task) => (task.reward ?? 0) >= minReward);
      }

      const slim = open.slice(0, args.limit ?? 20).map((task) => ({
        id: String(task.id ?? ""),
        title: task.title,
        reward: task.reward,
        status: task.status,
        mode: task.mode,
        submissionCount: task.submissionCount,
        expiry: task.expiryTime ? task.expiryTime.slice(0, 10) : null,
        tags: task.tags ?? [],
        description: String(task.description ?? "").slice(0, 200),
      }));

      if (slim.length === 0) {
        return "No open TaskMarket tasks match the given filters.";
      }

      return JSON.stringify(slim, null, 2);
    } catch (error: unknown) {
      return `Error fetching TaskMarket tasks: ${errorMessage(error)}`;
    }
  }

  /**
   * Fetches a single TaskMarket task by id.
   *
   * @param args - taskId
   * @returns A JSON string of the task or an error message
   */
  @CreateAction({
    name: "get_task",
    description: `This tool will fetch the full details of a single TaskMarket task by id.
Returns reward, mode, status, tags, description, and submission count.`,
    schema: GetTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskSchema>): Promise<string> {
    try {
      const response = await fetch(`${TASKMARKET_TASKS_URL}/${args.taskId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json: unknown = await response.json();
      return JSON.stringify(json, null, 2);
    } catch (error: unknown) {
      return `Error fetching TaskMarket task: ${errorMessage(error)}`;
    }
  }

  /**
   * Checks if the TaskMarket action provider supports the given network.
   * TaskMarket is network-agnostic (MOLT/off-chain marketplace), so this always returns true.
   *
   * @returns True, as TaskMarket actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

export const taskmarketActionProvider = () => new TaskMarketActionProvider();