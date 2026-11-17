import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  AgentDataApisConfig,
  CheckCounterpartySchema,
  CheckTokenRiskSchema,
  ScreenSanctionsSchema,
} from "./schemas";

export const DEFAULT_GUARD_BASE_URL = "https://agent-payment-guard.agent-data-apis.workers.dev";
export const DEFAULT_SANCTIONS_BASE_URL = "https://sanctions-screen.agent-data-apis.workers.dev";
/** USDC on Base mainnet: the only asset these services accept. */
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/**
 * AgentDataApisActionProvider gives agents pre-trade and pre-payment safety checks from
 * Agent Data APIs: token honeypot/tax simulation, recipient (counterparty) screening against
 * sanctioned crypto addresses, and sanctions name screening. Each check is paid per call
 * with x402 (USDC on Base) from the agent's own wallet; no API key is needed.
 */
export class AgentDataApisActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly maxPaymentUsdc: number;
  private readonly guardBaseUrl: string;
  private readonly sanctionsBaseUrl: string;

  /**
   * Creates a new AgentDataApisActionProvider.
   *
   * @param config - Optional spending limit and base URL overrides
   */
  constructor(config: AgentDataApisConfig = {}) {
    super("agent_data_apis", []);
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ?? parseFloat(process.env.AGENT_DATA_APIS_MAX_PAYMENT_USDC ?? "0.05");
    this.guardBaseUrl = (config.guardBaseUrl ?? DEFAULT_GUARD_BASE_URL).replace(/\/$/, "");
    this.sanctionsBaseUrl = (config.sanctionsBaseUrl ?? DEFAULT_SANCTIONS_BASE_URL).replace(
      /\/$/,
      "",
    );
  }

  /**
   * Checks a token before the agent trades it.
   *
   * @param walletProvider - The wallet used to pay for the check
   * @param args - The token address and chain
   * @returns A JSON string with the verdict, signals, simulation results and a signed receipt
   */
  @CreateAction({
    name: "check_token_risk",
    description: `
This tool checks an ERC-20 token for scams BEFORE the agent buys, swaps into, or accepts it.
It simulates a real buy and sell through Uniswap V2 (Base, Ethereum) to detect honeypots
(tokens that cannot be sold) and the actual buy/sell tax, and checks owner powers (mint, pause,
blacklist, fee changes, trading switch), upgradeable proxies, liquidity depth and sanctioned owners.

Inputs:
- tokenAddress: the token contract address (0x...)
- chain: base (default), ethereum, arbitrum, optimism or polygon

Output: verdict "avoid", "caution" or "ok", a list of signals with severity, simulation details
(buy_tax_pct, sell_tax_pct) and a signed receipt.

Important:
- If the verdict is "avoid", do NOT trade the token; tell the user why.
- If the verdict is "caution", explain the signals to the user before trading.
- Each check costs about $0.01 in USDC on Base, paid automatically from the wallet.
`,
    schema: CheckTokenRiskSchema,
  })
  async checkTokenRisk(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckTokenRiskSchema>,
  ): Promise<string> {
    const url = `${this.guardBaseUrl}/v1/token?address=${args.tokenAddress}&chain=${args.chain}`;
    return this.paidGet(walletProvider, url);
  }

  /**
   * Checks a recipient before the agent sends funds.
   *
   * @param walletProvider - The wallet used to pay for the check
   * @param args - The recipient address, chain and optional counterparty name
   * @returns A JSON string with the verdict, signals and a signed receipt
   */
  @CreateAction({
    name: "check_payment_counterparty",
    description: `
This tool checks a recipient address BEFORE the agent sends it money (including x402 payTo addresses).
It reports whether the address is a sanctioned crypto address (OFAC, UK and EU lists; BTC, ETH, TRX,
USDT and more), whether it is a known x402 seller (endpoints, 30-day paid calls and unique payers),
live on-chain facts, and optionally sanctions-screens the counterparty's name.

Inputs:
- address: the recipient wallet address
- chain: base (default), ethereum, arbitrum, optimism or polygon (for live on-chain facts)
- counterpartyName: optional person or company name of the recipient

Output: verdict "block", "review" or "clear", signals with severity, and a signed receipt.

Important:
- If the verdict is "block", do NOT send the payment; tell the user the address is sanctioned.
- If the verdict is "review", ask the user to confirm before paying.
- Each check costs about $0.005 in USDC on Base, paid automatically from the wallet.
`,
    schema: CheckCounterpartySchema,
  })
  async checkPaymentCounterparty(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckCounterpartySchema>,
  ): Promise<string> {
    const params = new URLSearchParams({ address: args.address, chain: args.chain });
    if (args.counterpartyName) params.set("name", args.counterpartyName);
    return this.paidGet(walletProvider, `${this.guardBaseUrl}/v1/check?${params.toString()}`);
  }

  /**
   * Screens a name against sanctions lists.
   *
   * @param walletProvider - The wallet used to pay for the check
   * @param args - The name and optional entity type
   * @returns A JSON string with scored candidate matches
   */
  @CreateAction({
    name: "screen_sanctions",
    description: `
This tool screens a person, company, vessel or aircraft name against official sanctions lists:
US OFAC (SDN and Consolidated), UN Security Council, EU and UK. Fuzzy matching handles typos,
transliterations, reordered names and aliases.

Inputs:
- name: the name to screen, e.g. "Sovcomflot"
- entityType: optional filter: individual, entity, vessel or aircraft

Output: potential_match (true/false), highest_score and scored candidate matches with programs,
countries, dates of birth and list references. Matches are candidates, not determinations.
Each check costs about $0.01 in USDC on Base, paid automatically from the wallet.
`,
    schema: ScreenSanctionsSchema,
  })
  async screenSanctions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenSanctionsSchema>,
  ): Promise<string> {
    const params = new URLSearchParams({ name: args.name });
    if (args.entityType) params.set("type", args.entityType);
    return this.paidGet(walletProvider, `${this.sanctionsBaseUrl}/v1/screen?${params.toString()}`);
  }

  /**
   * Payment requires USDC on Base mainnet.
   *
   * @param network - The network to check
   * @returns True if the wallet is on Base mainnet
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  /**
   * GETs a paid endpoint: reads the price from the 402 challenge, enforces the spending limit,
   * then pays with x402 and returns the JSON result.
   *
   * @param walletProvider - The wallet used to pay
   * @param url - The full endpoint URL
   * @returns The JSON response as a string, or an error message
   */
  private async paidGet(walletProvider: EvmWalletProvider, url: string): Promise<string> {
    try {
      const probe = await fetch(url);
      if (probe.ok) return JSON.stringify(await probe.json(), null, 2);
      if (probe.status !== 402) {
        return `Error: request failed with status ${probe.status}: ${await probe.text()}`;
      }

      const price = this.readPriceUsdc(probe);
      if (price === null) {
        return "Error: could not read a USDC-on-Base price from the payment challenge; not paying.";
      }
      if (price > this.maxPaymentUsdc) {
        return `Error: the check costs ${price} USDC, above the configured limit of ${this.maxPaymentUsdc} USDC; not paying.`;
      }

      const client = new x402Client();
      const account = walletProvider.toSigner();
      registerExactEvmScheme(client, {
        signer: {
          ...account,
          readContract: (a: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args?: readonly unknown[];
          }) =>
            walletProvider.readContract({
              address: a.address,
              abi: a.abi as never,
              functionName: a.functionName as never,
              args: a.args as never,
            }),
        },
      });
      const response = await wrapFetchWithPayment(fetch, client)(url);
      if (!response.ok) {
        return `Error: paid request failed with status ${response.status}: ${await response.text()}`;
      }
      return JSON.stringify({ ...(await response.json()), paid_usdc: price }, null, 2);
    } catch (error) {
      return `Error calling Agent Data APIs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Extracts the USDC (Base) price from an x402 v2 PAYMENT-REQUIRED header.
   *
   * @param response - The 402 response
   * @returns The price in USDC, or null if no USDC-on-Base option is offered
   */
  private readPriceUsdc(response: Response): number | null {
    const header = response.headers.get("payment-required");
    if (!header) return null;
    try {
      const challenge = JSON.parse(atob(header)) as {
        accepts?: { network?: string; asset?: string; amount?: string }[];
      };
      const option = (challenge.accepts ?? []).find(
        a => a.network === "eip155:8453" && a.asset?.toLowerCase() === BASE_USDC,
      );
      return option?.amount ? Number(option.amount) / 1e6 : null;
    } catch {
      return null;
    }
  }
}

export const agentDataApisActionProvider = (config?: AgentDataApisConfig) =>
  new AgentDataApisActionProvider(config);
