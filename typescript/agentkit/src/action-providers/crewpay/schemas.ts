import { z } from "zod";

/**
 * Input schema for a free CrewPay launch preview.
 */
export const PreviewCrewpayLaunchSchema = z
  .object({
    name: z.string().min(2).max(32).describe("The coin name"),
    ticker: z.string().min(2).max(13).describe("The coin ticker"),
    description: z
      .string()
      .max(204)
      .nullable()
      .optional()
      .describe("Optional coin description, used to match the KOL crew"),
  })
  .describe("Input schema for previewing a CrewPay launch");

/**
 * Input schema for launching a coin on Base through CrewPay.
 */
export const LaunchCoinWithCrewpaySchema = z
  .object({
    name: z.string().min(2).max(32).describe("The coin name"),
    ticker: z.string().min(2).max(13).describe("The coin ticker"),
    description: z
      .string()
      .max(204)
      .nullable()
      .optional()
      .describe("The coin description (max 204 characters)"),
    imageUrl: z.string().url().describe("HTTPS URL of a PNG, JPEG, WebP or GIF image"),
    platform: z
      .enum(["zora", "clanker"])
      .default("zora")
      .describe("Launch venue on Base: `zora` (default) or `clanker`"),
    autoHireSeats: z
      .number()
      .int()
      .min(1)
      .max(8)
      .nullable()
      .optional()
      .describe("Number of KOL seats CrewPay should auto-hire (default 5)"),
  })
  .describe("Input schema for launching a coin with a KOL crew via CrewPay");

/**
 * Input schema for listing this agent key's CrewPay launches.
 */
export const ListCrewpayLaunchesSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .optional()
      .describe("Maximum launches to return (default 20)"),
  })
  .describe("Input schema for listing CrewPay launches");
