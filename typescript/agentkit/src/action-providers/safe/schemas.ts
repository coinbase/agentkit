import { z } from "zod";

export const InitializeSafeSchema = z.object({
  signers: z
    .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"))
    .describe("Array of additional signer addresses for the Safe")
    .default([]),
  threshold: z.number().min(1).describe("Number of required confirmations").default(1),
});

export const SafeInfoSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the existing Safe to connect to"),
});

export const AddSignerSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe to modify"),
  newSigner: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the new signer to add"),
  newThreshold: z.number().optional().describe("Optional new threshold after adding signer"),
});

export const RemoveSignerSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe to modify"),
  signerToRemove: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the signer to remove"),
  newThreshold: z.number().optional().describe("Optional new threshold after removing signer"),
});

export const ChangeThresholdSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe to modify"),
  newThreshold: z.number().min(1).describe("New threshold value"),
});

export const ExecutePendingSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe"),
  safeTxHash: z
    .string()
    .optional()
    .describe(
      "Optional specific transaction hash to execute. If not provided, will try to execute all pending transactions",
    ),
});

export const WithdrawFromSafeSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe"),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address to receive the ETH"),
  amount: z
    .string()
    .optional()
    .describe("Amount of ETH to withdraw (e.g. '0.1'). If not provided, withdraws entire balance"),
});

export const EnableAllowanceModuleSchema = z.object({
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format").describe("Address of the Safe to enable allowance module for"),
});
