import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  VerifyWalletSchema,
  GetWalletTrustProfileSchema,
  GetBatchWalletTrustProfilesSchema,
  ValidateDiscountCodeSchema,
  ListComplianceTemplatesSchema,
} from "./schemas";
import { INSUMER_API_BASE_URL, INSUMER_API_KEY_MISSING_ERROR } from "./constants";
import {
  InsumerActionProviderConfig,
  InsumerResponse,
  AttestationData,
  TrustProfileData,
  BatchTrustData,
  CodeValidationData,
  ComplianceTemplatesData,
} from "./types";

/**
 * InsumerActionProvider is an action provider for InsumerAPI interactions.
 * It enables AI agents to verify on-chain wallet conditions, generate trust profiles,
 * and validate discount codes across 32 chains (30 EVM + Solana + XRPL).
 *
 * @augments ActionProvider
 */
export class InsumerActionProvider extends ActionProvider {
  private readonly apiKey: string;

  /**
   * Constructor for the InsumerActionProvider class.
   *
   * @param config - The configuration options for the InsumerActionProvider
   */
  constructor(config: InsumerActionProviderConfig = {}) {
    super("insumer", []);

    config.apiKey ||= process.env.INSUMER_API_KEY;

    if (!config.apiKey) {
      throw new Error(INSUMER_API_KEY_MISSING_ERROR);
    }

    this.apiKey = config.apiKey;
  }

