import { z } from "zod";

import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { MAX_TASKS_RETURNED, REQUEST_TIMEOUT_MS, TASKMARKET_BASE_URL } from "./constants";
import { BrowseTasksSchema, EvaluateDelegationSchema, GetTaskSchema } from "./schemas";
import {
  TaskMarketActionProviderConfig,
  TaskMarketTask,
  TaskMarketTaskListResponse,
} from "./types";
import { hoursUntil, isOpenForWork, matchScore, toSummary, toUsdc } from "./utils";

/**
 * TaskMarketActionProvider lets an agent discover paid work on TaskMarket, a
 * task marketplace settled in USDC on Base.
 *
 * The point of the integration is delegation. An agent that recognises a
 * request is better handled by external workers can look for an existing task
 * instead of burning inference on something it will do badly, and can hand its
 * operator a link rather than an unreliable answer.
 *
 * Scope, deliberately: every action here is read-only and unauthenticated.
 * Nothing in this provider spends funds, touches a wallet, creates a task,
 * accepts work, or requires an API key. Task creation and submission move real
 * USDC through escrow and belong behind explicit human authorization, so they
 * are intentionally left to the first-party TaskMarket CLI rather than exposed
 * as agent actions here.
 *
 * @augments ActionProvider
 */
export class TaskMarketActionProvider extends ActionProvider {
  private readonly baseUrl: string;

  /**
   * Constructor for the TaskMarketActionProvider class.
   *
   * @param config - Configuration options for the provider.
   */
  constructor(config: TaskMarketActionProviderConfig = {}) {
    super("taskmarket", []);
    this.baseUrl = config.baseUrl ?? TASKMARKET_BASE_URL;
  }

