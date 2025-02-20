import { z } from "zod";

/**
 * Input schema for listing an NFT on OpenSea.
 */
export const ListNftSchema = z
  .object({
    contractAddress: z.string().describe("The NFT contract address to list"),
    tokenId: z.string().describe("The tokenID of the NFT to list"),
    price: z.number().positive().describe("The price in ETH to list the NFT for"),
    expirationDays: z
      .number()
      .positive()
      .optional()
      .default(90)
      .describe("Number of days the listing should be active for (default: 90)"),
  })
  .strip()
  .describe("Input schema for listing an NFT on OpenSea");
