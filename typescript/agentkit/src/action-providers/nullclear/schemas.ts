import { z } from "zod";
import { NULLCLEAR_EVM_CHAINS, NULLCLEAR_FORENSIC_CHAINS } from "./constants";

/**
 * Input schema for running NullClear's 1-call composite Pre-Sign Firewall (`POST /v1/guard`).
 */
export const PreflightGuardSchema = z
  .object({
    chain: z
      .enum(NULLCLEAR_FORENSIC_CHAINS)
      .optional()
      .describe(
        "Target chain (`base`, `eth`, `arbitrum`, `optimism`, `polygon`, `bsc`, `solana`). Inferred from wallet network if omitted.",
      ),
    from: z
      .string()
      .optional()
      .describe("Sender wallet address. Defaults to the connected agent wallet address."),
    to: z
      .string()
      .optional()
      .describe("Target contract or recipient address for EVM transaction preflight."),
    data: z
      .string()
      .optional()
      .describe("Hex-encoded EVM transaction calldata (0x...) to unwrap and simulate."),
    value: z
      .string()
      .optional()
      .describe("Native token value in wei (decimal or hex string) for EVM transactions."),
    typedData: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Optional EIP-712 typed data object (Permit, Seaport, etc.) to audit before signing.",
      ),
    transaction: z
      .string()
      .optional()
      .describe("Optional base64-encoded Solana wire transaction to decode and simulate."),
  })
  .strip()
  .describe("Parameters for NullClear 1-call Pre-Sign Firewall guard check");

/**
 * Input schema for scanning a token contract across 7 chains (`GET /v1/scan/:chain/:address`).
 */
export const ScanTokenSchema = z
  .object({
    address: z
      .string()
      .min(10)
      .describe(
        "Token contract address (0x... for EVM chains, or base58 mint address for Solana).",
      ),
    chain: z
      .enum(NULLCLEAR_FORENSIC_CHAINS)
      .optional()
      .describe("Blockchain network. Inferred from wallet network if omitted."),
  })
  .strip()
  .describe("Parameters for scanning a token for honeypot, sell-tax, proxy, or Token-2022 risks");

/**
 * Input schema for inspecting an EVM contract's proxy slots, ABI, and bytecode CFG (`GET /v1/inspect/:chain/:address`).
 */
export const InspectContractSchema = z
  .object({
    address: z.string().min(10).describe("EVM smart contract address (0x...)."),
    chain: z
      .enum(NULLCLEAR_EVM_CHAINS)
      .optional()
      .describe(
        "EVM network (`base`, `eth`, `arbitrum`, `optimism`, `polygon`, `bsc`). Inferred from wallet network if omitted.",
      ),
  })
  .strip()
  .describe(
    "Parameters for inspecting EVM proxy slots, verified ABI selectors, and bytecode risks",
  );

/**
 * Input schema for decoding calldata or custom revert errors (`POST /v1/decode`).
 */
export const DecodeCalldataSchema = z
  .object({
    input: z
      .string()
      .min(4)
      .describe(
        "Hex-encoded EVM calldata (including nested Multicall3, Universal Router, Safe), revert bytes, or transaction hash.",
      ),
    chain: z
      .enum(NULLCLEAR_FORENSIC_CHAINS)
      .optional()
      .describe("Target chain. Inferred from wallet network if omitted."),
  })
  .strip()
  .describe("Parameters for decoding calldata, nested router bundles, or revert data");

/**
 * Input schema for stateful transaction simulation (`POST /v1/simulate`).
 */
export const SimulateTxSchema = z
  .object({
    chain: z
      .enum(NULLCLEAR_FORENSIC_CHAINS)
      .optional()
      .describe("Target chain. Inferred from wallet network if omitted."),
    from: z
      .string()
      .optional()
      .describe("Sender address. Defaults to the connected wallet address."),
    to: z.string().optional().describe("Target EVM contract address (0x...)."),
    data: z.string().optional().describe("Hex-encoded EVM calldata (0x...)."),
    value: z.string().optional().describe("Native token value in wei."),
    transaction: z
      .string()
      .optional()
      .describe("Base64-encoded Solana wire transaction for simulateTransaction."),
  })
  .strip()
  .describe("Parameters for stateful EVM eth_simulateV1 or Solana simulateTransaction preflight");
