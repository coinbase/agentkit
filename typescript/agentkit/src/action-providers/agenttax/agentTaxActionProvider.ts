import { z } from "zod";
import { encodeFunctionData, erc20Abi, getAddress, parseUnits, type Hex } from "viem";

import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";

import {
  AGENTTAX_BUILDER_CODE,
  AGENTTAX_BUILDER_CODE_SUFFIX,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  SUPPORTED_ONCHAIN_NETWORKS,
  USDC_ADDRESSES,
  USDC_DECIMALS,
  type SupportedOnchainNetwork,
} from "./constants";
import {
  CalculateTaxSchema,
  CheckNexusStatusSchema,
  Export1099DaSchema,
  GetLocalRateSchema,
  RemitTaxOnchainSchema,
  type AgentTaxConfig,
} from "./schemas";

/**
 * Internal, fully-resolved config with all fields populated.
 */
interface ResolvedAgentTaxConfig {
  apiKey: string | undefined;
  baseUrl: string;
  reserveWallet: `0x${string}` | undefined;
  builderCodeEnabled: boolean;
}

/**
 * Response shape returned from {@link AgentTaxActionProvider.apiRequest}.
 */
interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * AgentTaxActionProvider exposes the AgentTax tax-compliance API as AgentKit
 * actions, and ships a tax-compliant USDC remittance action on Base that
 * attributes every onchain payment back to AgentTax via the Base Builder
 * Code program (ERC-8021).
 *
 * **Public (unauthenticated) actions**
 * - `calculate_tax` — US sales tax calculation for an agent transaction
 * - `get_local_rate` — zip-level combined (state + local) rate lookup
 *
 * **Authenticated actions** (require `apiKey`)
 * - `check_nexus_status` — nexus status for the caller's entity across states
 * - `export_1099_da` — IRS Form 1099-DA export for a tax year
 *
 * **Onchain action** (requires `EvmWalletProvider` on Base)
 * - `remit_tax_onchain` — remit collected sales tax as a USDC transfer with
 *   the AgentTax Base Builder Code appended to the transaction calldata.
 *
 * @example
 * ```ts
 * import { AgentKit, agentTaxActionProvider } from "@coinbase/agentkit";
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [
 *     agentTaxActionProvider({
 *       apiKey: process.env.AGENTTAX_API_KEY,
 *       reserveWallet: "0xYourTreasuryWallet",
 *     }),
 *   ],
 * });
 * ```
 */
