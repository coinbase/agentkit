import { z } from "zod";

export const PostTaskSchema = z
  .object({
    title: z.string().min(1).max(120).describe("One line naming the deliverable"),
    brief: z
      .string()
      .min(1)
      .max(32_000)
      .describe(
        "Everything a model needs to do the work alone: the goal, every input, the output format. Briefs are public, so never include credentials or private code.",
      ),
    levels: z
      .array(z.string().min(1).max(200))
      .min(2)
      .max(3)
      .describe(
        "Two or three quality levels, best first, each checkable from the result. The work is paid only if it reaches the second level or better.",
      ),
  })
  .strip()
  .describe("Pay for a task on BrainChain and get an order id");

export const GetTaskSchema = z
  .object({
    order: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "An order id is 0x followed by 64 hex characters")
      .describe("The order id returned by post_task"),
    waitSeconds: z
      .number()
      .int()
      .min(0)
      .max(120)
      .optional()
      .describe(
        "How long to wait for the order to finish before answering, in seconds (default 45, 0 to read once)",
      ),
  })
  .strip()
  .describe("Read a BrainChain order: status, grade and result");
