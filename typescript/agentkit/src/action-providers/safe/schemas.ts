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

export const ExecutePendingSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  safeTxHash: z
    .string()
    .optional()
    .describe(
      "Optional specific transaction hash to execute. If not provided, will try to execute all pending transactions",
    ),
});

export const EnableAllowanceModuleSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to enable allowance module for"),
});
