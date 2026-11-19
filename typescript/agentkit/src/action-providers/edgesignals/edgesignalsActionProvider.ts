import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { TokenVerdictSchema } from "./schemas";
import {
  DEFAULT_TOKEN_CHAIN,
  SIGNALS_BASE_URL,
  TOKEN_VERDICT_PATH,
  TOKEN_VERDICT_PRICE_USDC,
} from "./constants";

/**
 * Optional configuration for the Edge Signals action provider.
 */
export interface EdgeSignalsActionProviderConfig {
  /**
   * Override the Edge Signals base URL. Intended for tests.
   */
  baseUrl?: string;
}

/**
 * A Token Verdict payload returned by Edge Signals.
 */
interface TokenVerdictResponse {
  product?: string;
  grade?: string;
  band?: string;
  score?: number;
  reasons?: string[];
  disclaimer?: string;
  summary?: string;
}

/**
 * Builds the Token Verdict request URL.
 *
 * @param token - ERC-20 contract address
 * @param chain - Chain the token is deployed on
 * @param baseUrl - Edge Signals base URL
 * @returns Absolute Token Verdict URL
 */
export function buildTokenVerdictUrl(
  token: string,
  chain: string = DEFAULT_TOKEN_CHAIN,
  baseUrl: string = SIGNALS_BASE_URL,
): string {
  const url = new URL(TOKEN_VERDICT_PATH, baseUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("chain", chain);
  return url.toString();
}

/**
 * Formats a Token Verdict API payload as agent-readable text.
 *
 * @param data - Parsed API response
 * @param token - Token address that was evaluated
 * @param chain - Chain that was evaluated
 * @returns Formatted verdict string
 */
export function formatTokenVerdict(
  data: TokenVerdictResponse,
  token: string,
  chain: string,
): string {
  const grade = data.grade ?? "unknown";
  const band = data.band ?? "unknown";
  const score = data.score ?? "unknown";
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n")
    : "";
  const header = data.summary ? data.summary : `Grade ${grade}, band ${band}, score ${score}/100.`;

  const lines = [
    `Token Verdict for ${token} on ${chain}:`,
    header,
    `Grade: ${grade}`,
    `Band: ${band}`,
    `Score: ${score}/100`,
  ];

  if (reasons) {
    lines.push("Reasons:", reasons);
  }

  lines.push(
    `Disclaimer: ${data.disclaimer ?? "Not financial advice."}`,
    `Paid ${TOKEN_VERDICT_PRICE_USDC} USDC on Base via x402. This is an optional pre-trade check, not financial advice.`,
  );

  return lines.join("\n");
}

/**
 * EdgeSignalsActionProvider exposes Token Verdict, a $0.01 x402 pre-trade
 * token-risk check on Base, as an optional AgentKit action.
 *
 * Payment is made from the agent's EVM wallet in USDC on Base. The provider
 * is opt-in: it is only available when added to an AgentKit instance.
 */
export class EdgeSignalsActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;

  /**
   * Creates a new EdgeSignalsActionProvider.
   *
   * @param config - Optional configuration
   */
  constructor(config: EdgeSignalsActionProviderConfig = {}) {
    super("edgesignals", []);
    this.baseUrl = config.baseUrl ?? SIGNALS_BASE_URL;
  }

  /**
   * Fetches a Token Verdict for an ERC-20, paying $0.01 USDC on Base via x402.
   *
   * @param walletProvider - The EVM wallet used to pay for the call
   * @param args - Token address and optional chain
   * @returns A formatted verdict, or an error message
   */
  @CreateAction({
    name: "get_token_verdict",
    description: `
This tool fetches a Token Verdict from Edge Signals, an optional pre-trade token risk check.

Use it BEFORE swapping, transferring, bridging, or otherwise interacting with an unknown ERC-20.
It returns a letter grade (A–F), a band (SAFE, CAUTION, or AVOID), a score from 0–100, and human-readable reasons that combine honeypot/security scanners, on-chain metadata, and liquidity signals.

This call is paid. It costs ${TOKEN_VERDICT_PRICE_USDC} USDC on Base, charged to the agent's wallet via the x402 protocol. There is no API key. Do not retry a successful call just to refresh the verdict; each call is paid.

Inputs:
- token: the ERC-20 contract address (required)
- chain: the chain the token is on (optional, defaults to base)

This is not financial advice. If the band is AVOID, do not swap the token without additional independent review.
`,
    schema: TokenVerdictSchema,
  })
  async getTokenVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenVerdictSchema>,
  ): Promise<string> {
    const chain = args.chain ?? DEFAULT_TOKEN_CHAIN;
    const url = buildTokenVerdictUrl(args.token, chain, this.baseUrl);

    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return (
          "Error: Token Verdict payments require an EVM wallet funded with USDC on Base. " +
          "The current wallet provider is not an EVM wallet."
        );
      }

      const client = this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(url, { method: "GET" });

      if (!response.ok) {
        let details = "";
        try {
          details = await response.text();
        } catch {
          details = "";
        }
        return `Error fetching Token Verdict for ${args.token} on ${chain}: HTTP ${response.status}${details ? ` — ${details}` : ""}`;
      }

      let data: TokenVerdictResponse;
      try {
        data = (await response.json()) as TokenVerdictResponse;
      } catch (jsonError) {
        return `Error fetching Token Verdict for ${args.token} on ${chain}: Failed to parse API response: ${
          jsonError instanceof Error ? jsonError.message : String(jsonError)
        }`;
      }

      return formatTokenVerdict(data, args.token, chain);
    } catch (error) {
      return `Error fetching Token Verdict for ${args.token} on ${chain}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Token Verdict is paid in USDC on Base mainnet, so this provider is only
   * offered when the agent's wallet is on Base.
   *
   * @param network - The wallet's current network
   * @returns Whether the provider should be enabled
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (network.chainId === "8453" ||
      network.networkId === "base-mainnet" ||
      network.networkId === "base");

  /**
   * Creates an x402 client that signs payments with the agent's EVM wallet.
   *
   * @param walletProvider - The wallet provider to configure the client for
   * @returns Configured x402Client
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
}

/**
 * Factory function to create a new EdgeSignalsActionProvider instance.
 *
 * @param config - Optional configuration
 * @returns A new instance of EdgeSignalsActionProvider
 */
export const edgeSignalsActionProvider = (config: EdgeSignalsActionProviderConfig = {}) =>
  new EdgeSignalsActionProvider(config);
