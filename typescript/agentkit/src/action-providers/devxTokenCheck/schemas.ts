import { z } from "zod";
import { SUPPORTED_CHAINS } from "./constants";

export const CheckTokenRiskSchema = z
  .object({
    tokenAddress: z
      .string()
      .describe("Token contract address (0x... on EVM chains, base58 mint address on Solana)"),
    chain: z
      .enum(SUPPORTED_CHAINS)
      .nullable()
      .describe("Chain of the token. Defaults to the wallet's network, else base."),
  })
  .describe("Check a token for rug-pull and honeypot risk");

export const PreSwapTokenCheckSchema = z
  .object({
    tokenAddress: z
      .string()
      .describe("Address of the token you are about to buy or receive in a swap"),
    chain: z
      .enum(SUPPORTED_CHAINS)
      .nullable()
      .describe("Chain of the token. Defaults to the wallet's network, else base."),
  })
  .describe("Decide whether a swap into a token should proceed");