  /**
   * Verifies on-chain wallet conditions. Returns ECDSA-signed boolean attestations
   * for token balances, NFT ownership, EAS attestations, and Farcaster IDs
   * across 32 chains (30 EVM + Solana + XRPL). Never exposes raw wallet balances.
   *
   * @param args - The verification parameters
   * @returns A formatted string with verification results
   */
  @CreateAction({
    name: "verify_wallet",
    description: `Verify on-chain wallet conditions with privacy-preserving boolean attestations.
It takes the following inputs:
- wallet: EVM wallet address (0x...)
- conditions: Array of 1-10 conditions to check (token_balance, nft_ownership, eas_attestation, farcaster_id)
- solanaWallet: Optional Solana wallet address for Solana conditions
- proof: Optional "merkle" for EIP-1186 Merkle storage proofs

Important notes:
- Returns ECDSA-signed boolean results, never raw balances
- Supports 32 chains (30 EVM + Solana + XRPL)
- Each condition specifies its own chainId
- Use compliance templates (e.g. coinbase_verified_account) for EAS attestations
- Costs 1 credit per call (2 with proof="merkle")
- Results include a cryptographic signature verifiable with npm install insumer-verify`,
    schema: VerifyWalletSchema,
  })
  async verifyWallet(args: z.infer<typeof VerifyWalletSchema>): Promise<string> {
    try {
      const result = await this.apiRequest<AttestationData>("POST", "/v1/attest", {
        ...(args.wallet ? { wallet: args.wallet } : {}),
        conditions: args.conditions,
        ...(args.proof ? { proof: args.proof } : {}),
        ...(args.solanaWallet ? { solanaWallet: args.solanaWallet } : {}),
        ...(args.xrplWallet ? { xrplWallet: args.xrplWallet } : {}),
        ...(args.format ? { format: args.format } : {}),
      });

      if (!result.ok) {
        return `InsumerAPI error: ${result.error.message}`;
      }

      const { attestation, sig } = result.data;
      const conditionResults = attestation.results
        .map(r => `  - ${r.label || "condition"}: ${r.met ? "PASS" : "FAIL"}`)
        .join("\n");

      return [
        `Wallet Verification Result (${attestation.id}):`,
        `Overall: ${attestation.pass ? "ALL CONDITIONS MET" : "SOME CONDITIONS FAILED"}`,
        `Conditions:`,
        conditionResults,
        `Signature: ${sig.substring(0, 20)}...`,
        `Expires: ${attestation.expiresAt}`,
        result.meta.creditsRemaining !== undefined
          ? `Credits remaining: ${result.meta.creditsRemaining}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error: unknown) {
      return `Error verifying wallet: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Generates an ECDSA-signed wallet trust profile with 17 checks across
   * 4 dimensions: stablecoins, governance, NFTs, and staking.
   *
   * @param args - The trust profile parameters
   * @returns A formatted string with the trust profile
   */
  @CreateAction({
    name: "get_wallet_trust_profile",
    description: `Generate an ECDSA-signed wallet trust profile with 17 on-chain checks across 4 dimensions.
It takes the following inputs:
- wallet: EVM wallet address (0x...) to profile
- solanaWallet: Optional Solana wallet address to include Solana USDC check
- proof: Optional "merkle" for EIP-1186 Merkle storage proofs

Important notes:
- Checks 4 dimensions: stablecoins (7 checks), governance (4), NFTs (3), staking (3)
- Returns per-check booleans and dimensional summaries
- Results are ECDSA-signed and independently verifiable
- Costs 3 credits (6 with proof="merkle")
- Trust profiles expire after 30 minutes`,
    schema: GetWalletTrustProfileSchema,
  })
  async getWalletTrustProfile(args: z.infer<typeof GetWalletTrustProfileSchema>): Promise<string> {
    try {
      const result = await this.apiRequest<TrustProfileData>("POST", "/v1/trust", {
        wallet: args.wallet,
        ...(args.solanaWallet ? { solanaWallet: args.solanaWallet } : {}),
        ...(args.xrplWallet ? { xrplWallet: args.xrplWallet } : {}),
        ...(args.proof ? { proof: args.proof } : {}),
      });

      if (!result.ok) {
        return `InsumerAPI error: ${result.error.message}`;
      }

      const { trust, sig } = result.data;
      const dimensionLines = Object.entries(trust.dimensions)
        .map(([name, dim]) => `  ${name}: ${dim.passCount}/${dim.total} passed`)
        .join("\n");

      return [
        `Wallet Trust Profile (${trust.id}):`,
        `Wallet: ${trust.wallet}`,
        `Dimensions:`,
        dimensionLines,
        `Summary: ${trust.summary.totalPassed}/${trust.summary.totalChecks} checks passed across ${trust.summary.dimensionsWithActivity}/${trust.summary.dimensionsChecked} active dimensions`,
        `Signature: ${sig.substring(0, 20)}...`,
        `Expires: ${trust.expiresAt}`,
        result.meta.creditsRemaining !== undefined
          ? `Credits remaining: ${result.meta.creditsRemaining}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error: unknown) {
      return `Error getting trust profile: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Generates trust profiles for up to 10 wallets in a single batch request.
   * 5-8x faster than sequential calls with shared block fetches.
   *
   * @param args - The batch trust profile parameters
   * @returns A formatted string with batch results
   */
  @CreateAction({
    name: "get_batch_wallet_trust_profiles",
    description: `Generate trust profiles for up to 10 wallets in a single batch request.
It takes the following inputs:
- wallets: Array of 1-10 wallet entries, each with a wallet address and optional solanaWallet
- proof: Optional "merkle" for Merkle storage proofs on all wallets

Important notes:
- 5-8x faster than sequential calls due to shared block fetches
- Each wallet gets an independent ECDSA-signed profile
- Supports partial success (some wallets may fail while others succeed)
- Costs 3 credits per wallet (6 with proof="merkle")`,
    schema: GetBatchWalletTrustProfilesSchema,
  })
  async getBatchWalletTrustProfiles(
    args: z.infer<typeof GetBatchWalletTrustProfilesSchema>,
  ): Promise<string> {
    try {
      const result = await this.apiRequest<BatchTrustData>("POST", "/v1/trust/batch", {
        wallets: args.wallets,
        ...(args.proof ? { proof: args.proof } : {}),
      });

      if (!result.ok) {
        return `InsumerAPI error: ${result.error.message}`;
      }

      const { results, summary } = result.data;
      const walletLines = results
        .map(r => {
          if ("error" in r) {
            return `  - ${r.error.wallet}: ERROR - ${r.error.message}`;
          }
          return `  - ${r.trust.wallet} (${r.trust.id}): ${r.trust.summary.totalPassed}/${r.trust.summary.totalChecks} checks passed`;
        })
        .join("\n");

      return [
        `Batch Trust Profiles:`,
        `${summary.succeeded}/${summary.requested} succeeded${summary.failed > 0 ? `, ${summary.failed} failed` : ""}`,
        `Results:`,
        walletLines,
        result.meta.creditsRemaining !== undefined
          ? `Credits remaining: ${result.meta.creditsRemaining}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error: unknown) {
      return `Error getting batch trust profiles: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Validates a discount code (INSR-XXXXX format) for merchant checkout flows.
   * No authentication required.
   *
   * @param args - The code validation parameters
   * @returns A formatted string with validation results
   */
  @CreateAction({
    name: "validate_discount_code",
    description: `Validate an InsumerAPI discount code (INSR-XXXXX format).
It takes the following inputs:
- code: The discount code to validate (format: INSR-XXXXX)

Important notes:
- No API key required (public endpoint)
- Returns validity status, discount percentage, and expiration
- Invalid codes include a reason (expired, already_used, not_found)
- Used in merchant checkout flows to apply on-chain verification discounts`,
    schema: ValidateDiscountCodeSchema,
  })
  async validateDiscountCode(args: z.infer<typeof ValidateDiscountCodeSchema>): Promise<string> {
    try {
      const result = await this.apiRequest<CodeValidationData>(
        "GET",
        `/v1/codes/${encodeURIComponent(args.code)}`,
        undefined,
        false,
      );

      if (!result.ok) {
        return `InsumerAPI error: ${result.error.message}`;
      }

      const { data } = result;

      if (data.valid) {
        return [
          `Discount Code Validation:`,
          `Code: ${data.code}`,
          `Valid: YES`,
          `Discount: ${data.discountPercent}%`,
          `Merchant: ${data.merchantId}`,
          `Expires: ${data.expiresAt}`,
        ].join("\n");
      }

      return [
        `Discount Code Validation:`,
        `Code: ${data.code}`,
        `Valid: NO`,
        `Reason: ${data.reason}`,
      ].join("\n");
    } catch (error: unknown) {
      return `Error validating code: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Lists available compliance templates for EAS attestation verification.
   * Templates abstract away raw EAS schema IDs and attester addresses.
   * No authentication required.
   *
   * @param _args - Empty input object (no parameters needed)
   * @returns A formatted string with available templates
   */
  @CreateAction({
    name: "list_compliance_templates",
    description: `List available compliance templates for EAS attestation verification.
It takes no inputs.

Important notes:
- No API key required (public endpoint)
- Templates simplify EAS attestation checks by abstracting schema IDs and attester addresses
- Use template names in verify_wallet conditions instead of raw schemaId/attester
- Currently includes Coinbase Verifications (KYC, country, Coinbase One) and Gitcoin Passport on Base/Optimism`,
    schema: ListComplianceTemplatesSchema,
  })
  async listComplianceTemplates(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: z.infer<typeof ListComplianceTemplatesSchema>,
  ): Promise<string> {
    try {
      const result = await this.apiRequest<ComplianceTemplatesData>(
        "GET",
        "/v1/compliance/templates",
        undefined,
        false,
      );

      if (!result.ok) {
        return `InsumerAPI error: ${result.error.message}`;
      }

      const templateLines = Object.entries(result.data.templates)
        .map(
          ([name, tmpl]) =>
            `  - ${name}: ${tmpl.description} (${tmpl.provider}, ${tmpl.chainName})`,
        )
        .join("\n");

      return [`Available Compliance Templates:`, templateLines].join("\n");
    } catch (error: unknown) {
      return `Error listing templates: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the InsumerAPI action provider supports the given network.
   * InsumerAPI is multi-chain (30 EVM + Solana + XRPL = 32 chains), so this always returns true.
   *
   * @param _ - The network to check
   * @returns Always returns true as InsumerAPI supports all networks
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Makes a request to the InsumerAPI.
   *
   * @param method - HTTP method
   * @param path - API path (e.g. "/v1/attest")
   * @param body - Optional request body for POST requests
   * @param authenticated - Whether to include the API key header (default: true)
   * @returns The parsed API response
   */
  private async apiRequest<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    authenticated: boolean = true,
  ): Promise<InsumerResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authenticated) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${INSUMER_API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    return (await response.json()) as InsumerResponse<T>;
  }
}

/**
 * Factory function to create a new InsumerActionProvider instance.
 *
 * @param config - The configuration options for the InsumerActionProvider
 * @returns A new instance of InsumerActionProvider
 */
export const insumerActionProvider = (config: InsumerActionProviderConfig = {}) =>
  new InsumerActionProvider(config);
