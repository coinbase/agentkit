import { z } from "zod";

/**
 * Input schema for get NFT (ERC721) balance action.
 */
export const GetBalanceSchema = z
  .object({
    contractAddress: z.string().describe("The NFT contract address to check balance for"),
    address: z
      .string()
      .optional()
      .describe(
        "The address to check NFT balance for. If not provided, uses the wallet's default address",
      ),
  })
  .strip()
  .describe("Instructions for getting NFT balance");

/**
 * Input schema for mint NFT (ERC721) action.
 */
export const MintSchema = z
  .object({
    contractAddress: z.string().describe("The contract address of the NFT to mint"),
    destination: z.string().describe("The onchain destination address that will receive the NFT"),
  })
  .strip()
  .describe("Instructions for minting an NFT");

/**
 * Input schema for NFT (ERC721) transfer action.
 */
export const TransferSchema = z
  .object({
    contractAddress: z.string().describe("The NFT contract address to interact with"),
    tokenId: z.string().describe("The ID of the NFT to transfer"),
    destination: z
      .string()
      .describe(
        "The destination to transfer the NFT, e.g. `0x58dBecc0894Ab4C24F98a0e684c989eD07e4e027`, `example.eth`, `example.base.eth`",
      ),
    fromAddress: z
      .string()
      .optional()
      .describe(
        "The address to transfer from. If not provided, defaults to the wallet's default address",
      ),
  })
  .strip()
  .describe("Input schema for transferring an NFT");
