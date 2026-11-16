/**
 * @file schemas.ts
 * @description Zod input validation schemas for all Ingravity Security Action Provider tools.
 */

import { z } from "zod";

/**
 * Regex for standard 20-byte EVM hex addresses.
 */
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Schema for ultra-low-cost binary SAFE/DANGER address gate ($0.01 USDC).
 */
export const FastPingSchema = z
  .object({
    address: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM hex address (0x...)")
      .describe("EVM contract, token, or recipient address to verify."),
    chainId: z
      .number()
      .int()
      .optional()
      .default(8453)
      .describe("EVM Chain ID (8453 Base, 42161 Arbitrum, 10 Optimism, 137 Polygon, 1 Ethereum; default: 8453)."),
  })
  .strip()
  .describe("Parameters for ingravity_fast_ping: $0.01 USDC binary address safety gate.");

/**
 * Schema for pre-flight transaction firewall and anti-drainer simulation ($0.10 USDC).
 */
export const TxFirewallSchema = z
  .object({
    to: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM destination address (0x...)")
      .describe("Destination contract or recipient address."),
    data: z
      .string()
      .optional()
      .default("0x")
      .describe("Transaction calldata in hexadecimal format (e.g. 0xa9059cbb...)."),
    value: z
      .string()
      .optional()
      .default("0")
      .describe("Native transaction value in wei (e.g. '0' or '10000000000000000')."),
    chainId: z
      .number()
      .int()
      .optional()
      .default(8453)
      .describe("EVM Chain ID (default: 8453 Base)."),
    victimWallet: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM address (0x...)")
      .optional()
      .describe("Originating sender wallet address under protection."),
    capitalAtRiskUsd: z
      .number()
      .positive()
      .optional()
      .describe("Estimated capital at risk in USD (used to dynamically assess rescue fee tiers)."),
  })
  .strip()
  .describe("Parameters for ingravity_tx_firewall: Pre-flight simulation, drainer detection & EIP-5792 rescue bundle.");

/**
 * Schema for live RPC ERC-20 honeypot and rugpull analysis ($0.12 / $0.04 USDC).
 */
export const TokenRugScannerSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM token address (0x...)")
      .describe("ERC-20 token contract address to analyze onchain."),
    chainId: z
      .number()
      .int()
      .optional()
      .default(8453)
      .describe("EVM Chain ID (default: 8453 Base)."),
    tier: z
      .enum(["FULL", "ESSENTIAL"])
      .optional()
      .default("FULL")
      .describe("Analysis depth: 'FULL' ($0.12 USDC, comprehensive disassembly) or 'ESSENTIAL' ($0.04 USDC, risk score)."),
  })
  .strip()
  .describe("Parameters for ingravity_token_rug_scanner: Onchain bytecode disassembly and honeypot detection.");

/**
 * Schema for AMM slippage, MEV sandwich guard and liquidity calculation ($0.10 / $0.04 USDC).
 */
export const DefiMathGuardSchema = z
  .object({
    poolAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM pool address (0x...)")
      .describe("DEX pool or router address (e.g. Uniswap v3, Aerodrome pool)."),
    tokenIn: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM input token address (0x...)")
      .describe("Address of token being swapped in."),
    tokenOut: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM output token address (0x...)")
      .describe("Address of token being received."),
    amountIn: z
      .string()
      .describe("Input amount in base units / wei (e.g. '1000000' for 1 USDC)."),
    chainId: z
      .number()
      .int()
      .optional()
      .default(8453)
      .describe("EVM Chain ID (default: 8453 Base)."),
    tier: z
      .enum(["FULL", "ESSENTIAL"])
      .optional()
      .default("FULL")
      .describe("Calculation depth: 'FULL' ($0.10 USDC) or 'ESSENTIAL' ($0.04 USDC)."),
  })
  .strip()
  .describe("Parameters for ingravity_defi_math_guard: BigInt AMM slippage and MEV anti-sandwich bounds.");

/**
 * Schema for deterministic 24-vector Solidity static code analysis ($0.85 / $0.35 USDC).
 */
export const AuditSoliditySchema = z
  .object({
    sourceCode: z
      .string()
      .min(10, "Source code must be at least 10 characters long")
      .describe("Solidity smart contract source code to analyze."),
    contractAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 20-byte EVM contract address (0x...)")
      .optional()
      .describe("Deployed contract address onchain (optional)."),
    tier: z
      .enum(["FULL", "ESSENTIAL"])
      .optional()
      .default("FULL")
      .describe("Audit tier: 'FULL' ($0.85 USDC) or 'ESSENTIAL' ($0.35 USDC)."),
  })
  .strip()
  .describe("Parameters for ingravity_audit_solidity: 24-vector static security audit with Anti-Bypass critical fix seal.");

/**
 * Schema for multi-contract protocol reentrancy graph ($12.00 / $3.50 USDC).
 */
export const ProtocolDossierSchema = z
  .object({
    targetId: z
      .string()
      .min(1, "Target ID is required")
      .describe("Protocol identifier (e.g. 'aerodrome-slipstream-v1')."),
    contracts: z
      .array(z.string().regex(EVM_ADDRESS_REGEX, "Invalid contract address in array"))
      .min(1, "Must provide at least one contract address")
      .describe("List of interconnected contract addresses forming the protocol system."),
    tier: z
      .enum(["FULL", "ESSENTIAL"])
      .optional()
      .default("FULL")
      .describe("Dossier tier: 'FULL' ($12.00 USDC) or 'ESSENTIAL' ($3.50 USDC)."),
  })
  .strip()
  .describe("Parameters for ingravity_protocol_dossier: Multi-contract cross-reentrancy and oracle invariant graph.");

/**
 * Schema for institutional deep exploit simulation and whitehat rescue ($45.00 / $9.50 USDC).
 */
export const DeepExploitBountySchema = z
  .object({
    targetId: z
      .string()
      .min(1, "Target ID is required")
      .describe("Protocol identifier for exploit simulation."),
    contracts: z
      .array(z.string().regex(EVM_ADDRESS_REGEX, "Invalid contract address in array"))
      .min(1, "Must provide at least one contract address")
      .describe("List of target contract addresses to test."),
    simulateRescue: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to simulate atomic EIP-5792 Safe-Harbor rescue calldata."),
    tier: z
      .enum(["FULL", "ESSENTIAL"])
      .optional()
      .default("FULL")
      .describe("Simulation tier: 'FULL' ($45.00 USDC) or 'ESSENTIAL' ($9.50 USDC)."),
  })
  .strip()
  .describe("Parameters for ingravity_deep_exploit_bounty: Institutional flash-loan simulation + Safe-Harbor rescue.");
