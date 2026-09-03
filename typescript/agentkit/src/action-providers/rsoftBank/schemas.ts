import { z } from "zod";

/** Optional wallet argument — defaults to the agent's own wallet. */
export const WalletArgSchema = z.object({
  wallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .describe("EVM wallet address to query; defaults to the agent's own wallet"),
});

/** Input schema for requesting a USDC loan. */
export const RequestLoanSchema = z.object({
  amount: z
    .number()
    .positive()
    .describe(
      "Loan amount in USDC. New agents start at the $5 floor and unlock larger loans by repaying (credit ladder).",
    ),
});

/** Input schema for confirming an on-chain repayment. */
export const ConfirmRepaymentSchema = z.object({
  requestId: z.string().describe("Loan request id (req_...) being repaid"),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .describe("Hash of the on-chain USDC transfer to the bank treasury"),
});

/** Input schema for querying an agent's trust score. */
export const TrustScoreSchema = z.object({
  wallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("EVM wallet address of the agent to score"),
});
