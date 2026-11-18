import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { CheckTokenRiskSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

const DEFAULT_API_BASE = "https://swap.paladinfi.com";
const PREVIEW_ENDPOINT = "/v1/trust-check/preview";
const PALADINFI_BASE_CHAIN_ID = 8453;

/**
 * Configuration for the PaladinTrustActionProvider.
 */
export interface PaladinTrustActionProviderConfig {
  /**
   * Base URL of the PaladinFi Trust Check API. Defaults to
   * `https://swap.paladinfi.com`. Override only for local testing
   * (e.g. `http://localhost:8000`).
   */
  apiBase?: string;

  /**
   * When `true`, the wallet's address is sent to the API as the `taker`
   * field so the API can run anomaly heuristics on the taker↔contract
   * relationship. Default `false` (privacy-default-on). Opt-in to improve
   * the anomaly signal at the cost of sharing the agent's wallet address
   * with `swap.paladinfi.com` on every call.
   */
  sendTaker?: boolean;
}

interface TrustFactor {
  source: string;
  signal: string;
  details?: string;
  real?: boolean;
  weight?: number;
}

interface TrustBlock {
  recommendation: string;
  recommendation_enum?: string[];
  factors: TrustFactor[];
  version?: string;
  risk_score?: number | null;
  risk_score_scale?: string;
  _preview?: boolean;
  _message?: string;
}

interface TrustCheckResponse {
  address: string;
  chainId: number;
  taker?: string | null;
  request_id?: string;
  trust: TrustBlock;
  _mcp_paid_endpoint_info?: unknown;
}

/**
 * PaladinFi Trust Check action provider for pre-swap token-risk evaluation.
 *
 * Returns a composed recommendation (`sample-allow` | `sample-warn` |
 * `sample-block` on the preview endpoint this provider calls) plus a
 * per-factor breakdown (OFAC SDN, GoPlus, Etherscan source verification,
 * anomaly heuristics) for a given token contract on Base.
 *
 * This provider is decision-only — it does not sign or send any swap.
 * Compose it with `zeroX`, `enso`, `sushi`, or another swap-executing action
 * provider to actually perform a trade.
 *
 * This in-tree provider calls the free preview endpoint only. For paid mode
 * with x402 settlement ($0.001 USDC per live evaluation), use the external
 * `@paladinfi/agentkit-actions` npm package.
 */
export class PaladinTrustActionProvider extends ActionProvider<EvmWalletProvider> {
  #apiBase: string;
  #sendTaker: boolean;

  /**
   * Constructor for the PaladinTrustActionProvider.
   *
   * @param config - Configuration for the provider.
   */
  constructor(config: PaladinTrustActionProviderConfig = {}) {
    // Lowercase provider name matches zeroX's convention (`super("zerox", [])`).
    super("paladintrust", []);
    const apiBase = config.apiBase ?? DEFAULT_API_BASE;
    // Allow https://, plus localhost on http:// for tests. Tightened so
    // `http://localhost.evil.com` no longer slips through a `startsWith` check.
    const isLocalhost =
      apiBase === "http://localhost" || apiBase.startsWith("http://localhost:");
    if (!apiBase.startsWith("https://") && !isLocalhost) {
      throw new Error(
        `PaladinFi Trust API base must use https:// (or http://localhost[:port] for tests); got "${apiBase}"`,
      );
    }
    this.#apiBase = apiBase;
    this.#sendTaker = config.sendTaker ?? false;
  }

  /**
   * Calls the PaladinFi Trust Check API and returns the recommendation plus
   * per-factor breakdown for a given token contract.
   *
   * @param walletProvider - The wallet provider. Used only when
   *   `sendTaker: true` was passed to the constructor; otherwise unused.
   * @param args - The input arguments for the action.
   * @returns A JSON-stringified response containing the recommendation,
   *   per-factor breakdown, and the raw API response.
   */
  @CreateAction({
    name: "check_token_risk",
    description: `
This tool fetches a composed risk recommendation for a token contract using the PaladinFi Trust Check API (preview endpoint).

It takes the following inputs:
- chainId: The chain ID of the network. PaladinFi currently supports Base mainnet (8453) only.
- tokenAddress: The contract address of the token to evaluate.

Important notes:
- This tool does NOT execute any swap or transaction. It is a decision-only risk gate to call BEFORE composing a swap with another action provider (zeroX, enso, sushi, etc.).
- This in-tree provider calls the free preview endpoint only. The recommendation is prefixed with "sample-" (sample-allow / sample-warn / sample-block) and every factor has real: false. Use the response shape to wire up your risk gate; for live evaluation on real funds, use the external @paladinfi/agentkit-actions npm package which ships the x402-settled paid endpoint client.
- When all upstream sources are temporarily unreachable on the paid endpoint, the API returns recommendation: "warn" (fail-closed, never silent-allow). This in-tree provider's preview path is not subject to that condition because no live sources are queried.
`,
    schema: CheckTokenRiskSchema,
  })
  async checkTokenRisk(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckTokenRiskSchema>,
  ): Promise<string> {
    try {
      const response = await this.#fetchTrustCheck(walletProvider, args.chainId, args.tokenAddress);
      return JSON.stringify({
        success: true,
        recommendation: response.trust.recommendation,
        version: response.trust.version ?? null,
        factors: response.trust.factors,
        riskScore: response.trust.risk_score ?? null,
        response,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error fetching token risk: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Issues the POST request to the PaladinFi Trust Check preview endpoint.
   *
   * The `taker` field is included in the body only if `sendTaker: true` was
   * passed to the constructor AND `walletProvider.getAddress()` succeeds.
   * Privacy-default-on: callers must opt-in to share the wallet address.
   *
   * @param walletProvider - The wallet provider.
   * @param chainId - The chain ID to send in the request body.
   * @param tokenAddress - The token contract address to evaluate.
   * @returns The parsed TrustCheckResponse.
   */
  async #fetchTrustCheck(
    walletProvider: EvmWalletProvider,
    chainId: number,
    tokenAddress: string,
  ): Promise<TrustCheckResponse> {
    const url = `${this.#apiBase}${PREVIEW_ENDPOINT}`;

    let taker: string | undefined = undefined;
    if (this.#sendTaker) {
      try {
        taker = walletProvider.getAddress();
      } catch {
        // walletProvider may not be available / may throw in some harness
        // contexts; silently fall back to no-taker. The preview endpoint
        // accepts requests with the field omitted.
        taker = undefined;
      }
    }

    const bodyData: { chainId: number; address: string; taker?: string } = {
      chainId,
      address: tokenAddress,
    };
    if (taker) bodyData.taker = taker;
    const body = JSON.stringify(bodyData);

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    if (!response.ok) {
      // Don't pass server error bodies through to the LLM — PaladinFi error
      // responses may contain upstream API tokens / RPC URLs / stack traces.
      // Surface only status.
      throw new Error(`HTTP ${response.status} ${response.statusText} from PaladinFi Trust API`);
    }

    const json = (await response.json()) as TrustCheckResponse;
    if (!json || typeof json !== "object" || !("trust" in json) || !json.trust) {
      throw new Error("PaladinFi Trust API returned unexpected response shape (missing 'trust' block)");
    }
    return json;
  }

  /**
   * Checks if the PaladinTrust action provider supports the given network.
   * PaladinFi currently supports Base mainnet (chainId 8453) only.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (network.chainId === PALADINFI_BASE_CHAIN_ID.toString() ||
      network.networkId === "base-mainnet");
}

/**
 * Creates a new PaladinTrustActionProvider with the provided configuration.
 *
 * @param config - Optional configuration for the provider.
 * @returns A new PaladinTrustActionProvider.
 */
export const paladinTrustActionProvider = (config: PaladinTrustActionProviderConfig = {}) =>
  new PaladinTrustActionProvider(config);
