import { z } from "zod";

/**
 * Schema for a single verification condition
 */
const ConditionSchema = z
  .object({
    type: z
      .enum(["token_balance", "nft_ownership", "eas_attestation", "farcaster_id"])
      .describe("The type of on-chain condition to verify"),
    contractAddress: z
      .string()
      .optional()
      .describe("Token or NFT contract address (required for token_balance and nft_ownership)"),
    chainId: z
      .union([z.number(), z.string()])
      .optional()
      .describe("EVM chain ID (integer), 'solana', or 'bitcoin'. Required for token_balance and nft_ownership"),
    threshold: z
      .number()
      .optional()
      .describe("Minimum token balance threshold (default: 0, meaning any non-zero balance)"),
    decimals: z
      .number()
      .optional()
      .describe("Token decimals for threshold comparison (e.g. 6 for USDC, 18 for most ERC-20s)"),
    label: z.string().optional().describe("Human-readable label for this condition"),
    template: z
      .string()
      .optional()
      .describe(
        "Compliance template name (e.g. coinbase_verified_account). Use list_compliance_templates to see available templates",
      ),
    schemaId: z
      .string()
      .optional()
      .describe("Raw EAS schema ID (use template instead when possible)"),
    attester: z
      .string()
      .optional()
      .describe("EAS attester address (required with schemaId for eas_attestation)"),
  })
  .strict();

/**
 * Input schema for verifying wallet conditions (POST /v1/attest)
 */
export const VerifyWalletSchema = z
  .object({
    wallet: z
      .string()
      .optional()
      .describe("EVM wallet address (0x...). Required unless all conditions are Solana-only"),
    conditions: z
      .array(ConditionSchema)
      .min(1)
      .max(10)
      .describe("Array of 1-10 on-chain conditions to verify"),
    proof: z
      .enum(["merkle"])
      .optional()
      .describe("Set to 'merkle' for EIP-1186 Merkle storage proofs. Costs 2 credits instead of 1"),
    solanaWallet: z
      .string()
      .optional()
      .describe("Solana wallet address (base58). Required for Solana conditions"),
    xrplWallet: z
      .string()
      .optional()
      .describe("XRPL wallet address (r...). Required for XRPL conditions"),
    bitcoinWallet: z
      .string()
      .optional()
      .describe("Bitcoin address. Required for Bitcoin conditions (chainId: 'bitcoin')"),
    format: z
      .enum(["jwt"])
      .optional()
      .describe("Set to 'jwt' to include an ES256-signed JWT (Wallet Auth) in the response"),
  })
  .strict();

/**
 * Input schema for getting a wallet trust profile (POST /v1/trust)
 */
export const GetWalletTrustProfileSchema = z
  .object({
    wallet: z
      .string()
      .describe(
        "EVM wallet address (0x...) to profile. Returns 17 checks across 4 dimensions: stablecoins, governance, NFTs, staking",
      ),
    solanaWallet: z
      .string()
      .optional()
      .describe("Optional Solana wallet address to include Solana USDC check"),
    xrplWallet: z
      .string()
      .optional()
      .describe("Optional XRPL wallet address (r...) to include XRPL stablecoin checks"),
    bitcoinWallet: z
      .string()
      .optional()
      .describe("Optional Bitcoin address to include Bitcoin balance check"),
    proof: z
      .enum(["merkle"])
      .optional()
      .describe("Set to 'merkle' for EIP-1186 Merkle storage proofs. Costs 6 credits instead of 3"),
  })
  .strict();

/**
 * Input schema for batch wallet trust profiles (POST /v1/trust/batch)
 */
export const GetBatchWalletTrustProfilesSchema = z
  .object({
    wallets: z
      .array(
        z
          .object({
            wallet: z.string().describe("EVM wallet address (0x...)"),
            solanaWallet: z
              .string()
              .optional()
              .describe("Optional Solana wallet address for this wallet"),
            xrplWallet: z
              .string()
              .optional()
              .describe("Optional XRPL wallet address (r...) for this wallet"),
            bitcoinWallet: z
              .string()
              .optional()
              .describe("Optional Bitcoin address for this wallet"),
          })
          .strict(),
      )
      .min(1)
      .max(10)
      .describe("Array of 1-10 wallet entries to profile. 5-8x faster than sequential calls"),
    proof: z
      .enum(["merkle"])
      .optional()
      .describe("Set to 'merkle' for Merkle storage proofs on all wallets. 6 credits/wallet"),
  })
  .strict();

/**
 * Input schema for validating a discount code (GET /v1/codes/{code})
 */
export const ValidateDiscountCodeSchema = z
  .object({
    code: z.string().describe("Discount code in INSR-XXXXX format"),
  })
  .strict();

/**
 * Input schema for listing compliance templates (GET /v1/compliance/templates)
 */
export const ListComplianceTemplatesSchema = z.object({}).strict();
