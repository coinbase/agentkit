import { z } from "zod";

  const ethAddress = z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid 0x Ethereum address");

  export const SendUsdcSchema = z.object({
    to: ethAddress.describe("Recipient address on Base Mainnet"),
    amount: z
      .string()
      .describe(
        'Amount of USDC to send, as a human-readable decimal (e.g. "10.5" for 10.5 USDC)',
      ),
  });

  export const SendUsdcGaslessSchema = z.object({
    to: ethAddress.describe("Recipient address on Base Mainnet"),
    amount: z
      .string()
      .describe(
        'Amount of USDC to send gaslessly via EIP-3009, as a decimal (e.g. "5" for 5 USDC). ' +
          "The BasePay relay pays the ETH gas — the agent wallet needs no ETH for this action.",
      ),
  });

  export const BatchPayUsdcSchema = z.object({
    recipients: z
      .array(
        z.object({
          address: ethAddress.describe("Recipient wallet address"),
          amount: z
            .string()
            .describe('USDC amount for this recipient (e.g. "10.5")'),
        }),
      )
      .min(1)
      .max(200)
      .describe("List of recipient address and USDC amount pairs (max 200 entries)."),
    memo: z
      .string()
      .max(64)
      .default("")
      .describe("Optional note recorded on-chain with the batch payment"),
  });

  export const CreateEscrowSchema = z.object({
    payee: ethAddress.describe(
      "Address of the escrow beneficiary who can claim the USDC after the lock period expires",
    ),
    amount: z
      .string()
      .describe('Amount of USDC to lock in escrow (e.g. "100" for 100 USDC)'),
    unlockAfterSeconds: z
      .number()
      .int()
      .min(60)
      .describe(
        "Seconds until the payee can claim, or the payer can reclaim. " +
          "Examples: 86400 = 1 day, 604800 = 1 week, 2592000 = 30 days",
      ),
    memo: z
      .string()
      .max(64)
      .default("")
      .describe("Optional note recorded on-chain with the escrow"),
  });

  export const SubscribeSchema = z.object({
    payee: ethAddress.describe(
      "Address that receives USDC at each billing interval",
    ),
    amount: z
      .string()
      .describe(
        'USDC amount charged per interval (e.g. "9.99" for $9.99 per period)',
      ),
    intervalSeconds: z
      .number()
      .int()
      .min(3600)
      .describe(
        "Seconds between each recurring charge. " +
          "Examples: 604800 = weekly, 2592000 = monthly, 31536000 = yearly",
      ),
    memo: z
      .string()
      .max(64)
      .default("")
      .describe("Optional description of the subscription recorded on-chain"),
  });
  