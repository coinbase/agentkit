import { z } from "zod";

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const SupportedChainIdSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "Target EVM Chain ID: 8453 (Base, default), 42161 (Arbitrum), 10 (Optimism), 137 (Polygon), or 1 (Ethereum).",
  );

const TierSchema = z
  .enum(["FULL", "ESSENTIAL"])
  .optional()
  .describe("Output depth: 'FULL' (default, detailed forensics) or 'ESSENTIAL' (signal scalars).");

/**
 * Schema for ingravity_fast_ping ($0.01 USDC binary address safety gate).
 */
export const FastPingSchema = z
  .object({
    address: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM hex address (0x...)")
      .describe("EVM contract, token, or spender address (0x...) to evaluate."),
    chainId: SupportedChainIdSchema,
  })
  .describe("Parameters for ingravity_fast_ping ($0.01 USDC binary SAFE/DANGER gate).");

/**
 * Schema for ingravity_tx_firewall ($0.10 USDC pre-flight transaction firewall).
 */
export const TxFirewallSchema = z
  .object({
    to: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM destination address (0x...)")
      .describe("Target contract, token, or recipient address (0x...)."),
    data: z
      .string()
      .optional()
      .describe("Hexadecimal transaction calldata (0x...); omit or pass '0x' for native transfer."),
    from: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM sender address (0x...)")
      .optional()
      .describe("Optional signer wallet address (0x...); defaults to the connected wallet."),
    value: z
      .string()
      .optional()
      .describe("Optional native ETH value in wei as a decimal string (defaults to '0')."),
    chainId: SupportedChainIdSchema,
    ticketId: z
      .string()
      .optional()
      .describe("Optional ZK-EC exposure ticket ID (TICKET-8453-...) for Safe-Harbor rescue."),
    capitalAtRiskUsd: z
      .number()
      .positive()
      .optional()
      .describe("Optional protected capital value in USD for pre-flight SLA quoting."),
  })
  .describe("Parameters for ingravity_tx_firewall ($0.10 USDC pre-sign drainer firewall).");

/**
 * Schema for ingravity_token_rug_scanner ($0.12 Full / $0.04 Essential ERC-20 honeypot scanner).
 */
export const TokenRugScannerSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM token address (0x...)")
      .optional()
      .describe("Deployed ERC-20 token address (0x...) for live RPC bytecode & proxy scan."),
    code: z
      .string()
      .optional()
      .describe("Optional Solidity (.sol) source code for pre-deployment or hybrid AST analysis."),
    chainId: SupportedChainIdSchema,
    tokenName: z.string().optional().describe("Optional token ticker or label for the report."),
    tier: TierSchema,
  })
  .refine(val => Boolean(val.tokenAddress || val.code), {
    message: "Provide at least one of 'tokenAddress' or 'code'.",
  })
  .describe("Parameters for ingravity_token_rug_scanner (live RPC honeypot & rugpull audit).");

/**
 * Schema for ingravity_defi_math_guard ($0.10 Full / $0.04 Essential BigInt AMM & MEV math).
 */
export const DefiMathGuardSchema = z
  .object({
    amm: z
      .object({
        reserveIn: z
          .string()
          .describe("Pool input token reserve in atomic base units as a positive integer string."),
        reserveOut: z
          .string()
          .describe("Pool output token reserve in atomic base units as a positive integer string."),
        amountIn: z
          .string()
          .describe(
            "Proposed swap input amount in atomic base units as a positive integer string.",
          ),
        feeBps: z
          .number()
          .int()
          .min(0)
          .max(9999)
          .optional()
          .describe("Pool fee in basis points (0-9999; 30 = 0.30%)."),
        userSlippageBps: z
          .number()
          .int()
          .min(0)
          .max(9999)
          .optional()
          .describe("Proposed slippage tolerance in basis points (0-9999; 100 = 1.00%)."),
        estimatedSandwichGasInTokenIn: z
          .string()
          .optional()
          .describe("Optional attacker gas cost in input token atomic units."),
      })
      .optional()
      .describe("Optional constant-product AMM swap parameters for exact BigInt MEV analysis."),
    leverage: z
      .object({
        entryPrice: z
          .string()
          .describe("Position entry price as a positive decimal string (e.g., '2500.00')."),
        leverage: z
          .string()
          .optional()
          .describe("Leverage multiplier string between '1' and '1000' (e.g., '10')."),
        side: z.enum(["LONG", "SHORT"]).optional().describe("Position direction: LONG or SHORT."),
        maintenanceMarginBps: z
          .number()
          .int()
          .min(0)
          .max(9999)
          .optional()
          .describe("Maintenance margin threshold in basis points (default 50)."),
        feeBufferBps: z
          .number()
          .int()
          .min(0)
          .max(9999)
          .optional()
          .describe("Fee buffer in basis points deducted from initial margin (default 10)."),
      })
      .optional()
      .describe("Optional perpetual/margin position parameters for exact liquidation math."),
    tier: TierSchema,
  })
  .refine(val => Boolean(val.amm || val.leverage), {
    message: "Provide at least one of 'amm' or 'leverage'.",
  })
  .describe("Parameters for ingravity_defi_math_guard (exact BigInt AMM slippage & MEV guard).");

