import { z } from "zod";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { CheckTokenRiskSchema, PreSwapTokenCheckSchema } from "./schemas";
import {
  BASE_MAINNET_CAIP2,
  BASE_USDC_ADDRESS,
  DEFAULT_MAX_PRICE_ATOMIC,
  DEMO_TOKENS,
  DEVX_TOKEN_CHECK_BASE_URL,
  DEVX_TOKEN_CHECK_PAY_TO,
  NETWORK_ID_TO_CHAIN,
  TokenCheckChain,
} from "./constants";

export type TokenCheckVerdict = "safe" | "caution" | "danger";

/**
 * Configuration options for the DevxTokenCheckActionProvider.
 */
export interface DevxTokenCheckActionProviderConfig {
  /** Maximum price per check in USDC. Defaults to "0.01". */
  maxPriceUsdc?: string;
  /** Verdicts that make pre_swap_token_check return proceed=false. Defaults to ["danger"]. */
  blockOn?: TokenCheckVerdict[];
  /** Return proceed=false when no verdict is available. Defaults to false. */
  failClosed?: boolean;
  /** Never pay; only the free demo tokens are checked. Defaults to false. */
  demoOnly?: boolean;
  /** Service base URL. Defaults to https://tokencheck.madebydevx.com */
  baseUrl?: string;
}

/**
 * Normalized result of a Token Check call.
 */
export interface TokenCheckResult {
  ok: boolean;
  source: "paid" | "demo" | "none";
  chain: TokenCheckChain;
  tokenAddress: string;
  verdict?: TokenCheckVerdict;
  riskScore?: number;
  confidence?: number;
  symbol?: string;
  reasons?: { severity: string; code: string; message: string }[];
  honeypot?: { buyTaxPct: number | null; sellTaxPct: number | null; sellOk: boolean | null };
  paymentTransaction?: string | null;
  error?: string;
  message?: string;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Converts a decimal USDC amount to atomic units (6 decimals).
 *
 * @param value - Decimal USDC amount, e.g. "0.01".
 * @returns The amount in atomic units.
 */
export function usdcToAtomic(value: string): bigint {
  const s = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) {
    throw new Error(`Invalid USDC amount: ${value}`);
  }
  const [whole, fraction = ""] = s.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

/**
 * Builds an x402 policy that keeps only Base USDC payment requirements to the DevX payee at or below the cap.
 *
 * @param maxAtomic - Spend cap in USDC atomic units.
 * @returns A policy function for x402Client.registerPolicy.
 */
export function tokenCheckPaymentPolicy(maxAtomic: bigint) {
  return (_version: number, requirements: PaymentRequirements[]): PaymentRequirements[] =>
    requirements.filter(requirement => {
      const r = requirement as PaymentRequirements & { maxAmountRequired?: string };
      try {
        return (
          r.scheme === "exact" &&
          r.network === BASE_MAINNET_CAIP2 &&
          String(r.asset).toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
          String(r.payTo).toLowerCase() === DEVX_TOKEN_CHECK_PAY_TO.toLowerCase() &&
          BigInt(r.amount ?? r.maxAmountRequired ?? "0") <= maxAtomic
        );
      } catch {
        return false;
      }
    });
}

/**
 * DevxTokenCheckActionProvider checks tokens for rug-pull and honeypot risk before an agent buys them,
 * using DevX Token Check (https://tokencheck.madebydevx.com).
 *
 * Each check costs 0.01 USDC on Base, paid via x402 from the agent's EVM wallet. Base USDC, WETH, DEGEN and
 * AERO are served for free by the demo endpoint. Results are informational only.
 */
export class DevxTokenCheckActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly maxPriceAtomic: bigint;
  private readonly blockOn: TokenCheckVerdict[];
  private readonly failClosed: boolean;
  private readonly demoOnly: boolean;
  private readonly baseUrl: string;

