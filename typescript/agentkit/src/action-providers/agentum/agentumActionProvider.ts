import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  AGENTUM_BASE_URL,
  AGENTUM_DEFAULT_MAX_PRICE_USD,
  AGENTUM_DEFAULT_TIMEOUT_MS,
  AGENTUM_ENDPOINTS,
  SUPPORTED_NETWORKS,
  AgentumActionName,
} from "./constants";
import {
  AgentumActionProviderConfig,
  BatchResolveSchema,
  CheckVendorSchema,
  ResolveEntitySchema,
  ScreenAddressSchema,
  ScreenSanctionsSchema,
  VerifyBankPayeeSchema,
  VerifyVatSchema,
} from "./schemas";
import { postToAgentum } from "./utils";

/**
 * AgentumActionProvider provides compliance and counterparty-verification actions backed by the
 * Agentum API (https://agentum.asimplek.cloud): company resolution, EU VAT, sanctions, vendor
 * KYB, IBAN payee checks and OFAC wallet-address screening.
 *
 * Each call is paid per request in USDC on Base via x402, signed by the agent's own wallet.
 * The first 5 calls per day per caller IP are free and need no payment.
 */
export class AgentumActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPriceUsd: number;
  private readonly timeoutMs: number;
  private readonly agentId: string;

  /**
   * Constructor for the AgentumActionProvider.
   *
   * @param config - The configuration options for the AgentumActionProvider.
   */
  constructor(config: AgentumActionProviderConfig = {}) {
    super("agentum", []);

    this.baseUrl = (config.baseUrl ?? AGENTUM_BASE_URL).replace(/\/$/, "");
    this.maxPriceUsd = config.maxPriceUsd ?? AGENTUM_DEFAULT_MAX_PRICE_USD;
    this.timeoutMs = config.timeoutMs ?? AGENTUM_DEFAULT_TIMEOUT_MS;
    this.agentId = config.agentId ?? `agentkit-${Math.random().toString(36).slice(2, 10)}`;

    if (!(this.maxPriceUsd >= 0)) {
      throw new Error("maxPriceUsd must be a non-negative number");
    }
  }

  /**
   * Resolves a company to its official registry record.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by ResolveEntitySchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "resolve_entity",
    description: `
Resolves a company to its official registry record: legal name, registration number, status, legal form, LEI, VAT.
Use when onboarding a vendor, verifying a counterparty on an invoice, or enriching a company name or domain with registry IDs.
Inputs: query (name, domain or registration number); optional jurisdiction (ISO-2), verifyVat, checkSanctions.
Returns: resolved, confidence, entity, candidates, compliance, vatVerification.
Sources: official registries (GLEIF, SEC EDGAR, Companies House, EU registers). Same input, same output. Some companies in some countries may be unresolved.
Cost: $0.005 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: ResolveEntitySchema,
  })
  async resolveEntity(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ResolveEntitySchema>,
  ): Promise<string> {
    return this.call(walletProvider, "resolve_entity", args);
  }

  /**
   * Validates an EU VAT number against VIES.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by VerifyVatSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "verify_eu_vat",
    description: `
Validates an EU VAT number against the European Commission VIES service and returns the registered name and address.
Use when validating the VAT ID on a supplier invoice, applying reverse charge on a cross-border B2B sale, or confirming a vendor's VAT registration at onboarding.
Inputs: vatNumber with 2-letter country prefix (e.g. DE129274202).
Returns: valid, countryCode, vatNumber, registeredName, registeredAddress, checkedAt, source (EU_VIES, CACHE, SYNTAX_ONLY), linkedEntity.
Cost: $0.005 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: VerifyVatSchema,
  })
  async verifyEuVat(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof VerifyVatSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "verify_eu_vat", args);
  }

  /**
   * Screens a company or person against sanctions lists.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by ScreenSanctionsSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "screen_sanctions",
    description: `
Screens a company or person against OFAC SDN, EU, UN and UK FCDO sanctions lists with exact and fuzzy matching.
Use when screening a counterparty before paying, checking a new vendor or customer for sanctions exposure, or re-screening a payee after a detail change.
Inputs: name; optional country (ISO-2), registrationNumber, threshold (default 0.75).
Returns: sanctioned, riskLevel (CLEAR/POTENTIAL_MATCH/EXACT_MATCH/UNKNOWN), matchScore, matchedLists, matches[].
Sources: OFAC/EU/UN/UK lists refreshed every 6h. Same input, same output.
Cost: $0.005 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: ScreenSanctionsSchema,
  })
  async screenSanctions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenSanctionsSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "screen_sanctions", args);
  }

  /**
   * Runs one-call vendor KYB: registry lookup, VAT check and sanctions screening.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by CheckVendorSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "check_vendor",
    description: `
One-call vendor KYB: registry lookup, EU VAT check and OFAC/EU/UN/UK sanctions screening with a verdict.
Use when onboarding a supplier, approving a vendor before first payment, or re-checking a counterparty.
Inputs: name; optional country (ISO-2), vatNumber, registrationNumber, domain.
Returns: verdict (APPROVED/FLAGGED_FOR_REVIEW/REJECTED), riskLevel, sanctionsHit, vatValid, entity, auditTrail[].
Sources: official registries (GLEIF, Companies House); EU VIES live; OFAC/EU/UN/UK lists refreshed every 6h. Same input, same output.
Cost: $0.010 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: CheckVendorSchema,
  })
  async checkVendor(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckVendorSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "check_vendor", args);
  }

  /**
   * Validates an IBAN and checks the account country against the expected payee country.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by VerifyBankPayeeSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "verify_bank_payee",
    description: `
Validates an IBAN (ISO 13616 format, length, MOD-97 checksum) and checks the account country matches the expected payee country.
Use when validating bank details on an invoice, confirming a payee's account change before paying, or checking for invoice redirection.
Inputs: iban; optional expectedCountry (ISO-2), payeeName, payeeTaxId (for ownership lookup in public registers).
Returns: valid, countryCode, checksumValid, countryMatch, ownershipVerified, issues[].
Cost: $0.003 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: VerifyBankPayeeSchema,
  })
  async verifyBankPayee(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof VerifyBankPayeeSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "verify_bank_payee", args);
  }

  /**
   * Resolves 1 to 25 companies in one call.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by BatchResolveSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "batch_resolve",
    description: `
Resolves 1 to 25 companies to official registry records in one call; each item works like resolve_entity.
Use when onboarding a supplier list, enriching a CSV of counterparties with registration numbers and status, or deduplicating a vendor file.
Inputs: items[] of {query (name, domain or registration number), optional country (ISO-2)}.
Returns: total, resolvedCount, unresolvedCount, results[] (query, resolved, entity, confidence).
Cost: $0.025 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: BatchResolveSchema,
  })
  async batchResolve(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BatchResolveSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "batch_resolve", args);
  }

  /**
   * Screens a crypto wallet address against OFAC's listed digital-currency addresses.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param args - Arguments defined by ScreenAddressSchema
   * @returns A JSON string with the result, or an error message
   */
  @CreateAction({
    name: "screen_address",
    description: `
Checks a crypto wallet address (EVM, Bitcoin, Tron, Solana, Litecoin) against OFAC's listed digital-currency addresses. Exact match on the official list only; not behavioural or cluster risk.
Use when about to pay or send funds to an address, vetting a counterparty wallet, or checking a deposit address.
Inputs: address; optional chain (evm, bitcoin, tron, solana, litecoin, other).
Returns: sanctioned, riskLevel (CLEAR/EXACT_MATCH/UNKNOWN), addressType, matches[], coverage. UNKNOWN is not CLEAR.
Source: OFAC SDN, refreshed every 6h. Same input, same output.
Cost: $0.002 USDC per call via x402 on Base, signed by this agent's wallet, after 5 free calls per day.
`,
    schema: ScreenAddressSchema,
  })
  async screenAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenAddressSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "screen_address", args);
  }

  /**
   * Checks if the Agentum action provider supports the given network.
   * Agentum settles x402 payments in USDC on Base mainnet.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId ?? "");

  /**
   * Performs one Agentum call and converts any failure into an error string for the LLM.
   *
   * @param walletProvider - The wallet provider that signs the x402 payment
   * @param name - The Agentum action name
   * @param body - The request body
   * @returns A JSON string with the result, or an error message
   */
  private async call(
    walletProvider: EvmWalletProvider,
    name: AgentumActionName,
    body: unknown,
  ): Promise<string> {
    try {
      return await postToAgentum({
        baseUrl: this.baseUrl,
        endpoint: AGENTUM_ENDPOINTS[name],
        body,
        walletProvider,
        maxPriceUsd: this.maxPriceUsd,
        timeoutMs: this.timeoutMs,
        agentId: this.agentId,
      });
    } catch (error) {
      return `Error calling Agentum ${name}: ${error instanceof Error ? error.message : error}`;
    }
  }
}

export const agentumActionProvider = (config?: AgentumActionProviderConfig) =>
  new AgentumActionProvider(config);