/**
 * Schema for ingravity_audit_solidity ($0.85 Full / $0.35 Essential 24-vector Solidity audit).
 */
export const AuditSoliditySchema = z
  .object({
    code: z
      .string()
      .min(10, "Solidity source code must be at least 10 characters long")
      .describe(
        "Raw Solidity (.sol) smart contract source code to audit across 24 SWC/DeFi rules.",
      ),
    contractName: z
      .string()
      .optional()
      .describe("Optional contract filename or label echoed in the audit report."),
    chainId: SupportedChainIdSchema,
    contractAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM contract address (0x...)")
      .optional()
      .describe("Optional deployed contract address (0x...) for live RPC TVL verification."),
    ownerTreasury: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM treasury address (0x...)")
      .optional()
      .describe("Optional owner/multisig recipient (0x...) for Safe-Harbor rescue calldata."),
    tier: TierSchema,
  })
  .describe("Parameters for ingravity_audit_solidity (24-vector deterministic Solidity audit).");

/**
 * Schema for ingravity_protocol_dossier ($12.00 Full / $3.50 Essential multi-contract audit).
 */
export const ProtocolDossierSchema = z
  .object({
    contracts: z
      .array(
        z.object({
          name: z.string().min(1).describe("Contract filename or identifier (e.g., Vault.sol)."),
          code: z.string().min(10).describe("Non-empty Solidity (.sol) source code."),
        }),
      )
      .min(1, "Must provide at least one Solidity contract")
      .max(20, "Maximum of 20 contracts per dossier")
      .describe("Non-empty array of interdependent Solidity contracts (1 to 20 {name, code})."),
    protocolName: z
      .string()
      .optional()
      .describe("DeFi protocol or project name echoed in the executive summary."),
    tvlTargetUsd: z
      .number()
      .nonnegative()
      .optional()
      .describe("Target or declared TVL in USD for bug bounty calibration."),
    chainId: SupportedChainIdSchema,
    contractAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM vault/pool address (0x...)")
      .optional()
      .describe("Optional deployed vault/pool address (0x...) for live RPC TVL verification."),
    ownerTreasury: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM treasury address (0x...)")
      .optional()
      .describe("Optional owner/multisig recipient (0x...) for Safe-Harbor rescue calldata."),
    tier: TierSchema,
  })
  .describe("Parameters for ingravity_protocol_dossier (multi-contract cross-reentrancy audit).");

/**
 * Schema for ingravity_deep_exploit_bounty ($45.00 Full / $9.50 Essential flash-loan simulator).
 */
export const DeepExploitBountySchema = z
  .object({
    protocolName: z
      .string()
      .min(1, "Protocol name is required")
      .describe("Target protocol or pool identifier."),
    poolAddress: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM pool address (0x...)")
      .optional()
      .describe("Target EVM pool or vault contract address (0x...) inspected via live RPC."),
    chainId: SupportedChainIdSchema,
    ownerTreasury: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 42-character EVM treasury address (0x...)")
      .optional()
      .describe("Optional protocol owner/multisig recipient (0x...) for Safe-Harbor split."),
    tvlUsd: z
      .number()
      .nonnegative()
      .optional()
      .describe("Declared pool TVL in USD (overridden upward if live RPC TVL is higher)."),
    code: z
      .string()
      .optional()
      .describe("Optional Solidity (.sol) contract source code for static exploit analysis."),
    tier: TierSchema,
  })
  .describe("Parameters for ingravity_deep_exploit_bounty (flash-loan simulation & Safe-Harbor).");
