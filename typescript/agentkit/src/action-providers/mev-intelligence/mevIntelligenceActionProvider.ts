import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  GetLiquidationWavesSchema,
  GetSearcherLeaderboardSchema,
  GetBuilderRecommendationSchema,
  GetMevFeedSchema,
} from "./schemas";

const MEV_INTELLIGENCE_BASE_URL = "https://mev.advalorem.io";

/**
 * MevIntelligenceActionProvider is an action provider for real-time Ethereum MEV intelligence.
 *
 * Provides AI agents with live liquidation data across Aave V3, Spark, and Morpho Blue:
 * - Near-liquidation borrower positions ranked by health factor
 * - MEV searcher leaderboard by landed liquidations
 * - Optimal block builder recommendation for bundle routing
 * - Enriched MEV event feed
 *
 * Free preview tier requires no API key (rate-limited to 60 req/hr).
 * Paid x402 tier uses USDC micropayments on Base for full data access.
 *
 * @see https://mev.advalorem.io
 */
export class MevIntelligenceActionProvider extends ActionProvider {
  constructor() {
    super("mev-intelligence", []);
  }

  /**
   * Returns near-liquidation borrower positions ranked by health factor.
   *
   * @param args - Optional protocol and chain filters
   * @returns JSON string with borrower addresses, health factors, protocols, and USD values
   */
  @CreateAction({
    name: "get_liquidation_waves",
    description: `Fetches real-time near-liquidation borrower positions from Ethereum DeFi protocols.

Returns borrowers ranked by health factor proximity (lowest health factor = most urgent).
Each position includes: borrower address, health factor, protocol (Aave V3 / Spark / Morpho Blue),
chain (mainnet / base), collateral USD, debt USD, and estimated net liquidation value.

Use this to:
- Identify liquidation opportunities for MEV bots
- Monitor DeFi protocol risk in real time
- Track the most vulnerable positions across lending protocols

Free tier returns top 10 positions with full addresses (no delay, no masking).
Paid x402 tier ($0.50/call) returns full universe with additional analytics.`,
    schema: GetLiquidationWavesSchema,
  })
  async getLiquidationWaves(args: z.infer<typeof GetLiquidationWavesSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.protocol && args.protocol !== "all") params.set("protocol", args.protocol);
      if (args.chain && args.chain !== "all") params.set("chain", args.chain);

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`${MEV_INTELLIGENCE_BASE_URL}/preview/liquidation-waves${query}`);

      if (response.status === 402) {
        return `Payment required for full liquidation universe. Free preview available at ${MEV_INTELLIGENCE_BASE_URL}/preview/liquidation-waves. Paid x402 endpoint: ${MEV_INTELLIGENCE_BASE_URL}/intelligence/liquidation-waves ($0.50/call, USDC on Base).`;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching liquidation positions: ${error}`;
    }
  }

  /**
   * Returns the MEV searcher leaderboard ranked by liquidation activity.
   *
   * @param args - Optional limit for number of results
   * @returns JSON string with searcher addresses, landed fires, and protocol breakdown
   */
  @CreateAction({
    name: "get_searcher_leaderboard",
    description: `Fetches the MEV searcher leaderboard — addresses ranked by liquidation activity on Ethereum.

Returns searcher wallet addresses, number of landed liquidations, land rate percentage,
and protocol breakdown. Use this to assess competitive landscape before deploying
liquidation strategies or to identify dominant searchers in specific protocols.

Free tier returns top 5 searchers.
Paid x402 tier ($0.25/call) returns full 25-entry leaderboard with extended analytics.`,
    schema: GetSearcherLeaderboardSchema,
  })
  async getSearcherLeaderboard(
    args: z.infer<typeof GetSearcherLeaderboardSchema>,
  ): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.limit) params.set("limit", args.limit.toString());

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(
        `${MEV_INTELLIGENCE_BASE_URL}/preview/searcher-leaderboard${query}`,
      );

      if (response.status === 402) {
        return `Payment required for full leaderboard. Free preview (top 5) at ${MEV_INTELLIGENCE_BASE_URL}/preview/searcher-leaderboard. Paid x402: ${MEV_INTELLIGENCE_BASE_URL}/intelligence/searcher-leaderboard ($0.25/call).`;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching searcher leaderboard: ${error}`;
    }
  }

  /**
   * Returns the recommended Ethereum block builder for liquidation bundle submission.
   *
   * @param args - No input required
   * @returns JSON string with ranked builders, relay health scores, and inclusion rates
   */
  @CreateAction({
    name: "get_builder_recommendation",
    description: `Returns the optimal Ethereum block builder to route liquidation bundles to right now.

Based on live relay health scores, recent inclusion rates, and current block competition.
Covers Flashbots, Titan, Aestus, and Agnostic relays. Use this before submitting a
liquidation bundle to maximize inclusion probability.

Free tier returns top recommendation.
Paid x402 tier ($0.25/call) returns full ranked builder list with relay health details.`,
    schema: GetBuilderRecommendationSchema,
  })
  async getBuilderRecommendation(
    _args: z.infer<typeof GetBuilderRecommendationSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(`${MEV_INTELLIGENCE_BASE_URL}/preview/builder-recommendation`);

      if (response.status === 402) {
        return `Payment required for full builder ranking. Free preview at ${MEV_INTELLIGENCE_BASE_URL}/preview/builder-recommendation. Paid x402: ${MEV_INTELLIGENCE_BASE_URL}/intelligence/builder-recommendation ($0.25/call).`;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching builder recommendation: ${error}`;
    }
  }

  /**
   * Returns an enriched stream of recent MEV-relevant events.
   *
   * @param args - Optional limit for number of events
   * @returns JSON string with recent MEV events, alerts, and opportunity signals
   */
  @CreateAction({
    name: "get_mev_feed",
    description: `Fetches a stream of recent MEV-relevant on-chain events from Ethereum.

Includes near-liquidation alerts (health factor changes), crossed liquidation events,
protocol activity signals, and opportunity windows. Useful for agents that need
continuous situational awareness of DeFi risk conditions.

Free tier returns 10 recent events.
Paid x402 tier ($0.10/call) returns full enriched stream with additional context.`,
    schema: GetMevFeedSchema,
  })
  async getMevFeed(args: z.infer<typeof GetMevFeedSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.limit) params.set("limit", args.limit.toString());

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`${MEV_INTELLIGENCE_BASE_URL}/preview/feed${query}`);

      if (response.status === 402) {
        return `Payment required for full MEV feed. Free preview at ${MEV_INTELLIGENCE_BASE_URL}/preview/feed. Paid x402: ${MEV_INTELLIGENCE_BASE_URL}/intelligence/feed ($0.10/call).`;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching MEV feed: ${error}`;
    }
  }

  /**
   * Checks whether this provider supports a given network.
   * MEV Intelligence is network-agnostic (external read API).
   */
  supportsNetwork = () => true;
}

export const mevIntelligenceActionProvider = () => new MevIntelligenceActionProvider();
