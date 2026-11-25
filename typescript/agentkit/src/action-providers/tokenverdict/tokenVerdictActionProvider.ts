import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  TOKEN_VERDICT_NETWORK_ID,
  TOKEN_VERDICT_PRICE_ATOMIC,
  TOKEN_VERDICT_PRICE_USDC,
  TOKEN_VERDICT_URL,
} from "./constants";
import { CheckTokenSchema, TokenVerdictConfig } from "./schemas";
import { decodePaymentRequirements, isTradeAllowed, validateTokenVerdictPayment } from "./utils";

/**
 * TokenVerdictActionProvider is a pre-trade safety gate for Base tokens.
 *
 * One action, `check_token`: pays $0.02 USDC on Base via x402 to the
 * Token Verdict endpoint and returns its verdict card
 * (clean / caution / rug_risk / exit_trap, 0-100 score, reasons, facts).
 *
 * Gate rule: a trade may proceed only on clean or caution.
 * rug_risk / exit_trap (and any unknown verdict) block the trade.
 *
 * Spend safety: the endpoint URL is a constant, not caller-supplied.
 * Before signing anything, the provider reads the endpoint's 402,
 * and refuses to pay unless the ask is exactly the expected terms —
 * Base mainnet, at most $0.02, to the known Token Verdict payTo.
 * A failed check (HTTP 502 from the endpoint) is never charged.
 */
export class TokenVerdictActionProvider extends ActionProvider<WalletProvider> {
  private readonly url: string;
  private readonly maxPaymentAtomic: string;

  /**
   * Constructs a new TokenVerdictActionProvider.
   *
   * @param config - Optional endpoint URL / payment cap overrides.
   * The payment cap can only be lowered below $0.02, never raised.
   */
  constructor(config: TokenVerdictConfig = {}) {
    super("tokenverdict", []);
    this.url = config.url ?? TOKEN_VERDICT_URL;
    const maxUsdc = Math.min(
      config.maxPaymentUsdc ?? TOKEN_VERDICT_PRICE_USDC,
      TOKEN_VERDICT_PRICE_USDC,
    );
    this.maxPaymentAtomic = String(Math.round(maxUsdc * 1_000_000));
    if (this.maxPaymentAtomic > TOKEN_VERDICT_PRICE_ATOMIC) {
      this.maxPaymentAtomic = TOKEN_VERDICT_PRICE_ATOMIC;
    }
  }

  /**
   * Checks a Base token before a trade.
   *
   * @param walletProvider - The wallet provider that pays the $0.02 x402 call.
   * @param args - The token address to check.
   * @returns The verdict card as stringified JSON, plus `allowed` (the gate rule).
   */
  @CreateAction({
    name: "check_token",
    description: `Check a Base token for rug / exit risk BEFORE trading it. Costs $0.02 USDC on Base, paid via x402; no API key.

Inputs:
- tokenAddress: The Base token contract address (0x...)

Returns a verdict card: verdict (clean | caution | rug_risk | exit_trap), a 0-100 score, reasons, and the facts behind them (liquidity, holder concentration, honeypot / mint / tax flags).

Gate rule — follow it exactly:
- clean or caution: the trade may proceed (allowed: true)
- rug_risk or exit_trap: DO NOT trade (allowed: false)

Always call this before buying a Base token you have not already verified. A failed check returns an error and is never charged.`,
    schema: CheckTokenSchema,
  })
  async checkToken(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckTokenSchema>,
  ): Promise<string> {
    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return JSON.stringify({
          success: false,
          error: "Token Verdict pays USDC on Base and requires an EVM wallet provider",
        });
      }

      const body = JSON.stringify({ address: args.tokenAddress, chain: "base" });

      // Pre-flight, unpaid: read the 402 and pin the payment terms
      // before any signer is involved.
      const preflight = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (preflight.status === 200) {
        const card = await preflight.json();
        return JSON.stringify({ success: true, allowed: isTradeAllowed(card), card }, null, 2);
      }
      if (preflight.status !== 402) {
        return JSON.stringify({
          success: false,
          error: `Token Verdict failed: HTTP ${preflight.status}. A failed check is never charged.`,
        });
      }
      const requirements = decodePaymentRequirements(preflight.headers.get("payment-required"));
      const paymentError = validateTokenVerdictPayment(
        requirements?.accepts,
        this.maxPaymentAtomic,
      );
      if (paymentError) {
        return JSON.stringify({
          success: false,
          error: `Refusing to pay Token Verdict: ${paymentError}`,
        });
      }

      // Pay exactly the validated ask and retry.
      const client = new x402Client();
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (signerArgs: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: signerArgs.address,
            abi: signerArgs.abi as never,
            functionName: signerArgs.functionName as never,
            args: signerArgs.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const response = await fetchWithPayment(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `Token Verdict failed: HTTP ${response.status}. Payment is not settled on a failed check.`,
        });
      }
      const card = await response.json();
      return JSON.stringify({ success: true, allowed: isTradeAllowed(card), card }, null, 2);
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error checking token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the provider supports the given network.
   * Token Verdict v1 is Base mainnet only.
   *
   * @param network - The network to check.
   * @returns True only for base-mainnet.
   */
  supportsNetwork = (network: Network) => network.networkId === TOKEN_VERDICT_NETWORK_ID;
}

export const tokenVerdictActionProvider = (config?: TokenVerdictConfig) =>
  new TokenVerdictActionProvider(config);
