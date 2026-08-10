import { z } from "zod";

export const CreateCoinSchema = z
  .object({
    name: z.string().describe("The name of the coin to create"),
    symbol: z.string().describe("The symbol of the coin to create"),
    description: z.string().describe("The description of the coin"),
    image: z
      .string()
      .refine(
        val => val.startsWith("https://") || val.startsWith("ipfs://") || val.startsWith("data:"),
        {
          message:
            "image must be an https:// URL, an ipfs:// URI, or a data: URI. Local file paths are not supported.",
        },
      )
      .describe("Image URI for the coin (ipfs:// or https://)"),
    category: z
      .string()
      .nullable()
      .transform(val => val ?? "social")
      .describe("The category of the coin, optional, defaults to 'social'"),
    payoutRecipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .nullable()
      .describe("The address that will receive creator earnings, defaults to wallet address"),
    platformReferrer: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .nullable()
      .describe("The address that will receive platform referrer fees, optional"),
    currency: z
      .enum(["ZORA", "ETH"])
      .nullable()
      .transform(val => val ?? "ZORA")
      .describe("Currency to be used for the trading pair, optional, defaults to 'ZORA'."),
  })
  .describe("Instructions for creating a new coin on Zora");
