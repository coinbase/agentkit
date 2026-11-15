import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  RugShieldScanSchema,
  RugShieldHoneypotSchema,
  RugShieldTokenGodModeSchema,
} from "./schemas";
import { RUGSHIELD_DEFAULT_URL } from "./constants";

export interface RugShieldActionProviderConfig {
  serviceUrl?: string;
  paymentHeader?: string;
  allowPreviewFallback?: boolean;
}

/**
 * RugShieldActionProvider provides pre-trade honeypot simulation,
 * buy/sell tax verification, and holder risk analysis via RugShield 402 (Base & Solana x402).
 */
export class RugShieldActionProvider extends ActionProvider<WalletProvider> {
  private readonly serviceUrl: string;
  private readonly paymentHeader?: string;
  private readonly allowPreviewFallback: boolean;

  constructor(config?: RugShieldActionProviderConfig) {
    super("rugshield", []);
    this.serviceUrl = (config?.serviceUrl || RUGSHIELD_DEFAULT_URL).replace(/\/$/, "");
    this.paymentHeader = config?.paymentHeader || process.env.RUGSHIELD_PAYMENT_HEADER;
    this.allowPreviewFallback = config?.allowPreviewFallback ?? true;
  }

  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client | null> {
    const client = new x402Client();
    if (walletProvider instanceof EvmWalletProvider) {
      registerExactEvmScheme(client, { signer: walletProvider.toSigner() });
      return client;
    }
    if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
      return client;
    }
    return null;
  }

  private async callRugShield(
    walletProvider: WalletProvider,
    paidPath: string,
    previewPath: string | null,
    init: { method: "GET" | "POST"; body?: Record<string, unknown>; query?: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.method === "POST") {
      headers["Content-Type"] = "application/json";
    }
    const fetchOpts: RequestInit = {
      method: init.method,
      headers,
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    };

    const client = await this.createX402Client(walletProvider);
    if (client) {
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(`${this.serviceUrl}${paidPath}${qs}`, fetchOpts);
      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }
      if (response.status !== 402 || !this.allowPreviewFallback || !previewPath) {
        const errorText = await response.text();
        return { error: `RugShield HTTP ${response.status}`, details: errorText };
      }
    }

    if (this.paymentHeader) {
      const headerRes = await fetch(`${this.serviceUrl}${paidPath}${qs}`, {
        ...fetchOpts,
        headers: {
          ...headers,
          "PAYMENT-SIGNATURE": this.paymentHeader,
          "X-PAYMENT": this.paymentHeader,
        },
      });
      if (headerRes.ok) {
        return (await headerRes.json()) as Record<string, unknown>;
      }
      if (headerRes.status !== 402 || !this.allowPreviewFallback || !previewPath) {
        const errorText = await headerRes.text();
        return { error: `RugShield HTTP ${headerRes.status}`, details: errorText };
      }
    }

    if (!previewPath || !this.allowPreviewFallback) {
      return {
        error: "RugShield 402 Payment Required",
        details: "A funded Base or Solana wallet is required to pay $0.010-$0.020 USDC via x402.",
      };
    }

    const previewRes = await fetch(`${this.serviceUrl}${previewPath}${qs}`, fetchOpts);
    if (!previewRes.ok) {
      const errorText = await previewRes.text();
      return { error: `RugShield Preview HTTP ${previewRes.status}`, details: errorText };
    }
    const previewJson = (await previewRes.json()) as Record<string, unknown>;
    return {
      ...previewJson,
      payment_mode: "free_preview",
      upgrade_note:
        "Evaluated via unsimulated preview. Use a funded EvmWalletProvider or SvmWalletProvider to settle paid /v1/scan swap simulation.",
    };
  }

  @CreateAction({
    name: "scan_token",
    description: `Executes a full RugShield 402 token security scan before buying or swapping a token on Base or Solana. Detects honeypots, hidden buy/sell taxes, owner privileges, and liquidity lock risks via x402 ($0.010 USDC).
Inputs:
- tokenAddress: Contract or mint address of the token to audit.
- chain: 'base' (default) or 'solana'.
- simulateSell: True to execute sell-path calldata simulation (default: true).`,
    schema: RugShieldScanSchema,
  })
  async scanToken(
    walletProvider: WalletProvider,
    args: z.infer<typeof RugShieldScanSchema>,
  ): Promise<string> {
    try {
      const result = await this.callRugShield(walletProvider, "/v1/scan", "/v1/scan/preview", {
        method: "POST",
        body: {
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
          simulate_sell: args.simulateSell ?? true,
        },
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to execute RugShield token scan",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @CreateAction({
    name: "check_honeypot",
    description: `Fast pre-swap honeypot verification via RugShield 402 ($0.010 USDC). Returns explicit verification status without fabricating safe results on unsimulated previews.
Inputs:
- tokenAddress: Contract or mint address of the token.
- chain: 'base' (default) or 'solana'.`,
    schema: RugShieldHoneypotSchema,
  })
  async checkHoneypot(
    walletProvider: WalletProvider,
    args: z.infer<typeof RugShieldHoneypotSchema>,
  ): Promise<string> {
    try {
      const result = await this.callRugShield(walletProvider, "/v1/scan", "/v1/scan/preview", {
        method: "POST",
        body: {
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
          simulate_sell: true,
        },
      });
      if ("error" in result) {
        return JSON.stringify(result, null, 2);
      }

      const isHoneypot = typeof result.is_honeypot === "boolean" ? result.is_honeypot : null;
      const buyTaxBps = typeof result.buy_tax_bps === "number" ? result.buy_tax_bps : null;
      const sellTaxBps = typeof result.sell_tax_bps === "number" ? result.sell_tax_bps : null;
      const sellable = isHoneypot === false ? true : isHoneypot === true ? false : null;
      const recommendation =
        typeof result.recommendation === "string"
          ? result.recommendation
          : isHoneypot === true
            ? "HIGH_RISK_BLOCK"
            : isHoneypot === false && sellTaxBps !== null && sellTaxBps < 1000
              ? "SAFE_TO_SWAP"
              : "UNSIMULATED_PREVIEW";

      return JSON.stringify(
        {
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
          is_honeypot: isHoneypot,
          sellable,
          buy_tax_bps: buyTaxBps,
          sell_tax_bps: sellTaxBps,
          simulation_status: result.simulation_status ?? null,
          recommendation,
          payment_mode: result.payment_mode ?? "x402_paid",
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify({
        error: "Failed to check honeypot status",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @CreateAction({
    name: "analyze_token_god_mode",
    description: `Retrieves Token God Mode smart-money netflow, top holder concentration, and DEX orderflow via RugShield 402 /api/v1/token-god-mode ($0.020 USDC via x402).
Inputs:
- tokenAddress: Contract or mint address of the token.
- chain: 'base' (default) or 'solana'.`,
    schema: RugShieldTokenGodModeSchema,
  })
  async analyzeTokenGodMode(
    walletProvider: WalletProvider,
    args: z.infer<typeof RugShieldTokenGodModeSchema>,
  ): Promise<string> {
    try {
      const result = await this.callRugShield(walletProvider, "/api/v1/token-god-mode", null, {
        method: "GET",
        query: {
          token_address: args.tokenAddress,
          chain: args.chain ?? "base",
        },
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to analyze Token God Mode metrics",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" || network.protocolFamily === "svm";
}

export const rugshieldActionProvider = (config?: RugShieldActionProviderConfig) =>
  new RugShieldActionProvider(config);
