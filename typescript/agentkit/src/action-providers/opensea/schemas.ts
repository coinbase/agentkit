import { z } from "zod";

/**
 * Input schema for listing an NFT on OpenSea.
 */
export const ListNftSchema = z
  .object({
    contractAddress: z.string().nonempty().describe("The NFT contract address to list"),
    tokenId: z.string().nonempty().describe("The tokenID of the NFT to list"),
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

/**
 * Input schema for getting NFTs from a specific wallet address.
 */
export const GetNftsByAccountSchema = z
  .object({
    accountAddress: z
      .string()
      .optional()
      .describe(
        "The wallet address to fetch NFTs for (defaults to connected wallet if not provided)",
      ),
  })
  .strip()
  .describe("Input schema for fetching NFTs by account");
