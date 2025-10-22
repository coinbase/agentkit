import { z } from "zod";

export const CreateCoinSchema = z
  .object({
    name: z.string().describe("The name of the coin to create"),
    symbol: z.string().describe("The symbol of the coin to create"),
    description: z.string().describe("The description of the coin"),
    image: z.string().describe("Local image file path or URI (ipfs:// or https://)"),
    category: z
      .string()
      .default("social")
      .describe("The category of the coin, optional, defaults to 'social'"),
    payoutRecipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("The address that will receive creator earnings, defaults to wallet address"),
    platformReferrer: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("The address that will receive platform referrer fees, optional"),
    currency: z
      .enum(["ZORA", "ETH"])
      .default("ZORA")
      .describe("Currency to be used for the trading pair, optional, defaults to 'ZORA'."),
  })
  .strip()
  .describe("Instructions for creating a new coin on Zora");
