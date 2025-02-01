import { z } from "zod";
import { isAddress } from "viem";

const ethereumAddress = z.custom<`0x${string}`>(
  val => typeof val === "string" && isAddress(val),
  "Invalid address",
);

/**
 * Input schema for buying WOW tokens.
 */
export const WowBuyTokenInput = z
  .object({
    contractAddress: ethereumAddress.describe("The WOW token contract address"),
    amountEthInWei: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount")
      .describe("Amount of ETH to spend (in wei)"),
  })
  .strip()
  .describe("Instructions for buying WOW tokens");

/**
 * Input schema for creating WOW tokens.
 */
export const WowCreateTokenInput = z
  .object({
    name: z.string().min(1).describe("The name of the token to create, e.g. WowCoin"),
    symbol: z.string().min(1).describe("The symbol of the token to create, e.g. WOW"),
    tokenUri: z
      .string()
      .url()
      .optional()
      .describe(
        "The URI of the token metadata to store on IPFS, e.g. ipfs://QmY1GqprFYvojCcUEKgqHeDj9uhZD9jmYGrQTfA9vAE78J",
      ),
  })
  .strip()
  .describe("Instructions for creating a WOW token");

/**
 * Input schema for selling WOW tokens.
 */
export const WowSellTokenInput = z
  .object({
    contractAddress: ethereumAddress.describe(
      "The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    ),
    amountTokensInWei: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount")
      .describe(
        "Amount of tokens to sell (in wei), meaning 1 is 1 wei or 0.000000000000000001 of the token",
      ),
  })
  .strip()
  .describe("Instructions for selling WOW tokens");
