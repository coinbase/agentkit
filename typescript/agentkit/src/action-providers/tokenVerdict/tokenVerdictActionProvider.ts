import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { TokenVerdictSchema } from "./schemas";
import { fetchTokenVerdict, type TokenVerdictOptions } from "./utils";

/**
 * TokenVerdictActionProvider gives an agent a native `token_verdict`
 * action: a pay-per-call token risk screen.
 *
 * The action calls Token Verdict (POST /v1/verdict, $0.02 USDC on Base
 * via x402 v2) and pays the 402 challenge from the agent's own wallet
 * provider — `EvmWalletProvider.toSigner()` supplies the EIP-712 signer
 * for the `@x402/evm` exact scheme. The service settles through its
 * facilitator server-side.
 *
 * This provider complements AgentKit's generic `x402` action provider:
 * that provider is the general-purpose rail (any x402 endpoint, raw
 * responses, a confirmation flow), while this one is a dedicated, typed
 * action for a single service — the service's real request/response
 * contract as a Zod schema, the verdict parsed into a form the agent
 * can reason over directly, and a spend guard pinned to the known
 * price. Builders who prefer the generic route can already reach this
 * endpoint through the `x402` provider today.
 *
 * Usage:
 *   const agentKit = await AgentKit.configureWithWallet({
 *     walletProvider,
 *     actionProviders: [tokenVerdictActionProvider()],
 *   });
 */
export class TokenVerdictActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly options: TokenVerdictOptions;

  /**
   * Creates a new TokenVerdictActionProvider.
   *
   * @param options - Optional base URL / spend-guard overrides.
   */
  constructor(options: TokenVerdictOptions = {}) {
    super("token-verdict", []);
    this.options = options;
  }

  /**
   * Get a risk verdict for a token before buying, swapping, or routing
   * funds into it.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $0.02).
   * @param args - The token address and chain label.
   * @returns A JSON string with the verdict (SOLID / CAUTION / DANGER),
   * 0-100 score, six weighted market-structure signals, a written analyst
   * take, and the raw market data — or an error message string.
   */
  @CreateAction({
    name: "token_verdict",
    description: `
This tool will get a risk verdict for a token before buying, swapping, or routing funds into it.
It calls Token Verdict, a live x402 service, and pays $0.02 USDC on Base automatically from the agent wallet.
It returns a verdict (SOLID / CAUTION / DANGER) with a 0-100 score, six weighted market-structure signals
(liquidity depth, volume churn, sell pressure, price action, trader breadth, pair age), a written analyst
take, and the raw market data.

Inputs:
- address: The token contract address (0x...)
- chain: Which token market to analyze - "base" (default), "ethereum", or "solana".
  Payment always settles in USDC on Base, whichever chain's token is analyzed.

Use this when about to interact with a token whose market quality is unknown. If you are unsure of the
token contract address, please ask the user before proceeding.
`,
    schema: TokenVerdictSchema,
  })
  async tokenVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenVerdictSchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const verdict = await fetchTokenVerdict(signer, args, this.options);
      return JSON.stringify(verdict, null, 2);
    } catch (error) {
      return `Error getting token verdict: ${error}`;
    }
  }

  /**
   * Payment settles in USDC on Base, so the wallet must be an EVM
   * wallet on Base mainnet.
   *
   * @param network - The network to check support for.
   * @returns True if the network is EVM on Base mainnet, false otherwise.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId === "8453" || network.networkId === "base-mainnet")
    );
  }
}

/**
 * Factory for the Token Verdict action provider (AgentKit idiom).
 *
 * @param options - Optional base URL / spend-guard overrides.
 * @returns A new TokenVerdictActionProvider
 */
export const tokenVerdictActionProvider = (
  options: TokenVerdictOptions = {},
): TokenVerdictActionProvider => new TokenVerdictActionProvider(options);
