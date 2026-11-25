import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { CheckTokenSafetySchema, TokenSafetyConfig } from "./schemas";
import { DEFAULT_MAX_PAYMENT_USDC, SUPPORTED_NETWORKS, TOKEN_SAFETY_ENDPOINT } from "./constants";

/**
 * Reads the price in USDC from an x402 v2 402 response's PAYMENT-REQUIRED header.
 *
 * @param response - The 402 response
 * @returns The price in whole USDC, or null if it can't be read
 */
export function priceFromPaymentRequired(response: Response): number | null {
  const header = response.headers.get("payment-required");
  if (!header) return null;
  try {
    const required = JSON.parse(atob(header)) as {
      accepts?: { amount?: string; maxAmountRequired?: string }[];
    };
    const amount = required.accepts?.[0]?.amount ?? required.accepts?.[0]?.maxAmountRequired;
    // USDC has 6 decimals
    return amount ? Number(amount) / 1e6 : null;
  } catch {
    return null;
  }
}

/**
 * TokenSafetyActionProvider checks whether a token is safe before an agent buys, accepts or
 * recommends it, using a paid x402 risk-check endpoint. Each check costs $0.01 in USDC on Base,
 * paid from the agent's own wallet.
 */
export class TokenSafetyActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly endpoint: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Creates a new TokenSafetyActionProvider.
   *
   * @param config - Optional spending cap and endpoint override
   */
  constructor(config: TokenSafetyConfig = {}) {
    super("tokenSafety", []);
    this.endpoint = config.endpoint ?? TOKEN_SAFETY_ENDPOINT;
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ??
      parseFloat(process.env.TOKEN_SAFETY_MAX_PAYMENT_USDC ?? String(DEFAULT_MAX_PAYMENT_USDC));
  }

  /**
   * Checks a token's risk.
   *
   * @param walletProvider - The wallet that pays for the check
   * @param args - The token address, and optionally its chain and an earlier fingerprint
   * @returns A JSON string with the risk score, reasons and facts, or an error
   */
  @CreateAction({
    name: "check_token_safety",
    description: `This tool checks whether a token is safe (a rug check) before buying, accepting or recommending it.
It works for tokens on Base, Ethereum, Arbitrum, Optimism, Polygon and Solana.
It takes the following inputs:
- address: the token's contract address (0x...) or Solana mint address
- chain (optional): base, eth, arbitrum, optimism, polygon or solana. Defaults to solana for base58 addresses, otherwise base
- since (optional): the watch.fingerprint returned by an earlier check of the same token

It returns a risk score from 0 to 100 with a level (low, medium, high or critical) and plain-language reasons
(who can mint, freeze, blacklist, pause or change fees, upgradeable code, holder concentration, thin or missing liquidity),
the facts behind them, USD price and liquidity, and a watch.fingerprint. When since is given, watch.changes says what changed.

Important notes:
- Each check costs $0.01 in USDC on Base, paid from this wallet with x402. Errors are not charged.
- The score is rules-based and is not investment advice. Tell the user the level and the main reasons.`,
    schema: CheckTokenSafetySchema,
  })
  async checkTokenSafety(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckTokenSafetySchema>,
  ): Promise<string> {
    try {
      const url = new URL(this.endpoint);
      url.searchParams.set("address", args.address);
      if (args.chain) url.searchParams.set("chain", args.chain);
      if (args.since) url.searchParams.set("since", args.since);

      // Read the price first (this request is free) so we never pay more than the cap.
      const quote = await fetch(url);
      if (quote.status === 402) {
        const price = priceFromPaymentRequired(quote);
        if (price === null) {
          return JSON.stringify({ error: true, message: "Could not read the price of the check" });
        }
        if (price > this.maxPaymentUsdc) {
          return JSON.stringify({
            error: true,
            message: "Payment exceeds limit",
            details: `The check costs ${price} USDC, above the limit of ${this.maxPaymentUsdc} USDC.`,
          });
        }
      } else if (!quote.ok) {
        return JSON.stringify({
          error: true,
          message: `Token check failed with HTTP ${quote.status}`,
        });
      }

      const client = new x402Client();
      registerExactEvmScheme(client, { signer: this.signer(walletProvider) });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(url);
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok || !body) {
        return JSON.stringify({
          error: true,
          message:
            (body?.error as string | undefined) ??
            `Token check failed with HTTP ${response.status}`,
        });
      }
      return JSON.stringify(body, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Error checking token safety: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the paying wallet is on a supported network
   */
  supportsNetwork = (network: Network) =>
    (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Builds an x402 EVM signer from the wallet provider.
   *
   * @param walletProvider - The wallet that pays
   * @returns The signer for the exact EVM scheme
   */
  private signer(walletProvider: EvmWalletProvider) {
    const account = walletProvider.toSigner();
    return {
      ...account,
      readContract: (readArgs: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: readArgs.address,
          abi: readArgs.abi as never,
          functionName: readArgs.functionName as never,
          args: readArgs.args as never,
        }),
    };
  }
}

export const tokenSafetyActionProvider = (config?: TokenSafetyConfig) =>
  new TokenSafetyActionProvider(config);
