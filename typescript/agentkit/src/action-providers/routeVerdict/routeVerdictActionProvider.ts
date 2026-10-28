import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { RouteVerdictSchema } from "./schemas";
import { fetchRouteVerdict, type RouteVerdictOptions } from "./utils";

/**
 * RouteVerdictActionProvider gives an agent a native `route_verdict`
 * action: a pay-per-call trust check for x402 endpoints themselves.
 *
 * The action calls RouteVerdict (POST /v1/check, $0.05 USDC on Base via
 * x402 v2) and pays the 402 challenge from the agent's own wallet
 * provider — `EvmWalletProvider.toSigner()` supplies the EIP-712 signer
 * for the `@x402/evm` exact scheme. The service settles through its
 * facilitator server-side. The check is observation-only on the target:
 * RouteVerdict probes the target WITHOUT paying it.
 *
 * This provider complements AgentKit's generic `x402` action provider:
 * that provider is the general-purpose rail (any x402 endpoint, raw
 * responses, a confirmation flow), while this one is a dedicated, typed
 * action for a single service — the service's real request/response
 * contract as a Zod schema, the verdict parsed into a form the agent
 * can reason over directly, and a spend guard pinned to the known
 * price. Builders who prefer the generic route can already reach this
 * endpoint through the `x402` provider today.
 *
 * Usage:
 *   const agentKit = await AgentKit.configureWithWallet({
 *     walletProvider,
 *     actionProviders: [routeVerdictActionProvider()],
 *   });
 */
export class RouteVerdictActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly options: RouteVerdictOptions;

  /**
   * Creates a new RouteVerdictActionProvider.
   *
   * @param options - Optional base URL / spend-guard overrides.
   */
  constructor(options: RouteVerdictOptions = {}) {
    super("route-verdict", []);
    this.options = options;
  }

  /**
   * Get a trust verdict on an x402 endpoint before paying it.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $0.05).
   * @param args - The full URL of the x402 resource to audit.
   * @returns A JSON string with the verdict (TRUSTED / CAUTION / AVOID),
   * 0-100 score, itemized reasons, liveness, the live payment terms,
   * discovery-schema quality, catalog presence, and a diff against the
   * previous check of the same URL — or an error message string.
   */
  @CreateAction({
    name: "route_verdict",
    description: `
This tool will get a trust verdict on an x402 endpoint before paying it.
It calls RouteVerdict, a live x402 service, and pays $0.05 USDC on Base automatically from the agent wallet.
It returns a verdict (TRUSTED / CAUTION / AVOID) with a 0-100 score and itemized reasons, the endpoint's
liveness and live payment terms, its Bazaar discovery-schema quality, whether the public catalogs list it,
and what changed since the last check of the same URL. The target endpoint is only probed, never paid.

Inputs:
- resource_url: The full URL of the x402 resource to audit (e.g. "https://example.com/v1/paid-route").

Use this when about to pay an unfamiliar x402 endpoint and you need to know it is alive, honestly
described, and unchanged first.
`,
    schema: RouteVerdictSchema,
  })
  async routeVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RouteVerdictSchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const verdict = await fetchRouteVerdict(signer, args, this.options);
      return JSON.stringify(verdict, null, 2);
    } catch (error) {
      return `Error getting route verdict: ${error}`;
    }
  }

  /**
   * Payment settles in USDC on Base, so the wallet must be an EVM
   * wallet on Base mainnet.
   *
   * @param network - The network to check support for.
   * @returns True if the network is EVM on Base mainnet, false otherwise.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId === "8453" || network.networkId === "base-mainnet")
    );
  }
}

/**
 * Factory for the RouteVerdict action provider (AgentKit idiom).
 *
 * @param options - Optional base URL / spend-guard overrides.
 * @returns A new RouteVerdictActionProvider
 */
export const routeVerdictActionProvider = (
  options: RouteVerdictOptions = {},
): RouteVerdictActionProvider => new RouteVerdictActionProvider(options);