export class AgentTaxActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: ResolvedAgentTaxConfig;

  /**
   * Creates a new AgentTaxActionProvider.
   *
   * @param config - Optional provider configuration. All fields are optional;
   * public actions work without an API key, but authenticated and onchain
   * actions may require additional fields.
   */
  constructor(config: AgentTaxConfig = {}) {
    super("agenttax", []);
    this.config = {
      apiKey: config.apiKey ?? process.env.AGENTTAX_API_KEY,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      reserveWallet: config.reserveWallet,
      builderCodeEnabled: config.builderCodeEnabled ?? true,
    };
  }

  /**
   * Calculates applicable US sales tax for an agent transaction.
   *
   * @param _walletProvider - Unused for this HTTP-only action.
   * @param args - Calculation inputs (amount, buyer state, transaction type).
   * @returns JSON string with the tax breakdown, or an error description.
   */
  @CreateAction({
    name: "calculate_tax",
    description: `
Calculate applicable US sales tax for an agent transaction using the AgentTax engine.

Returns the base amount, tax amount, combined rate, jurisdiction, classification basis,
and confidence score. Supports zip-level precision when a buyerZip is provided.

Use this before settling a payment so the agent can collect the correct amount.

Example:
  calculate_tax({
    amount: 10,
    buyerState: "TX",
    transactionType: "compute",
    counterpartyId: "agent_abc123"
  })
`,
    schema: CalculateTaxSchema,
  })
  async calculateTax(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof CalculateTaxSchema>,
  ): Promise<string> {
    const body = {
      role: "seller",
      amount: args.amount,
      buyer_state: args.buyerState,
      buyer_zip: args.buyerZip ?? undefined,
      transaction_type: args.transactionType,
      counterparty_id: args.counterpartyId,
      is_b2b: args.isB2B,
    };

    const result = await this.apiRequest<Record<string, unknown> & { success?: boolean }>(
      "POST",
      "/api/v1/calculate",
      body,
    );

    if (!result.ok) {
      return this.formatError("calculate_tax", result);
    }
    // AgentTax returns HTTP 200 with { success: false, error } on validation errors.
    if (result.data && result.data.success === false) {
      return `Error (calculate_tax): ${String((result.data as { error?: unknown }).error)}`;
    }

    return JSON.stringify(result.data, null, 2);
  }

  /**
   * Looks up zip-level combined sales tax rate.
   *
   * @param _walletProvider - Unused for this HTTP-only action.
   * @param args - The ZIP code to look up.
   * @returns JSON string with combined rate info, or an error description.
   */
  @CreateAction({
    name: "get_local_rate",
    description: `
Look up the combined (state + local) US sales tax rate for a specific ZIP code.

Returns the state rate, local rate, combined rate, jurisdiction, confidence score,
and source citation. AgentTax's zip_rates table covers ~43,000 US zip codes; if
your zip is missing, the API returns a fallback suggesting the state-level rate.

Example: get_local_rate({ zip: "77001" })
`,
    schema: GetLocalRateSchema,
  })
  async getLocalRate(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetLocalRateSchema>,
  ): Promise<string> {
    const result = await this.apiRequest<Record<string, unknown> & { success?: boolean }>(
      "GET",
      `/api/v1/rates/local?zip=${encodeURIComponent(args.zip)}`,
    );

    if (!result.ok) {
      return this.formatError("get_local_rate", result);
    }
    if (result.data && result.data.success === false) {
      // Pass the API's fallback guidance through to the agent verbatim.
      return JSON.stringify(result.data, null, 2);
    }

    return JSON.stringify(result.data, null, 2);
  }

  /**
   * Checks sales tax nexus status for the configured entity across one or
   * more states.
   *
   * @param _walletProvider - Unused for this HTTP-only action.
   * @param args - The states to check nexus status for.
   * @returns JSON string with per-state nexus data, or an error description.
   */
  @CreateAction({
    name: "check_nexus_status",
    description: `
Check sales tax nexus status in one or more US states. Returns per-state
status (triggered, approaching, none) with rate and taxability info.

Without an apiKey, returns AgentTax demo data (entity_id: "demo_entity").
With an apiKey, returns real nexus data for the authenticated entity.

Example: check_nexus_status({ states: ["TX", "CA", "NY"] })
`,
    schema: CheckNexusStatusSchema,
  })
  async checkNexusStatus(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckNexusStatusSchema>,
  ): Promise<string> {
    const qs = args.states.map(s => `states=${encodeURIComponent(s)}`).join("&");
    const result = await this.apiRequest<Record<string, unknown>>("GET", `/api/v1/nexus?${qs}`);

    if (!result.ok) {
      return this.formatError("check_nexus_status", result);
    }

    return JSON.stringify(result.data, null, 2);
  }

  /**
   * Exports IRS Form 1099-DA data for the configured entity for a tax year.
   *
   * @param _walletProvider - Unused for this HTTP-only action.
   * @param args - The tax year to export.
   * @returns JSON string with 1099-DA form data, or an error description.
   */
  @CreateAction({
    name: "export_1099_da",
    description: `
Export IRS Form 1099-DA draft data for a given tax year. Returns aggregated
digital asset transaction data mapped to 1099-DA form fields, plus a payer,
recipient, and per-transaction breakdown.

Without an apiKey, returns AgentTax demo data. With an apiKey, returns data
for the authenticated entity.

The returned form is a DRAFT for informational purposes — AgentTax does not
file with the IRS. Verify all figures with a qualified tax professional.

Example: export_1099_da({ year: 2026 })
`,
    schema: Export1099DaSchema,
  })
  async export1099Da(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof Export1099DaSchema>,
  ): Promise<string> {
    const result = await this.apiRequest<Record<string, unknown>>(
      "GET",
      `/api/v1/export/1099-da?year=${args.year}`,
    );

    if (!result.ok) {
      return this.formatError("export_1099_da", result);
    }

    return JSON.stringify(result.data, null, 2);
  }

  /**
   * Remits collected sales tax as a USDC transfer on Base, appending the
   * AgentTax Base Builder Code to the transaction calldata (ERC-8021).
   *
   * @param walletProvider - EVM wallet provider on base-mainnet or base-sepolia.
   * @param args - The remittance parameters (amount, recipient, jurisdiction).
   * @returns Human-readable confirmation with the onchain transaction hash.
   */
  @CreateAction({
    name: "remit_tax_onchain",
    description: `
Remit collected sales tax onchain as a USDC transfer on Base. The transaction
calldata carries the AgentTax Base Builder Code suffix (ERC-8021) so the
remittance is attributed to AgentTax for analytics and rewards.

If the optional AgentTax apiKey is configured, the remittance is also logged
to the AgentTax audit trail (best-effort — failures do not block the transfer).

Supported networks: base-mainnet, base-sepolia.

Use this after calculate_tax to actually move the collected tax to your
treasury wallet. If recipient is omitted, the provider-configured reserveWallet
is used.

Example: remit_tax_onchain({ amountUsdc: 2.5, jurisdiction: "TX", reference: "txn_abc123" })
`,
    schema: RemitTaxOnchainSchema,
  })
  async remitTaxOnchain(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RemitTaxOnchainSchema>,
  ): Promise<string> {
    // 1. Verify network is a supported Base network
    const network = walletProvider.getNetwork();
    const networkId = network.networkId;
    if (!networkId || !SUPPORTED_ONCHAIN_NETWORKS.includes(networkId as SupportedOnchainNetwork)) {
      return (
        `Error: remit_tax_onchain only supports base-mainnet and base-sepolia. ` +
        `Current network: ${networkId ?? "unknown"}.`
      );
    }

    // 2. Resolve recipient (param → config default → error)
    const recipientRaw = args.recipient ?? this.config.reserveWallet;
    if (!recipientRaw) {
      return (
        "Error: no recipient address provided and no reserveWallet configured " +
        "on the AgentTaxActionProvider. Pass a recipient or set config.reserveWallet."
      );
    }
    let recipient: `0x${string}`;
    try {
      recipient = getAddress(recipientRaw) as `0x${string}`;
    } catch {
      return `Error: recipient "${recipientRaw}" is not a valid Ethereum address.`;
    }

    // 3. Get USDC contract for this network
    const usdcAddress = USDC_ADDRESSES[networkId];
    if (!usdcAddress) {
      return `Error: no USDC address configured for network ${networkId}.`;
    }

    // 4. Encode USDC.transfer calldata and append Builder Code suffix
    const amountInBaseUnits = parseUnits(String(args.amountUsdc), USDC_DECIMALS);
    const baseCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amountInBaseUnits],
    });
    const data = this.appendBuilderCode(baseCalldata);

    // 5. Submit the transaction
    let hash: Hex;
    try {
      hash = await walletProvider.sendTransaction({
        to: usdcAddress as Hex,
        data,
      });
      await walletProvider.waitForTransactionReceipt(hash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error submitting remittance transaction: ${message}`;
    }

    // 6. Best-effort audit log (only if apiKey is configured)
    let auditLogged = false;
    if (this.config.apiKey) {
      const logResult = await this.apiRequest("POST", "/api/v1/transactions", {
        kind: "remittance",
        amount_usdc: args.amountUsdc,
        recipient,
        jurisdiction: args.jurisdiction ?? undefined,
        reference: args.reference ?? undefined,
        tx_hash: hash,
        network: networkId,
        builder_code: AGENTTAX_BUILDER_CODE,
      });
      auditLogged = logResult.ok;
    }

    const lines = [
      `Remitted ${args.amountUsdc} USDC to ${recipient} on ${networkId}.`,
      `Transaction hash: ${hash}`,
      this.config.builderCodeEnabled
        ? `Builder Code: ${AGENTTAX_BUILDER_CODE} (appended to calldata, ERC-8021)`
        : "Builder Code: disabled",
      args.jurisdiction ? `Jurisdiction: ${args.jurisdiction}` : null,
      args.reference ? `Reference: ${args.reference}` : null,
      this.config.apiKey
        ? auditLogged
          ? "Audit log: recorded in AgentTax"
          : "Audit log: failed (transfer still succeeded)"
        : "Audit log: skipped (no apiKey configured)",
    ].filter(Boolean);

    return lines.join("\n");
  }

  /**
   * The AgentTax provider supports all EVM networks for HTTP-only actions
   * (US sales tax is network-agnostic). The `remit_tax_onchain` action
   * enforces its own Base-only check at runtime.
   *
   * @param network - The network to check.
   * @returns True if this is an EVM network, false otherwise.
   */
  supportsNetwork = (network: Network): boolean => network.protocolFamily === "evm";

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Appends the Builder Code suffix to encoded calldata if attribution is enabled.
   *
   * @param calldata - The 0x-prefixed encoded calldata.
   * @returns The calldata with the Builder Code suffix appended (if enabled).
   */
  private appendBuilderCode(calldata: `0x${string}`): `0x${string}` {
    if (!this.config.builderCodeEnabled) return calldata;
    // Strip the leading "0x" from the suffix and append its body to calldata.
    return `${calldata}${AGENTTAX_BUILDER_CODE_SUFFIX.slice(2)}` as `0x${string}`;
  }

  /**
   * Formats a failed ApiResult into a user-facing error string.
   *
   * @param actionName - The name of the calling action.
   * @param result - The failed ApiResult.
   * @returns A descriptive error message.
   */
  private formatError(actionName: string, result: ApiResult<unknown>): string {
    const detail = result.error ?? JSON.stringify(result.data);
    return `Error (${actionName}): HTTP ${result.status} — ${detail}`;
  }

  /**
   * Sends an HTTP request to the AgentTax API with timeout and error handling.
   *
   * @param method - HTTP method.
   * @param path - API path, starting with /.
   * @param body - Optional JSON body (for POST/PUT).
   * @returns An {@link ApiResult} describing the outcome.
   */
  private async apiRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (method !== "GET") headers["Content-Type"] = "application/json";
    if (this.config.apiKey) headers["X-API-Key"] = this.config.apiKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      let data: T | null = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          return {
            ok: false,
            status: response.status,
            data: null,
            error: `Non-JSON response: ${text.slice(0, 200)}`,
          };
        }
      }

      if (!response.ok) {
        const errorMessage =
          data && typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: unknown }).error)
            : response.statusText;
        return { ok: false, status: response.status, data, error: errorMessage };
      }

      return { ok: true, status: response.status, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Network error: ${message}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Factory function for {@link AgentTaxActionProvider}.
 *
 * @param config - Optional configuration.
 * @returns A new {@link AgentTaxActionProvider} instance.
 */
export const agentTaxActionProvider = (config?: AgentTaxConfig) =>
  new AgentTaxActionProvider(config);
