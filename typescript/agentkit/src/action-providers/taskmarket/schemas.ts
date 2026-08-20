import { z } from "zod";

export const TaskmarketModeSchema = z.enum(["bounty", "claim", "pitch", "benchmark", "auction"]);

export const ListTaskmarketTasksSchema = z.object({
  mode: TaskmarketModeSchema.nullable().describe("Optional Taskmarket task mode"),
  tags: z.array(z.string()).nullable().describe("Optional skill tags"),
  minRewardUsdc: z.number().nonnegative().nullable().describe("Minimum gross reward in USDC"),
  deadlineHours: z.number().positive().nullable().describe("Only tasks expiring within this many hours"),
  limit: z.number().int().min(1).max(100).nullable().transform(value => value ?? 20),
});

export const GetTaskmarketTaskSchema = z.object({
  taskId: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected a 32-byte hex task ID"),
});

export const AnalyzeTaskmarketTaskSchema = GetTaskmarketTaskSchema.extend({
  estimatedHours: z.number().positive().finite(),
  probabilityOfWinning: z.number().min(0).max(1).nullable(),
});

export const SubmitTaskmarketWorkSchema = GetTaskmarketTaskSchema.extend({
  files: z.array(z.string().min(1)).min(1),
  confirmation: z.string().describe('Must exactly equal "SUBMIT TASKMARKET WORK"'),
});

export interface TaskmarketSubmissionRequest {
  taskId: string;
  files: string[];
}

export interface TaskmarketConfig {
  apiUrl?: string;
  allowSubmissions?: boolean;
  submitWork?: (request: TaskmarketSubmissionRequest) => Promise<unknown>;
}

