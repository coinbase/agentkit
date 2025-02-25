import { z } from "zod";

export const SafeInfoSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the existing Safe to connect to"),
});

export const AddSignerSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  newSigner: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the new signer to add"),
  newThreshold: z.number().optional().describe("Optional new threshold after adding signer"),
});

export const RemoveSignerSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  signerToRemove: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the signer to remove"),
  newThreshold: z.number().optional().describe("Optional new threshold after removing signer"),
});

export const ChangeThresholdSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  newThreshold: z.number().min(1).describe("New threshold value"),
});

export const ApprovePendingTransactionSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  safeTxHash: z.string().describe("Transaction hash to approve/execute"),
  executeImmediately: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to execute the transaction immediately if all signatures are collected"),
});

export const EnableAllowanceModuleSchema = z.object({});
