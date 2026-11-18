import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  AnalyzeTaskmarketTaskSchema,
  GetTaskmarketTaskSchema,
  ListTaskmarketTasksSchema,
  SubmitTaskmarketWorkSchema,
  TaskmarketConfig,
} from "./schemas";

const DEFAULT_API_URL = "https://api.taskmarket.dev";
const SUBMISSION_CONFIRMATION = "SUBMIT TASKMARKET WORK";

type TaskmarketTask = {
  id: string;
  reward: string;
  netReward?: string | null;
  platformFeeBps: number;
  submissionCount?: number;
  status: string;
  phase: string;
  submissionWindowOpen: boolean;
  pendingActions?: Array<{ action: string; actor: string; requiresPayment?: boolean }>;
};

/** Provides guarded Taskmarket discovery, analysis, and submission actions. */
export class TaskmarketActionProvider extends ActionProvider {
  private readonly apiUrl: string;
  private readonly allowSubmissions: boolean;
  private readonly submitWork?: TaskmarketConfig["submitWork"];

  constructor(config: TaskmarketConfig = {}) {
    super("taskmarket", []);
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.allowSubmissions = config.allowSubmissions ?? false;
    this.submitWork = config.submitWork;
  }

  @CreateAction({
    name: "list_tasks",
    description: "List open Taskmarket work opportunities. This is read-only and never spends funds.",
    schema: ListTaskmarketTasksSchema,
  })
  async listTasks(args: z.infer<typeof ListTaskmarketTasksSchema>): Promise<string> {
    const params = new URLSearchParams({ status: "open", limit: String(args.limit) });
    if (args.mode) params.set("mode", args.mode);
    if (args.tags?.length) params.set("tags", args.tags.join(","));
    if (args.minRewardUsdc !== null) {
      params.set("minReward", String(Math.round(args.minRewardUsdc * 1_000_000)));
    }
    if (args.deadlineHours !== null) params.set("deadlineHours", String(args.deadlineHours));
    return this.get(`/api/tasks?${params.toString()}`, "Failed to list Taskmarket tasks");
  }

  @CreateAction({
    name: "get_task",
    description: "Inspect current Taskmarket task terms and pending actions before doing work.",
    schema: GetTaskmarketTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskmarketTaskSchema>): Promise<string> {
    return this.get(`/api/tasks/${args.taskId}`, "Failed to fetch Taskmarket task");
  }

  @CreateAction({
    name: "analyze_task_economics",
    description: "Calculate net reward, competition-adjusted expected value, and expected hourly value. Read-only; estimates are not guarantees.",
    schema: AnalyzeTaskmarketTaskSchema,
  })
  async analyzeTaskEconomics(args: z.infer<typeof AnalyzeTaskmarketTaskSchema>): Promise<string> {
    try {
      const task = await this.fetchTask(args.taskId);
      const grossRewardUsdc = Number(task.reward) / 1_000_000;
      const netRewardUsdc = task.netReward
        ? Number(task.netReward) / 1_000_000
        : grossRewardUsdc * (1 - task.platformFeeBps / 10_000);
      const submissions = task.submissionCount ?? 0;
      const probability = args.probabilityOfWinning ?? 1 / (submissions + 1);
      const expectedValueUsdc = netRewardUsdc * probability;
      return JSON.stringify({
        taskId: task.id,
        grossRewardUsdc,
        netRewardUsdc,
        existingSubmissions: submissions,
        probabilityOfWinning: probability,
        expectedValueUsdc,
        expectedHourlyUsdc: expectedValueUsdc / args.estimatedHours,
        caveat: "Competition-adjusted expected value is an estimate, not guaranteed income.",
      }, null, 2);
    } catch (error) {
      return this.error("Failed to analyze Taskmarket task", error);
    }
  }

  @CreateAction({
    name: "submit_work",
    description: `Submit prepared files to an open Taskmarket task. Disabled by default. Never call without the user's explicit, task-specific approval and the exact confirmation phrase "${SUBMISSION_CONFIRMATION}".`,
    schema: SubmitTaskmarketWorkSchema,
  })
  async submit(args: z.infer<typeof SubmitTaskmarketWorkSchema>): Promise<string> {
    if (!this.allowSubmissions || !this.submitWork) {
      return JSON.stringify({ error: true, message: "Taskmarket submissions are disabled by host configuration." });
    }
    if (args.confirmation !== SUBMISSION_CONFIRMATION) {
      return JSON.stringify({ error: true, message: `Explicit confirmation required: ${SUBMISSION_CONFIRMATION}` });
    }
    try {
      const task = await this.fetchTask(args.taskId);
      const canSubmit = task.status === "open" && task.submissionWindowOpen &&
        task.pendingActions?.some(action => action.action === "submit" && action.actor === "worker" && !action.requiresPayment);
      if (!canSubmit) return JSON.stringify({ error: true, message: "Task is not currently eligible for a free worker submission." });
      const result = await this.submitWork({ taskId: args.taskId, files: args.files });
      return JSON.stringify({ success: true, taskId: args.taskId, result }, null, 2);
    } catch (error) {
      return this.error("Failed to submit Taskmarket work", error);
    }
  }

  supportsNetwork(): boolean { return true; }

  private async fetchTask(taskId: string): Promise<TaskmarketTask> {
    const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<TaskmarketTask>;
  }

  private async get(path: string, message: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return JSON.stringify(await response.json(), null, 2);
    } catch (error) { return this.error(message, error); }
  }

  private error(message: string, error: unknown): string {
    return JSON.stringify({ error: true, message, details: error instanceof Error ? error.message : String(error) }, null, 2);
  }
}

export const taskmarketActionProvider = (config?: TaskmarketConfig) => new TaskmarketActionProvider(config);

