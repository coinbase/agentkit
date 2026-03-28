import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { CheckTrustScoreSchema, CheckTokenSafetySchema, GetAgentReputationSchema } from "./schemas";
import { MAIAT_API_BASE_URL } from "./constants";

/**
 * MaiatActionProvider is an action provider for Maiat trust verification.
 * Provides functionality to check agent trust scores, token safety, and agent reputation
 * before executing any transaction. Indexes 18,600+ agents on Base.
 *
 * Free API — no API key required.
 * Docs: https://app.maiat.io/api/v1
 */
export class MaiatActionProvider extends ActionProvider {
  /**
   * Constructor for the MaiatActionProvider class.
   */
  constructor() {
    super("maiat", []);
  }

  /**
   * Checks the trust score of an agent or token address.
   *
   * @param args - The trust check parameters
   * @returns A JSON string containing trust score, verdict, and summary
   */
  @CreateAction({
    name: "check_trust_score",
    description: `Check the trust score of an agent or token before interacting with it.
Returns a trust score (0-100), verdict (proceed/caution/avoid), and behavioral summary.

It takes the following input:
- address: The Ethereum address of the agent or token to check

Important notes:
- ALWAYS check trust score before swapping tokens, delegating to agents, or any financial interaction
- Score >= 80 means "proceed" (safe to interact)
- Score 60-79 means "caution" (proceed with lower amounts)
- Score < 60 means "avoid" (do not interact)
- Free to use, no API key required
- Data sourced from 18,600+ indexed agents on Base`,
    schema: CheckTrustScoreSchema,
  })
  async checkTrustScore(args: z.infer<typeof CheckTrustScoreSchema>): Promise<string> {
    try {
      const url = `${MAIAT_API_BASE_URL}/trust?address=${encodeURIComponent(args.address)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error checking trust score: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if an ERC-20 token is safe to swap.
   * Detects honeypots, high-tax tokens, and unverified contracts.
   *
   * @param args - The token safety check parameters
   * @returns A JSON string containing safety verdict and risk flags
   */
  @CreateAction({
    name: "check_token_safety",
    description: `Check if an ERC-20 token is safe before swapping or buying.
Detects honeypots (can't sell after buying), high-tax tokens (>10% buy/sell tax),
and unverified contracts.

It takes the following input:
- token: The ERC-20 token contract address to check

Important notes:
- ALWAYS check token safety before swapping into any unknown token
- honeypot=true means you CANNOT sell after buying — do not buy
- highTax=true means buy/sell tax exceeds 10% — likely a scam
- verified=false means contract source code is not verified on block explorer
- Free to use, no API key required`,
    schema: CheckTokenSafetySchema,
  })
  async checkTokenSafety(args: z.infer<typeof CheckTokenSafetySchema>): Promise<string> {
    try {
      const url = `${MAIAT_API_BASE_URL}/token-check?token=${encodeURIComponent(args.token)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error checking token safety: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets full reputation profile for an AI agent.
   *
   * @param args - The reputation request parameters
   * @returns A JSON string containing reputation data
   */
  @CreateAction({
    name: "get_agent_reputation",
    description: `Get a comprehensive reputation profile for an AI agent.
Returns trust score, community sentiment, endorsement count, completion rate, and risk flags.

It takes the following input:
- address: The Ethereum address of the agent

Important notes:
- Use before hiring an agent, delegating tasks, or entering commercial arrangements
- Combines on-chain behavior with community endorsements
- Free to use, no API key required`,
    schema: GetAgentReputationSchema,
  })
  async getAgentReputation(args: z.infer<typeof GetAgentReputationSchema>): Promise<string> {
    try {
      const url = `${MAIAT_API_BASE_URL}/trust?address=${encodeURIComponent(args.address)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching agent reputation: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Maiat action provider supports the given network.
   * Maiat is network-agnostic (API-based), so this always returns true.
   *
   * @returns True, as Maiat actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the Maiat action provider.
 *
 * @returns A new MaiatActionProvider instance
 */
export const maiatActionProvider = () => new MaiatActionProvider();
