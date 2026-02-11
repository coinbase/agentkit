import { z } from "zod";

/**
 * Schema for spraying ETH to multiple recipients.
 */
export const SprayEthSchema = z
  .object({
    recipients: z
      .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"))
      .min(1, "At least one recipient is required")
      .max(200, "Maximum 200 recipients per transaction")
      .describe("Array of recipient wallet addresses (e.g. ['0xABC...', '0xDEF...'])"),
    amountPerRecipient: z
      .string()
      .describe(
        "Amount of ETH to send to each recipient, in whole units (e.g. '0.01' for 0.01 ETH)"
      ),
  })
  .strip()
  .describe("Input schema for spraying ETH to multiple recipients in a single transaction");

/**
 * Schema for spraying ERC-20 tokens to multiple recipients.
 */
export const SprayTokenSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token contract address")
      .describe("The ERC-20 token contract address"),
    recipients: z
      .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"))
      .min(1, "At least one recipient is required")
      .max(200, "Maximum 200 recipients per transaction")
      .describe("Array of recipient wallet addresses"),
    amountPerRecipient: z
      .string()
      .describe(
        "Amount of tokens to send to each recipient, in whole units (e.g. '100' for 100 USDC)"
      ),
  })
  .strip()
  .describe("Input schema for spraying ERC-20 tokens to multiple recipients in a single transaction");

/**
 * Schema for spraying ETH with variable amounts per recipient.
 */
export const SprayEthVariableSchema = z
  .object({
    recipients: z
      .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"))
      .min(1, "At least one recipient is required")
      .max(200, "Maximum 200 recipients per transaction")
      .describe("Array of recipient wallet addresses"),
    amounts: z
      .array(z.string())
      .min(1, "At least one amount is required")
      .describe(
        "Array of ETH amounts corresponding to each recipient, in whole units (e.g. ['0.01', '0.05'])"
      ),
  })
  .strip()
  .describe(
    "Input schema for spraying variable amounts of ETH to multiple recipients in a single transaction"
  );

/**
 * Schema for spraying ERC-20 tokens with variable amounts per recipient.
 */
export const SprayTokenVariableSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token contract address")
      .describe("The ERC-20 token contract address"),
    recipients: z
      .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"))
      .min(1, "At least one recipient is required")
      .max(200, "Maximum 200 recipients per transaction")
      .describe("Array of recipient wallet addresses"),
    amounts: z
      .array(z.string())
      .min(1, "At least one amount is required")
      .describe(
        "Array of token amounts corresponding to each recipient, in whole units (e.g. ['100', '50'])"
      ),
  })
  .strip()
  .describe(
    "Input schema for spraying variable amounts of ERC-20 tokens to multiple recipients in a single transaction"
  );
