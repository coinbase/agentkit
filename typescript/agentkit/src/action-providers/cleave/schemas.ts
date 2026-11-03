import { z } from "zod";

const chainId = z
  .union([
    z.literal(1),
    z.literal(10),
    z.literal(56),
    z.literal(137),
    z.literal(8453),
    z.literal(42161),
  ])
  .describe(
    "Chain id: 1 Ethereum, 10 Optimism, 56 BNB Chain, 137 Polygon, 8453 Base, 42161 Arbitrum",
  );

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address format");

const token = z.string().min(1).max(64);

const amount = z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Invalid decimal amount");

const confirmed = z
  .literal(true)
  .describe("Must be true, and set only after the user has seen and confirmed the quote");

/**
 * Input schema for finding a token.
 */
export const CleaveFindTokenSchema = z
  .object({
    chainId: chainId
      .nullable()
      .optional()
      .describe("Chain id to search on; defaults to the wallet's chain"),
    query: z.string().min(1).max(64).describe("A token symbol or contract address"),
  })
  .strip()
  .describe("Instructions for finding a token");

const swapFields = {
  toChainId: chainId
    .nullable()
    .optional()
    .describe("Chain id of the token to receive; defaults to the wallet's chain"),
  sellToken: token.describe("The token to sell: a listed symbol or a contract address"),
  buyToken: token.describe("The token to receive: a listed symbol or a contract address"),
  amount: amount.describe('Amount of sellToken to sell in whole units, such as "25.5"'),
  recipient: address.nullable().optional().describe("Who receives; defaults to the wallet"),
  maxSlippageBps: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .nullable()
    .optional()
    .describe("Slippage limit in basis points, 0 to 5000; defaults to 50"),
};

/**
 * Input schema for planning a swap.
 */
export const CleavePlanSwapSchema = z
  .object(swapFields)
  .strip()
  .describe("Instructions for planning a swap");

/**
 * Input schema for executing a swap.
 */
export const CleaveExecuteSwapSchema = z
  .object({
    requestId: z
      .string()
      .regex(/^[A-Za-z0-9-]{1,64}$/, "Invalid requestId")
      .describe("The requestId of the plan_swap answer the user confirmed"),
    confirmed,
  })
  .strip()
  .describe("Instructions for executing a planned swap");

/**
 * Input schema for tracking a swap or gas order.
 */
export const CleaveTrackSwapSchema = z
  .object({
    chainId: chainId.nullable().optional().describe("Chain id of the sent transaction"),
    txHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash")
      .nullable()
      .optional()
      .describe("Hash of the sent transaction"),
    requestId: z
      .string()
      .min(1)
      .max(79)
      .regex(/^([A-Za-z0-9-]{1,64}|g:[0-9]{1,10}:0x[0-9a-fA-F]{64})$/, "Invalid requestId")
      .nullable()
      .optional()
      .describe("The requestId from execute_swap or buy_gas"),
  })
  .strip()
  .describe("Instructions for tracking a swap or a gas order");

const gasFields = {
  toChainId: chainId
    .nullable()
    .optional()
    .describe("Chain id the native coin is delivered on; defaults to the wallet's chain"),
  amount: amount.describe('USDC to pay, such as "5"'),
  recipient: address
    .nullable()
    .optional()
    .describe("Who receives the native coin; defaults to the wallet"),
  refundTo: address
    .nullable()
    .optional()
    .describe("Where a refund goes on the wallet's chain; defaults to the wallet"),
};

/**
 * Input schema for quoting a gas top-up.
 */
export const CleaveQuoteGasSchema = z
  .object(gasFields)
  .strip()
  .describe("Instructions for quoting a gas top-up");

/**
 * Input schema for buying a gas top-up.
 */
export const CleaveBuyGasSchema = z
  .object({ ...gasFields, confirmed })
  .strip()
  .describe("Instructions for buying a gas top-up");