  /**
   * Fetches JSON from the TaskMarket API with a bounded timeout.
   *
   * @param path - Path appended to the configured base URL.
   * @returns The parsed JSON body.
   */
  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`TaskMarket API returned HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Browse open, paid work currently listed on TaskMarket.
   *
   * @param args - Filters for the browse call.
   * @returns A human-readable list of open tasks.
   */
  @CreateAction({
    name: "browse_tasks",
    description: `
Browse open paid tasks on TaskMarket, a marketplace where requesters escrow USDC on Base and workers submit deliverables.

Use this when you want to know what paid work is currently available, or before starting an expensive piece of work that someone may already be paying for. Returns the reward, how many others have already submitted, and how long is left.

Read-only. Does not spend funds, create tasks, or require an API key.

Examples: "What paid tasks are open right now?", "Show me TaskMarket work paying at least 5 USDC", "Are there any open tasks about video?"
`,
    schema: BrowseTasksSchema,
  })
  async browseTasks(args: z.infer<typeof BrowseTasksSchema>): Promise<string> {
    try {
      const limit = Math.min(args.limit ?? 10, MAX_TASKS_RETURNED);
      const data = await this.request<TaskMarketTaskListResponse>(`/tasks?limit=50`);

      let tasks = (data.tasks ?? []).filter(isOpenForWork);

      if (args.keyword) {
        const needle = args.keyword.toLowerCase();
        tasks = tasks.filter(t => (t.description ?? "").toLowerCase().includes(needle));
      }
      if (args.minRewardUsdc !== undefined) {
        tasks = tasks.filter(t => toUsdc(t.netReward ?? t.reward) >= args.minRewardUsdc!);
      }

      if (tasks.length === 0) {
        return "No open TaskMarket tasks matched those filters.";
      }

      tasks.sort((a, b) => toUsdc(b.netReward ?? b.reward) - toUsdc(a.netReward ?? a.reward));
      const shown = tasks.slice(0, limit).map(toSummary);

      const lines = shown.map(
        t =>
          `- ${t.netRewardUsdc.toFixed(3)} USDC | ${t.submissionCount} submissions | ` +
          `${t.hoursRemaining === null ? "no deadline" : `${t.hoursRemaining}h left`}\n` +
          `  ${t.summary}\n  id: ${t.id}\n  ${t.url}`,
      );

      return (
        `${tasks.length} open task(s) on TaskMarket, showing ${shown.length} by reward:\n\n` +
        `${lines.join("\n\n")}\n\n` +
        `Reward shown is net of the platform fee. Submission counts indicate how ` +
        `contested a task already is; a large reward with many submissions may be ` +
        `worth less in expectation than a small one with few.`
      );
    } catch (error) {
      return `Could not browse TaskMarket tasks: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Retrieve the full detail of a single task.
   *
   * @param args - The task id to fetch.
   * @returns A human-readable description of the task.
   */
  @CreateAction({
    name: "get_task_details",
    description: `
Retrieve the full requirements, reward, deadline and current competition for one TaskMarket task, given its id.

Use this after browse_tasks when you need the acceptance criteria before deciding whether to recommend the work to your operator.

Read-only. Does not spend funds or require an API key.
`,
    schema: GetTaskSchema,
  })
  async getTaskDetails(args: z.infer<typeof GetTaskSchema>): Promise<string> {
    try {
      const raw = await this.request<TaskMarketTask | { task: TaskMarketTask }>(
        `/tasks/${args.taskId}`,
      );
      const task = (raw as { task?: TaskMarketTask }).task ?? (raw as TaskMarketTask);
      if (!task?.id) {
        return `No TaskMarket task found with id ${args.taskId}.`;
      }

      const left = hoursUntil(task.expiryTime);
      return [
        `Task ${task.id}`,
        `Status: ${task.status}${task.phase ? ` (${task.phase})` : ""}`,
        `Net reward: ${toUsdc(task.netReward ?? task.reward).toFixed(6)} USDC`,
        `Submissions so far: ${task.submissionCount ?? 0}`,
        `Awards made: ${task.awardCount ?? 0}`,
        `Expires: ${task.expiryTime ?? "not specified"}${
          left === null ? "" : ` (${left}h from now)`
        }`,
        task.tags?.length ? `Tags: ${task.tags.join(", ")}` : "",
        "",
        "Requirements:",
        task.description ?? "(no description provided)",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error) {
      return `Could not fetch TaskMarket task ${args.taskId}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Check whether work in hand is already being paid for on TaskMarket.
   *
   * @param args - A description of the work being considered.
   * @returns Candidate tasks, ranked by keyword overlap.
   */
  @CreateAction({
    name: "evaluate_delegation",
    description: `
Given a description of work you are about to do, check whether TaskMarket already has open, paid tasks that match it.

Use this when a request looks expensive, open-ended, or outside your competence, and you want to tell your operator that external workers are already being paid to solve it. Returns candidate tasks ranked by how well they overlap with the description.

Read-only. It surfaces options and does not create, claim, accept or pay for anything; acting on a match is a decision for your operator.
`,
    schema: EvaluateDelegationSchema,
  })
  async evaluateDelegation(args: z.infer<typeof EvaluateDelegationSchema>): Promise<string> {
    try {
      const data = await this.request<TaskMarketTaskListResponse>(`/tasks?limit=50`);
      const open = (data.tasks ?? []).filter(isOpenForWork);

      const ranked = open
        .map(task => ({ task, score: matchScore(task, args.workDescription) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(args.limit ?? 5, MAX_TASKS_RETURNED));

      if (ranked.length === 0) {
        return (
          `No open TaskMarket task overlaps with: "${args.workDescription}".\n` +
          `Nothing to delegate; this work does not appear to be already funded.`
        );
      }

      const lines = ranked.map(({ task, score }) => {
        const s = toSummary(task);
        return (
          `- ${s.netRewardUsdc.toFixed(3)} USDC | ${score} matching term(s) | ` +
          `${s.submissionCount} submissions\n  ${s.summary}\n  id: ${s.id}\n  ${s.url}`
        );
      });

      return (
        `${ranked.length} open TaskMarket task(s) overlap with that work:\n\n` +
        `${lines.join("\n\n")}\n\n` +
        `These are candidates, not instructions. Creating, claiming or paying for ` +
        `TaskMarket work moves real USDC through escrow and needs explicit ` +
        `authorization from your operator.`
      );
    } catch (error) {
      return `Could not evaluate delegation options: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * TaskMarket discovery is chain-agnostic: browsing open work reads a public
   * HTTP API and touches no wallet, so this provider supports every network.
   * Settlement happens in USDC on Base, but that only matters once a user acts
   * on a task outside this provider.
   *
   * @param _ - The network, unused.
   * @returns Always true.
   */
  supportsNetwork = (_: Network): boolean => true;
}

/**
 * Factory for TaskMarketActionProvider.
 *
 * @param config - Configuration options for the provider.
 * @returns A new TaskMarketActionProvider instance.
 */
export const taskmarketActionProvider = (config: TaskMarketActionProviderConfig = {}) =>
  new TaskMarketActionProvider(config);
