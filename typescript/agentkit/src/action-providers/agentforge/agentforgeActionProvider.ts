import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CheckAddressesSchema,
  LendingHealthSchema,
  NewLaunchesSchema,
  ScoreTokensSchema,
  SimulateTransactionSchema,
  TokenCheckSchema,
} from "./schemas";
import { AGENTFORGE_BASE_URL, DEFAULT_MAX_PAYMENT_USDC } from "./constants";

/**
 * Configuration for the AgentForge action provider.
 */
export interface AgentForgeActionProviderConfig {
  /**
   * Refuse any single payment above this many USDC. Defaults to the
   * AGENTFORGE_MAX_PAYMENT_USDC env var, then 0.05.
   */
  maxPaymentUsdc?: number;
  /** Override the API origin (tests, self-hosting). */
  baseUrl?: string;
}

/**
 * AgentForgeActionProvider gives agents DeFi safety checks from AgentForge,
 * paid per call in USDC on Base over x402 from the agent's own wallet:
 * pre-sign transaction simulation, counterparty sanctions/scam screening,
 * pre-trade token checks, a risk-scored new-launch feed, batch rug checks,
 * and Aave liquidation risk. No API key is needed.
 */
export class AgentForgeActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly maxPaymentUsdc: number;
  private readonly baseUrl: string;

  /**
   * Constructor for the AgentForgeActionProvider class.
   *
   * @param config - The configuration options for the AgentForgeActionProvider
   */
  constructor(config: AgentForgeActionProviderConfig = {}) {
    super("agentforge", []);
    const envMax = parseFloat(process.env.AGENTFORGE_MAX_PAYMENT_USDC ?? "");
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ?? (Number.isFinite(envMax) ? envMax : DEFAULT_MAX_PAYMENT_USDC);
    this.baseUrl = (config.baseUrl ?? AGENTFORGE_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Simulates transactions before the agent signs them.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - The transactions to simulate
   * @returns A JSON string with the simulation result or an error
   */
  @CreateAction({
    name: "simulate_transaction",
    description: `
This tool simulates one or more EVM transactions BEFORE the agent signs them, using AgentForge.
It returns: whether each call reverts (with the decoded reason), the net change of every asset for the sender
(native, ERC-20, ERC-721, ERC-1155), approvals granted, sanctions/scam/fresh-address screening of every
counterparty, and a verdict of proceed, caution, or avoid.

Use it before signing any transaction that moves funds or grants approvals. If the verdict is "avoid", do not
sign, and tell the user the reasons. "from" defaults to the agent's own wallet.

Costs $0.005 USDC, paid from the agent's wallet on Base.`,
    schema: SimulateTransactionSchema,
  })
  async simulateTransaction(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SimulateTransactionSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "POST", "/v1/tx-simulate", {
      chain: args.chain,
      from: args.from ?? walletProvider.getAddress(),
      transactions: args.transactions,
    });
  }

  /**
   * Screens counterparty addresses against sanctions and scam lists.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - The addresses to screen
   * @returns A JSON string with a verdict per address or an error
   */
  @CreateAction({
    name: "check_addresses",
    description: `
This tool screens 1-100 addresses (EVM or Solana) before the agent sends funds to them or grants them approvals,
using AgentForge. It checks OFAC sanctions lists, known scam and phishing wallets, labeled protocol contracts,
and brand-new wallets typical of address-poisoning attacks.

Each address gets a verdict: "block" (do not transact), "caution", or "no_known_issues".

Costs $0.003 for one address plus $0.001 per additional address, paid in USDC on Base.`,
    schema: CheckAddressesSchema,
  })
  async checkAddresses(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckAddressesSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "POST", "/v1/address-check", {
      chain: args.chain,
      addresses: args.addresses.map(address => ({ address })),
    });
  }

  /**
   * Checks a token before the agent buys it.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - The token to check
   * @returns A JSON string with the risk verdict or an error
   */
  @CreateAction({
    name: "check_token_before_trade",
    description: `
This tool checks an ERC-20 token before the agent buys it, using AgentForge. It combines a quantitative rug check
(owner mint/blacklist/pause powers, upgradeability, liquidity depth), an AI risk assessment with market data,
and current gas, and returns a verdict of proceed, caution, or avoid with reasons.

Use it before any swap into a token the agent has not checked recently.

Costs $0.025 USDC, paid from the agent's wallet on Base.`,
    schema: TokenCheckSchema,
  })
  async checkTokenBeforeTrade(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenCheckSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "POST", "/v1/trade-check", {
      address: args.tokenAddress,
      chain: args.chain,
    });
  }

  /**
   * Lists newly launched tokens with risk scores.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - Feed filters
   * @returns A JSON string with launches and nextSince, or an error
   */
  @CreateAction({
    name: "get_new_token_launches",
    description: `
This tool lists tokens that just launched on Base, Ethereum, or Arbitrum, each already risk-scored by AgentForge
(contract verification, owner mint/blacklist/tax/pause powers, upgradeable proxy, share of supply held outside the
liquidity pool, thin liquidity, and the buys-without-sells honeypot pattern).

To poll for new launches only, pass the previous response's "nextSince" as "since". Use maxRiskScore to filter
out risky launches. Always run check_token_before_trade before buying any of them.

Costs $0.005 USDC, paid from the agent's wallet on Base.`,
    schema: NewLaunchesSchema,
  })
  async getNewTokenLaunches(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof NewLaunchesSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "GET", "/v1/launches", args);
  }

  /**
   * Rug-checks a list of tokens in one call.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - The tokens to score
   * @returns A JSON string with per-token risk scores or an error
   */
  @CreateAction({
    name: "score_tokens",
    description: `
This tool rug-checks 2-25 ERC-20 tokens in one call using AgentForge, returning for each a 0-100 risk score,
risk level, flags, and whether the owner can mint, blacklist, pause, or upgrade, plus the riskiest tokens first.

Use it to screen a watchlist or a set of candidate trades at once.

Costs $0.004 USDC per token, paid from the agent's wallet on Base.`,
    schema: ScoreTokensSchema,
  })
  async scoreTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScoreTokensSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "POST", "/v1/risk-batch", {
      chain: args.chain,
      tokens: args.tokenAddresses.map(address => ({ address })),
    });
  }

  /**
   * Reports Aave v3 liquidation risk for a wallet.
   *
   * @param walletProvider - The wallet provider that pays for the call
   * @param args - The wallet and chain to check
   * @returns A JSON string with positions and health factors, or an error
   */
  @CreateAction({
    name: "check_lending_health",
    description: `
This tool reports how close a wallet is to liquidation on Aave v3, across Ethereum, Base, Arbitrum, Optimism, and
Polygon in one call, using AgentForge: collateral, debt, health factor, a status (safe, watch, danger, critical,
liquidatable), and roughly how far collateral can fall before liquidation. "address" defaults to the agent's wallet.

Costs $0.003 USDC, paid from the agent's wallet on Base.`,
    schema: LendingHealthSchema,
  })
  async checkLendingHealth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof LendingHealthSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "GET", "/v1/lending/health", {
      address: args.address ?? walletProvider.getAddress(),
      chain: args.chain,
    });
  }

  /**
   * Payments settle in USDC on Base mainnet.
   *
   * @param network - The network to check support for
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network) => network.networkId === "base-mainnet";

  /**
   * Makes an x402-paid request to AgentForge from the agent's wallet.
   *
   * @param walletProvider - The wallet provider that signs the payment
   * @param method - HTTP method
   * @param path - API path
   * @param input - Query parameters (GET) or JSON body (POST)
   * @returns The JSON response as a string, or a JSON error object
   */
  private async call(
    walletProvider: EvmWalletProvider,
    method: "GET" | "POST",
    path: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    try {
      const client = new x402Client();
      registerExactEvmScheme(client, { signer: walletProvider.toSigner() });
      // Drop any payment option above the cap before anything is signed.
      // USDC has 6 decimals; amounts are atomic units.
      const maxAtomic = BigInt(Math.round(this.maxPaymentUsdc * 1e6));
      client.registerPolicy((_version, requirements) =>
        requirements.filter(r => BigInt(r.amount) <= maxAtomic),
      );
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      let url = `${this.baseUrl}${path}`;
      const init: RequestInit = { method, headers: { Accept: "application/json" } };
      if (method === "GET") {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(input)) {
          if (value !== undefined && value !== null) params.set(key, String(value));
        }
        const query = params.toString();
        if (query) url += `?${query}`;
      } else {
        init.body = JSON.stringify(input);
        (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      }

      const response = await fetchWithPayment(url, init);
      const text = await response.text();
      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            status: response.status,
            message: `AgentForge request failed with status ${response.status}`,
            details: text.slice(0, 2000),
          },
          null,
          2,
        );
      }
      return text;
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "AgentForge request failed",
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }
}

export const agentforgeActionProvider = (config?: AgentForgeActionProviderConfig) =>
  new AgentForgeActionProvider(config);
