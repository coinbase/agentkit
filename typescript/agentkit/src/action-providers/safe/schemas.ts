import { z } from "zod";

export const SafeInfoSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the existing Safe to connect to"),
});

export const GetAllowanceInfoSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate to check allowance for"),
});

export const WithdrawAllowanceSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate to withdraw allowance for"),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the ERC20 token"),
  amount: z
    .string()
    .describe("Amount of tokens to withdraw in whole units (e.g. 1.5 WETH, 10 USDC)"),
});

export const AddSignerSchema = z.object({
  newSigner: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the new signer to add"),
  newThreshold: z.number().optional().describe("Optional new threshold after adding signer"),
});

export const RemoveSignerSchema = z.object({
  signerToRemove: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the signer to remove"),
  newThreshold: z.number().optional().describe("Optional new threshold after removing signer"),
});

export const ChangeThresholdSchema = z.object({
  newThreshold: z.number().min(1).describe("New threshold value"),
});

export const ApprovePendingTransactionSchema = z.object({
  safeTxHash: z.string().describe("Transaction hash to approve/execute"),
  executeImmediately: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to execute the transaction immediately if all signatures are collected"),
});

export const EnableAllowanceModuleSchema = z.object({});

export const SetAllowanceSchema = z.object({
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate who will receive the allowance"),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the ERC20 token"),
  amount: z.string().describe("Amount of tokens to allow (e.g. '1.5' for 1.5 tokens)"),
  resetTimeInMinutes: z
    .number()
    .optional()
    .describe(
      "One time allowance by default. If larger than zero, time in minutes after which the allowance resets",
    )
    .default(0),
});
