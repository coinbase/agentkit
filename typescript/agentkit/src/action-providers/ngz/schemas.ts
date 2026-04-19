import { z } from "zod";

export const GetNGZLeaderboardSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of top users to fetch. Defaults to 10, maximum 50."),
  })
  .strict();

export const GetNGZUserSchema = z
  .object({
    address: z.string().describe("The wallet address of the NGZ user to look up."),
  })
  .strict();

export const GetNGZWallOfShameSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of recent relapses to fetch. Defaults to 10, maximum 50."),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of entries to skip for pagination. Defaults to 0."),
  })
  .strict();

export const CheckInNGZSchema = z.object({}).strict();

export const TipNGZUserSchema = z
  .object({
    recipientAddress: z.string().describe("The wallet address of the NGZ user to tip."),
    amountInEth: z
      .string()
      .describe(
        "The amount of ETH to send as a tip. Must be at least 0.0001 ETH. Example: '0.001'.",
      ),
    message: z
      .string()
      .max(100)
      .default("")
      .describe(
        "Optional public message to include with the tip. Maximum 100 characters. Will be stored onchain.",
      ),
  })
  .strict();
