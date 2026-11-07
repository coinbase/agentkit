import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  RugShieldScanSchema,
  RugShieldHoneypotSchema,
  RugShieldTokenGodModeSchema,
} from "./schemas";
import { RUGSHIELD_DEFAULT_URL } from "./constants";

/**
 * RugShieldActionProvider provides pre-trade DEX swap simulation, honeypot detection,
 * buy/sell tax calculation, and LP lock verification for autonomous agents on Base via x402.
 */
export class RugShieldActionProvider extends ActionProvider {
  private serviceUrl: string;
  private paymentHeader?: string;

  /**
   * Constructor for the RugShieldActionProvider.
   *
   * @param config - Optional configuration containing custom service URL or x402 payment header.
   */
  constructor(config?: { serviceUrl?: string; paymentHeader?: string }) {
    super("rugshield", []);
    this.serviceUrl = (config?.serviceUrl || RUGSHIELD_DEFAULT_URL).replace(/\/$/, "");
    this.paymentHeader = config?.paymentHeader || process.env.RUGSHIELD_PAYMENT_HEADER;
  }

  /**
   * Run a comprehensive pre-trade DEX swap risk audit.
   *
   * @param args - The input arguments including tokenAddress, chain, and simulateSell.
   * @returns JSON string containing honeypot verdict, taxes, liquidity, and safety score.
   */
  @CreateAction({
    name: "scan_token",
    description: `Performs an institutional pre-trade DEX swap simulation and honeypot risk audit for a token on Base Mainnet or Solana.
Verifies buy and sell execution, computes exact buy/sell tax basis points, checks LP lock duration, ownership renunciation status, and generates a trading recommendation ('SAFE', 'CAUTION', or 'DANGEROUS').
Inputs:
- tokenAddress: Contract address of the token (e.g. 0x... on Base or Base58 on Solana).
- chain: Network ('base' or 'solana', defaults to 'base').
- simulateSell: Whether to simulate DEX sell execution to confirm tokens can be liquidated (defaults to true).`,
    schema: RugShieldScanSchema,
  })
  async scanToken(args: z.infer<typeof RugShieldScanSchema>): Promise<string> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.paymentHeader) {
        headers["PAYMENT-SIGNATURE"] = this.paymentHeader;
        headers["X-PAYMENT"] = this.paymentHeader;
      }

      const endpoint = this.paymentHeader
        ? `${this.serviceUrl}/v1/scan`
        : `${this.serviceUrl}/v1/scan/preview`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
          simulate_sell: args.simulateSell ?? true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          error: `RugShield HTTP ${response.status}`,
          details: errorText,
        });
      }

      const result = await response.json();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to execute RugShield token scan",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fast boolean honeypot check.
   *
   * @param args - The token address and chain.
   * @returns Quick safety verdict indicating whether the token is sellable.
   */
  @CreateAction({
    name: "check_honeypot",
    description: `Quickly verifies whether a token on Base or Solana is a honeypot (cannot be sold or has >50% sell tax). Returns a fast boolean is_honeypot verdict before initiating swaps.`,
    schema: RugShieldHoneypotSchema,
  })
  async checkHoneypot(args: z.infer<typeof RugShieldHoneypotSchema>): Promise<string> {
    try {
      const response = await fetch(`${this.serviceUrl}/v1/scan/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
          simulate_sell: true,
        }),
      });

      if (!response.ok) {
        return JSON.stringify({ error: `RugShield HTTP ${response.status}` });
      }

      const result = (await response.json()) as {
        is_honeypot?: boolean;
        recommendation?: string;
        sell_tax_bps?: number;
      };

      return JSON.stringify({
        token_address: args.tokenAddress,
        is_honeypot: result.is_honeypot ?? false,
        sellable: !(result.is_honeypot ?? false),
        sell_tax_bps: result.sell_tax_bps ?? 0,
        recommendation: result.recommendation ?? "UNKNOWN",
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to check honeypot status",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Analyze top token holders and smart-money orderflow.
   *
   * @param args - The token address and chain.
   * @returns Breakdown of top holder concentrations and whale clusters.
   */
  @CreateAction({
    name: "token_god_mode",
    description: `Analyzes top token holder distributions, Sybil whale cluster maps, and smart-money orderflow for a token on Base or Solana. Identifies insider concentration risks.`,
    schema: RugShieldTokenGodModeSchema,
  })
  async tokenGodMode(args: z.infer<typeof RugShieldTokenGodModeSchema>): Promise<string> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.paymentHeader) {
        headers["PAYMENT-SIGNATURE"] = this.paymentHeader;
        headers["X-PAYMENT"] = this.paymentHeader;
      }

      const endpoint = `${this.serviceUrl}/api/v1/tgm/holders`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          error: `RugShield HTTP ${response.status}`,
          details: errorText,
        });
      }

      const result = await response.json();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to retrieve Token God Mode analysis",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Network support check (supports Base, Solana, and EVM chains).
   */
  supportsNetwork = (_network: Network) => true;
}

/**
 * Factory function for creating a new RugShieldActionProvider instance.
 *
 * @param config - Optional configuration options.
 * @returns An instance of RugShieldActionProvider.
 */
export const rugshieldActionProvider = (config?: { serviceUrl?: string; paymentHeader?: string }) =>
  new RugShieldActionProvider(config);
