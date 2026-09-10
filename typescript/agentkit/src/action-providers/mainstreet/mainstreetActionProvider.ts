import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { CheckReputationSchema } from "./schemas";

const MAINSTREET_BASE_URL = "https://avisradar-production.up.railway.app";

/**
 * MainStreetActionProvider lets an agent check the onchain reputation of a Base
 * counterparty BEFORE it transacts or pays via x402.
 *
 * MainStreet is an onchain reputation oracle for agent-to-agent payments on Base:
 * for any wallet, agent, or token it returns a SAFE / CAUTION / BLOCK verdict + a
 * 0-100 score as an EIP-712-signed attestation, verifiable onchain against the
 * MainStreetVerifier contract on Base (0x7397adb9713934c36d22aa54b4dbbcd70263592b) —
 * so the trust signal is checkable, not "trust us". Network-agnostic API call.
 */
export class MainStreetActionProvider extends ActionProvider {
  /**
   * Constructor for the MainStreetActionProvider class.
   */
  constructor() {
    super("mainstreet", []);
  }

  /**
   * Checks the onchain reputation of a Base wallet / agent / token deployer.
   *
   * @param args - The address to check.
   * @returns A JSON string with the score, verdict, a pay/don't-pay recommendation, and a verify link.
   */
  @CreateAction({
    name: "check_reputation",
    description: `Check the onchain reputation of a Base wallet, agent, or token deployer BEFORE paying or transacting with it.
Returns a SAFE / CAUTION / BLOCK verdict + a 0-100 score from MainStreet, an onchain reputation oracle for agent-to-agent payments on Base.
Use this as a pre-payment / pre-routing trust gate: refuse to settle to a BLOCK-rated or low-scoring counterparty.
Takes the following input:
- address: the 0x Base address to check.
Notes:
- Free, no signup (100 checks/day/IP).
- The verdict is backed by settlement history, endpoint health, ERC-8004 feedback and identity proofs, and is EIP-712-signed + verifiable onchain against the MainStreetVerifier contract.`,
    schema: CheckReputationSchema,
  })
  async checkReputation(args: z.infer<typeof CheckReputationSchema>): Promise<string> {
    try {
      const url = `${MAINSTREET_BASE_URL}/api/agent/score/${args.address}`;
      const response = await fetch(url, { headers: { accept: "application/json" } });

      if (!response.ok) {
        return `MainStreet error: HTTP ${response.status} checking ${args.address}`;
      }

      const data = (await response.json()) as {
        score?: number | null;
        verdict?: string | null;
        trustLevel?: string | null;
      };
      const score = data.score ?? null;
      const verdict = data.verdict ?? data.trustLevel ?? "UNKNOWN";

      // Safe default: only green-light a known SAFE counterparty with a real score.
      // An unknown / unscored address (no reputation history — e.g. a fresh wallet)
      // must NOT default to "OK", or the gate is useless against new scam wallets.
      const recommendation =
        verdict === "BLOCK" || (typeof score === "number" && score < 30)
          ? "DO NOT PAY — BLOCK-rated or below a safe threshold."
          : verdict === "SAFE" && typeof score === "number" && score >= 30
            ? "OK to proceed — counterparty looks trustworthy."
            : "CAUTION — no / insufficient reputation history; verify before paying.";

      return JSON.stringify({
        address: args.address,
        score,
        verdict,
        recommendation,
        verify: `${MAINSTREET_BASE_URL}/api/agent/attestation/${args.address}`,
        source:
          "MainStreet — onchain reputation oracle on Base (EIP-712 signed, verifiable against MainStreetVerifier 0x7397adb9713934c36d22aa54b4dbbcd70263592b).",
      });
    } catch (error) {
      return `MainStreet error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the MainStreet action provider supports the given network.
   * MainStreet scores Base addresses but the lookup is a network-agnostic API call.
   *
   * @returns True — MainStreet actions are callable from any network context.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the MainStreet action provider.
 *
 * @returns A new MainStreetActionProvider instance.
 */
export const mainstreetActionProvider = () => new MainStreetActionProvider();
