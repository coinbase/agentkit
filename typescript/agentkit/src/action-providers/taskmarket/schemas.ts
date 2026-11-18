import { z } from "zod";

const TaskIdSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Task ID must be a 32-byte 0x-prefixed hex value")
  .describe("Taskmarket task ID");

/** Input schema for discovering open Taskmarket work. */
export const TaskMarketListTasksSchema = z
  .object({
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .nullish()
      .transform(value => value ?? "bounty")
      .describe("Optional task mode to filter by"),
    tags: z
      .array(z.string().min(1))
      .max(10)
      .nullish()
      .transform(value => value ?? [])
      .describe("Optional task tags to filter by"),
    minReward: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Minimum reward must be a non-negative USDC amount")
      .nullish()
      .transform(value => value ?? undefined)
      .describe("Optional minimum reward in USDC"),
    deadlineHours: z
      .number()
      .int()
      .positive()
      .max(8760)
      .nullish()
      .transform(value => value ?? undefined)
      .describe("Only return tasks expiring within this many hours"),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .nullish()
      .transform(value => value ?? 20)
      .describe("Maximum number of tasks to return"),
  })
  .strict();

/** Input schema for reading one Taskmarket task. */
export const TaskMarketGetTaskSchema = z
  .object({
    taskId: TaskIdSchema,
  })
  .strict();

/** Input schema for submitting a text artifact to a Taskmarket bounty. */
export const TaskMarketSubmitWorkSchema = z
  .object({
    taskId: TaskIdSchema,
    fileName: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^/\\]+$/, "File name must not contain a path separator")
      .describe("Name of the artifact file to submit"),
    mimeType: z
      .string()
      .min(1)
      .max(100)
      .describe("MIME type of the artifact, for example text/markdown"),
    content: z.string().min(1).max(2_000_000).describe("UTF-8 text content for the artifact"),
    role: z
      .enum(["preview", "source", "final", "attachment"])
      .nullish()
      .transform(value => value ?? "final")
      .describe("Taskmarket artifact role"),
    confirmation: z
      .string()
      .min(1)
      .describe("User-provided confirmation that this publicly visible submission is authorized"),
  })
  .strict();

export { TaskIdSchema };
