import { z } from "zod";

const taskId = z.string().regex(/^[1-9]\d*$/, "Task ID must be a positive integer.");
const azlWei = z.string().regex(/^[1-9]\d*$/, "Amount must be a positive AZL-wei integer.");

export const PostAzzleTaskSchema = z.object({
  taskRegistry: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Task registry must be an address."),
  totalAmountAzlWei: azlWei,
  deadline: z.number().int().positive().describe("Future Unix timestamp."),
});

export const AzzleTaskSchema = z.object({
  taskRegistry: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Task registry must be an address."),
  taskId,
});

export const AzzleTaskAmountSchema = AzzleTaskSchema.extend({
  amountAzlWei: azlWei,
});