  /**
   * Creates a new DevxTokenCheckActionProvider instance.
   *
   * @param config - Optional configuration.
   */
  constructor(config: DevxTokenCheckActionProviderConfig = {}) {
    super("devx_token_check", []);
    this.maxPriceAtomic = config.maxPriceUsdc
      ? usdcToAtomic(config.maxPriceUsdc)
      : DEFAULT_MAX_PRICE_ATOMIC;
    this.blockOn = config.blockOn ?? ["danger"];
    this.failClosed = config.failClosed ?? false;
    this.demoOnly = config.demoOnly ?? false;
    this.baseUrl = (config.baseUrl ?? DEVX_TOKEN_CHECK_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * Checks a token for rug-pull and honeypot risk.
   *
   * @param walletProvider - The wallet provider used to pay for the check.
   * @param args - The token address and optional chain.
   * @returns JSON string with the verdict, risk score, confidence and reasons.
   */
  @CreateAction({
    name: "check_token_risk",
    description: `Checks a token for rug-pull and honeypot risk with DevX Token Check before buying or swapping into it.
Returns a verdict (safe, caution or danger) with a risk score, confidence and reasons. It simulates a buy, transfer and sell
with measured taxes, and checks mint, blacklist, pause, fee setter, proxy/upgradeability, owner status, liquidity and contract age.

Inputs:
- tokenAddress: Token contract address (base58 mint address on Solana)
- chain: base, ethereum, arbitrum, optimism, polygon, robinhood or solana (defaults to the wallet's network, else base)

Important notes:
- Each check costs 0.01 USDC on Base, paid automatically via x402 from this wallet (the wallet needs USDC on Base)
- Base USDC, WETH, DEGEN and AERO are checked for free
- Failed checks are not charged
- Results are informational only, not financial advice`,
    schema: CheckTokenRiskSchema,
  })
  async checkTokenRisk(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckTokenRiskSchema>,
  ): Promise<string> {
    const result = await this.check(walletProvider, args.tokenAddress, args.chain);
    return JSON.stringify(result, null, 2);
  }

  /**
   * Decides whether a swap into a token should proceed.
   *
   * @param walletProvider - The wallet provider used to pay for the check.
   * @param args - The token address and optional chain.
   * @returns JSON string with proceed, reason and verdict.
   */
  @CreateAction({
    name: "pre_swap_token_check",
    description: `Call this right before any swap or buy. Runs DevX Token Check on the token being bought and returns
{"proceed": true|false, "reason": ...}. Do NOT execute the swap when proceed is false.

Inputs:
- tokenAddress: Address of the token being bought
- chain: Chain of the token (defaults to the wallet's network, else base)

Important notes:
- Same pricing as check_token_risk: 0.01 USDC on Base via x402, demo tokens free
- Blocks on a "danger" verdict by default`,
    schema: PreSwapTokenCheckSchema,
  })
  async preSwapTokenCheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PreSwapTokenCheckSchema>,
  ): Promise<string> {
    const result = await this.check(walletProvider, args.tokenAddress, args.chain);
    let proceed: boolean;
    let reason: string;
    if (!result.ok) {
      proceed = !this.failClosed;
      reason = `No verdict available (${result.error}): ${result.message}`;
    } else {
      proceed = !this.blockOn.includes(result.verdict as TokenCheckVerdict);
      const top = (result.reasons ?? [])
        .filter(r => r.severity !== "info")
        .slice(0, 3)
        .map(r => r.message);
      reason = `Verdict ${String(result.verdict).toUpperCase()} (risk ${result.riskScore}, confidence ${result.confidence})${top.length ? `: ${top.join("; ")}` : ""}`;
    }
    return JSON.stringify(
      { proceed, reason, verdict: result.verdict ?? null, source: result.source },
      null,
      2,
    );
  }

  /**
   * Runs a token check, using the free demo endpoint for demo tokens and x402 payment otherwise.
   *
   * @param walletProvider - The wallet provider used to pay for the check.
   * @param tokenAddress - The token address.
   * @param chainArg - The chain, or null to use the wallet's network.
   * @returns The normalized result.
   */
  async check(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
    chainArg?: TokenCheckChain | null,
  ): Promise<TokenCheckResult> {
    const address = tokenAddress.trim();
    const chain =
      chainArg ?? NETWORK_ID_TO_CHAIN[walletProvider.getNetwork().networkId ?? ""] ?? "base";
    const base = { chain, tokenAddress: address };
    const valid = chain === "solana" ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address);
    if (!valid) {
      return {
        ok: false,
        source: "none",
        ...base,
        error: "invalid_input",
        message: `Invalid ${chain} token address`,
      };
    }

    if (chain === "base" && address.toLowerCase() in DEMO_TOKENS) {
      return this.request(
        `${this.baseUrl}/v1/token/demo?chain=base&address=${address}`,
        fetch,
        "demo",
        base,
      );
    }
    if (this.demoOnly) {
      return {
        ok: false,
        source: "none",
        ...base,
        error: "payment_not_configured",
        message: "demoOnly is set; only Base USDC, WETH, DEGEN and AERO can be checked for free",
      };
    }

    const client = new x402Client();
    client.register(BASE_MAINNET_CAIP2, new ExactEvmScheme(walletProvider.toSigner()));
    client.registerPolicy(tokenCheckPaymentPolicy(this.maxPriceAtomic));
    const paidFetch = wrapFetchWithPayment(fetch, client);
    const qs = new URLSearchParams({ chain, address });
    return this.request(`${this.baseUrl}/v1/token/verdict?${qs}`, paidFetch, "paid", base);
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True for EVM networks (payment is always made on Base).
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Fetches a Token Check endpoint and normalizes the response.
   *
   * @param url - Endpoint URL.
   * @param fetchFn - Plain or x402-wrapped fetch.
   * @param source - "paid" or "demo".
   * @param base - Chain and token address of the request.
   * @param base.chain - Chain of the token.
   * @param base.tokenAddress - Token address.
   * @returns The normalized result.
   */
  private async request(
    url: string,
    fetchFn: typeof fetch,
    source: "paid" | "demo",
    base: { chain: TokenCheckChain; tokenAddress: string },
  ): Promise<TokenCheckResult> {
    try {
      const response = await fetchFn(url, { headers: { accept: "application/json" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          source: "none",
          ...base,
          error: response.status === 402 ? "payment_failed" : "http_error",
          message: body?.message ?? body?.error ?? `HTTP ${response.status}`,
        };
      }
      let paymentTransaction: string | null = null;
      const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
      if (paymentHeader) {
        try {
          paymentTransaction = decodePaymentResponseHeader(paymentHeader).transaction ?? null;
        } catch {
          paymentTransaction = null;
        }
      }
      const r = body?.result ?? body ?? {};
      return {
        ok: true,
        source,
        ...base,
        verdict: r.verdict,
        riskScore: r.risk_score,
        confidence: r.confidence,
        symbol: r.token?.symbol,
        reasons: Array.isArray(r.reasons) ? r.reasons : [],
        honeypot: {
          buyTaxPct: r.honeypot?.buy_tax_pct ?? null,
          sellTaxPct: r.honeypot?.sell_tax_pct ?? null,
          sellOk: r.honeypot?.sell_ok ?? null,
        },
        paymentTransaction,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const refused =
        /filtered out by policies|no .*payment requirements|not supported|no matching/i.test(
          message,
        );
      return {
        ok: false,
        source: "none",
        ...base,
        error: refused ? "payment_refused" : "network_error",
        message,
      };
    }
  }
}

export const devxTokenCheckActionProvider = (config?: DevxTokenCheckActionProviderConfig) =>
  new DevxTokenCheckActionProvider(config);
