import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { VerifyAgentSchema, GetTrustBadgeSchema } from "./schemas";
import { AGENTRADAR_BASE_URL } from "./constants";
import { AgentRadarVerifyResponse } from "./types";

/**
 * AgentRadarActionProvider provides actions to check the on-chain trust of an AI
 * agent or wallet via the AgentRadar API (a composite of ERC-8004 reputation, a
 * scam-wallet database, and static analysis) before interacting with or paying it.
 *
 * AgentRadar is network-agnostic and read-only, so these actions require no wallet
 * and no API key.
 */
export class AgentRadarActionProvider extends ActionProvider {
  /**
   * Constructor for the AgentRadarActionProvider class.
   */
  constructor() {
    super("agentradar", []);
  }

  /**
   * Verifies an AI agent or wallet's trust with AgentRadar.
   *
   * @param args - The verification parameters (the address to check)
   * @returns A JSON string with the trust score, verdict, and per-signal scores, or an error message
   */
  @CreateAction({
    name: "verify_agent",
    description: `This tool checks an AI agent or wallet's AgentRadar trust score BEFORE you interact with or pay it.
It takes the following input:
- address: the EVM address (0x...) to verify

Important notes:
- Returns a composite trust score (0-100), a verdict (TRUSTED, VERIFIED, CAUTION, RISKY, or BLOCKED), and per-signal scores (identity, reputation, scam detection, and more)
- Use this to avoid paying or trusting scam or low-reputation agents
- Returns an error message string if the address is invalid or the request fails`,
    schema: VerifyAgentSchema,
  })
  async verifyAgent(args: z.infer<typeof VerifyAgentSchema>): Promise<string> {
    try {
      const address = args.address.toLowerCase();
      const response = await fetch(`${AGENTRADAR_BASE_URL}/verify?target=${address}`, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as AgentRadarVerifyResponse;

      return JSON.stringify(
        {
          address: data.address,
          score: data.score,
          verdict: data.verdict,
          signals: data.signals,
          riskFlags: data.riskFlags ?? [],
          report: `${AGENTRADAR_BASE_URL}/verify?target=${address}`,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error verifying agent: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Builds an embeddable AgentRadar trust-badge URL for an address.
   *
   * @param args - The badge parameters (the address and an optional style)
   * @returns A URL string pointing to the badge SVG
   */
  @CreateAction({
    name: "get_trust_badge",
    description: `This tool returns an embeddable AgentRadar trust-badge image URL (SVG) for an EVM address.
It takes the following inputs:
- address: the EVM address (0x...) to render a badge for
- style: optional badge style ('flat', 'pill', or 'detailed'; defaults to 'flat')

Returns a URL string pointing to the badge SVG.`,
    schema: GetTrustBadgeSchema,
  })
  async getTrustBadge(args: z.infer<typeof GetTrustBadgeSchema>): Promise<string> {
    const address = args.address.toLowerCase();
    const style = args.style ?? "flat";
    return `${AGENTRADAR_BASE_URL}/badge/${address}?style=${style}`;
  }

  /**
   * Checks if the AgentRadar action provider supports the given network.
   * AgentRadar is network-agnostic, so this always returns true.
   *
   * @returns True, as AgentRadar actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the AgentRadar action provider.
 *
 * @returns A new AgentRadarActionProvider instance
 */
export const agentRadarActionProvider = () => new AgentRadarActionProvider();
