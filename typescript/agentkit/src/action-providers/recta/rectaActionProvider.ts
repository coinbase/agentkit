import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { RectaCompareRouteSchema, RectaCorridorSchema } from "./schemas";
import { RECTA_API_URL, RECTA_NETWORK_BY_CHAIN_ID } from "./constants";

/**
 * RectaActionProvider gives an agent a free second opinion on a cross-chain stablecoin transfer before it sends it:
 * whether Recta can prove a cheaper route than the one the agent would use, at the same chain state.
 *
 * It only reads: it never signs and never sends a transaction, and it needs no API key.
 */
export class RectaActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the RectaActionProvider.
   */
  constructor() {
    super("recta", []);
  }

  /**
   * Checks whether Recta covers a corridor from the wallet's network, and which routes it compares.
   *
   * @param walletProvider - The wallet provider, whose network is the source.
   * @param args - The destination network and asset.
   * @returns Recta's coverage answer as JSON, or an error message.
   */
  @CreateAction({
    name: "check_route_coverage",
    description: `
This tool checks whether Recta covers a cross-chain stablecoin transfer from the wallet's current network, and which
routes (bridges) it compares. Free, unsigned, and it moves nothing.

Use it before compare_bridge_route. The answer lists the routes the agent can declare as its baseline
(declarable_baselines) and the contracts a Recta route would touch. It never reveals a route, quote or saving.
`,
    schema: RectaCorridorSchema,
  })
  async checkRouteCoverage(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RectaCorridorSchema>,
  ): Promise<string> {
    return this.get("fit", walletProvider, args);
  }

  /**
   * Shows how often Recta's recorded decisions found a saving against each route on a corridor.
   *
   * @param walletProvider - The wallet provider, whose network is the source.
   * @param args - The destination network and asset.
   * @returns Recta's saving odds as JSON, or an error message.
   */
  @CreateAction({
    name: "get_route_saving_odds",
    description: `
This tool shows how often Recta has found a cheaper route than each bridge on a corridor that starts on the wallet's
current network. It is a past frequency from Recta's own recorded decisions, not a quote or a promise. Free and unsigned.
`,
    schema: RectaCorridorSchema,
  })
  async getRouteSavingOdds(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RectaCorridorSchema>,
  ): Promise<string> {
    return this.get("saving-odds", walletProvider, args);
  }

  /**
   * Asks Recta whether a cheaper route than the agent's own can be proven for a planned transfer.
   *
   * @param walletProvider - The wallet provider, whose network is the source and whose address is the sender.
   * @param args - The planned transfer and the route the agent would use without Recta.
   * @returns Recta's trial answer as JSON, or an error message.
   */
  @CreateAction({
    name: "compare_bridge_route",
    description: `
This tool asks Recta, before a cross-chain stablecoin transfer from the wallet's current network, whether it can prove
a cheaper route than the one the agent would use (baselineProvider), at the same chain state. Free, unsigned, stored
nowhere, and it moves nothing.

It takes the following inputs:
- destinationNetwork: Recta's name for the destination network (e.g. 'arbitrum', 'base', 'ethereum')
- asset: (Optional) the stablecoin, defaults to USDC
- amount: the amount in whole units (e.g. '6000')
- baselineProvider: the route the agent would actually use without Recta (e.g. 'stargate_v2', 'across', 'lifi')
- recipient: (Optional) who receives the funds, defaults to the wallet address

The answer says whether a saving was found, its lower bound in USDC and Recta's fee: exactly 5% of that saving, charged
only if the agent then executes Recta's route. No saving means nothing is owed and the agent keeps its own route.
It names no route; to get and execute one, the agent signs a request with @recta/client or the @recta/mcp server.
Limited to 3 calls a day per address.
`,
    schema: RectaCompareRouteSchema,
  })
  async compareBridgeRoute(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RectaCompareRouteSchema>,
  ): Promise<string> {
    try {
      const sourceNetwork = this.sourceNetworkOf(walletProvider);
      const query = new URLSearchParams({
        source_network: sourceNetwork,
        source_asset: args.asset,
        destination_network: args.destinationNetwork,
        destination_asset: args.asset,
        amount: args.amount,
        baseline_provider: args.baselineProvider,
      });
      const template = await this.fetchJson(`/v1/golden-corridor/request-template?${query}`);
      if (template.covered !== true || typeof template.body !== "object" || template.body === null) {
        return `Recta does not cover this transfer: ${JSON.stringify(template)}`;
      }

      const sender = walletProvider.getAddress();
      const fees = await walletProvider.getPublicClient().estimateFeesPerGas();
      const body = template.body as Record<string, unknown>;
      const request = {
        ...body,
        sender,
        recipient: args.recipient ?? sender,
        execution_authority: {
          ...(body.execution_authority as Record<string, unknown>),
          source_max_fee_per_gas_wei: fees.maxFeePerGas.toString(),
          source_max_priority_fee_per_gas_wei: fees.maxPriorityFeePerGas.toString(),
        },
      };

      const answer = await this.fetchJson("/v1/golden-corridor/trial-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return JSON.stringify(answer);
    } catch (error) {
      return `Error comparing the route with Recta: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Recta routes start on EVM networks it serves.
   *
   * @param network - The network to check.
   * @returns True if a Recta route can start on the network.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    network.chainId !== undefined &&
    RECTA_NETWORK_BY_CHAIN_ID[network.chainId] !== undefined;

  /**
   * Reads a free corridor endpoint.
   *
   * @param endpoint - The endpoint under /v1/golden-corridor/.
   * @param walletProvider - The wallet provider, whose network is the source.
   * @param args - The destination network and asset.
   * @returns The endpoint's JSON answer, or an error message.
   */
  private async get(
    endpoint: "fit" | "saving-odds",
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RectaCorridorSchema>,
  ): Promise<string> {
    try {
      const query = new URLSearchParams({
        source_network: this.sourceNetworkOf(walletProvider),
        source_asset: args.asset,
        destination_network: args.destinationNetwork,
        destination_asset: args.asset,
      });
      return JSON.stringify(await this.fetchJson(`/v1/golden-corridor/${endpoint}?${query}`));
    } catch (error) {
      return `Error reading Recta: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Recta's name for the wallet's network.
   *
   * @param walletProvider - The wallet provider.
   * @returns The network name Recta's API uses.
   */
  private sourceNetworkOf(walletProvider: EvmWalletProvider): string {
    const chainId = walletProvider.getNetwork().chainId;
    const name = chainId === undefined ? undefined : RECTA_NETWORK_BY_CHAIN_ID[chainId];
    if (name === undefined) throw new Error(`Recta routes cannot start on chain ${chainId}`);
    return name;
  }

  /**
   * Calls Recta's API and parses its JSON answer, refusals included.
   *
   * @param path - The path under the API origin.
   * @param init - The request options.
   * @returns The parsed JSON.
   */
  private async fetchJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(`${RECTA_API_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
  }
}

export const rectaActionProvider = () => new RectaActionProvider();
