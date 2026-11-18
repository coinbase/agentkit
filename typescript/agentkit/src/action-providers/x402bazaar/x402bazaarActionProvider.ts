import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { TokenVerdictSchema, X402BazaarConfig } from "./schemas";
import { TOKEN_VERDICT_URL, SUPPORTED_NETWORKS } from "./constants";

/**
 * X402BazaarActionProvider screens Base ERC-20 tokens before an agent buys or
 * approves them, using the x402 Bazaar token-verdict API.
 *
 * It returns a SAFE / CAUTION / AVOID / UNKNOWN verdict with confidence, the
 * reasons behind it, and a recommended max position size. By default it uses the
 * free daily tier; when `enablePayment` is set and an EVM wallet is available it
 * pays $0.03 USDC per call over x402.
 */
export class X402BazaarActionProvider extends ActionProvider<WalletProvider> {
  private readonly enablePayment: boolean;

  /**
   * Constructor for the X402BazaarActionProvider class.
   *
   * @param config - Configuration options for the provider.
   */
  constructor(config: X402BazaarConfig = {}) {
    super("x402bazaar", []);
    this.enablePayment = config.enablePayment ?? false;
  }

  /**
   * Runs a pre-trade safety check on a Base ERC-20 token.
   *
   * @param walletProvider - The wallet provider, used only when payment is enabled.
   * @param args - The token address and optional intended trade size.
   * @returns A JSON string with the verdict, or an error object.
   */
  @CreateAction({
    name: "token_verdict_check",
    description: `
Pre-trade safety check for a Base (eip155:8453) ERC-20 token before buying or approving it.

Returns a SAFE / CAUTION / AVOID / UNKNOWN verdict with a confidence score, a one-line
headline, the reasons behind the verdict, and a recommended maximum position size in USD.
Covers honeypot behavior, sell-tax, owner powers, exit-liquidity, and freeze/seize controls.

Inputs:
- address: The Base ERC-20 token contract address (0x + 40 hex chars).
- amountUsd: (optional) Intended trade size in USD; tunes the recommended max safe size.

Use this before any action that buys, swaps into, or approves an unfamiliar Base token.
Powered by x402 Bazaar: a free daily call by default, or $0.03 USDC/call over x402 when
payment is enabled on the provider.
`,
    schema: TokenVerdictSchema,
  })
  async tokenVerdictCheck(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenVerdictSchema>,
  ): Promise<string> {
    try {
      const params = new URLSearchParams({ address: args.address });
      if (args.amountUsd !== undefined) {
        params.set("amountUsd", String(args.amountUsd));
      }

      let response: Response;

      if (this.enablePayment && walletProvider instanceof EvmWalletProvider) {
        // Paid path: pay $0.03 USDC/call over x402 using the agent's wallet.
        const client = this.createX402Client(walletProvider);
        const fetchWithPayment = wrapFetchWithPayment(fetch, client);
        response = await fetchWithPayment(`${TOKEN_VERDICT_URL}?${params.toString()}`, {
          method: "GET",
        });
      } else {
        // Free tier (default): one full call per day per IP, no payment.
        params.set("free", "1");
        response = await fetch(`${TOKEN_VERDICT_URL}?${params.toString()}`, { method: "GET" });
      }

      if (response.status === 402) {
        return JSON.stringify({
          error: true,
          message: "Payment required",
          details:
            "token-verdict requires an x402 payment ($0.03 USDC on Base). Enable payment on the " +
            "provider (enablePayment: true) with a funded EVM wallet, or omit it for the free daily call.",
        });
      }

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        return JSON.stringify({
          error: true,
          message: `x402 Bazaar request failed with status ${response.status}`,
          details: body,
        });
      }

      const json = (await response.json()) as Record<string, unknown>;
      // The free tier wraps the verdict in { data }; the paid x402 call returns it raw.
      const verdict = (json.data as unknown) ?? json;
      return JSON.stringify({ success: true, verdict });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to fetch token verdict from x402 Bazaar",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Creates an x402 client configured for the given EVM wallet provider.
   * Mirrors the in-repo x402 provider's signer construction.
   *
   * @param walletProvider - The EVM wallet provider to sign payments with.
   * @returns A configured x402Client.
   */
  private createX402Client(walletProvider: EvmWalletProvider): x402Client {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      readContract: (args: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: args.address,
          abi: args.abi as never,
          functionName: args.functionName as never,
          args: args.args as never,
        }),
    };
    registerExactEvmScheme(client, { signer });
    return client;
  }

  /**
   * Checks if the action provider supports the given network.
   * x402 Bazaar screens Base mainnet ERC-20 tokens only.
   *
   * @param network - The network to check support for.
   * @returns True if the network is Base mainnet.
   */
  supportsNetwork(network: Network): boolean {
    return (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId ?? "");
  }
}

/**
 * Factory function to create a new X402BazaarActionProvider instance.
 *
 * @param config - Configuration options for the provider.
 * @returns A new X402BazaarActionProvider instance.
 */
export const x402BazaarActionProvider = (config: X402BazaarConfig = {}) =>
  new X402BazaarActionProvider(config);
