import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  ScreenNameSchema,
  ScreenWalletSchema,
  CheckEmailSchema,
  CheckIpSchema,
  ListsCoverageSchema,
  PayPerScreenConfig,
} from "./schemas";
import {
  PAYPERSCREEN_API_URL,
  PAYPERSCREEN_CHECK_PRICE_USD,
  RESULT_NOTE,
  USDC_BY_NETWORK,
} from "./constants";

const CLIENT_TAG = "payperscreen-agentkit/coinbase-agentkit";

type PaymentRequirement = {
  network: string;
  asset?: string;
  amount?: string;
  maxAmountRequired?: string;
};

/**
 * Reads the atomic USDC amount from a payment requirement.
 *
 * @param requirement - An x402 payment requirement.
 * @returns The amount in atomic units (6 decimals), or -1 if missing or invalid.
 */
function atomicAmount(requirement: PaymentRequirement): bigint {
  try {
    return BigInt(requirement.amount ?? requirement.maxAmountRequired ?? "-1");
  } catch {
    return -1n;
  }
}

/**
 * Converts an atomic USDC amount to USD.
 *
 * @param atomic - Amount in atomic units (6 decimals).
 * @returns The amount in USD.
 */
function toUsd(atomic: bigint): number {
  return Number(atomic) / 1e6;
}

/**
 * PayPerScreenActionProvider screens people, companies, crypto wallets, email addresses and IP
 * addresses before an agent pays, onboards or trades. Each paid check costs $0.02 in USDC and is
 * paid by the agent's own wallet over x402 (no account or API key), within per-check and total
 * spending caps.
 */
export class PayPerScreenActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiUrl: string;
  private readonly maxPriceUsd: number;
  private readonly maxSpendUsd: number;
  private spentUsd = 0;

  /**
   * Creates a new PayPerScreenActionProvider.
   *
   * @param config - Optional API URL and spending caps.
   */
  constructor(config: PayPerScreenConfig = {}) {
    super("payperscreen", []);
    this.apiUrl = (
      config.apiUrl ??
      process.env.PAYPERSCREEN_API_URL ??
      PAYPERSCREEN_API_URL
    ).replace(/\/$/, "");
    this.maxPriceUsd = config.maxPriceUsd ?? Number(process.env.PAYPERSCREEN_MAX_PRICE_USD ?? 0.05);
    this.maxSpendUsd = config.maxSpendUsd ?? Number(process.env.PAYPERSCREEN_MAX_SPEND_USD ?? 1);
  }

  /**
   * Screens a person or company name against sanctions and export-control lists.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - Name, and optionally date of birth, country, type, threshold and limit.
   * @returns JSON string with the screening result and payment receipt.
   */
  @CreateAction({
    name: "screen_name",
    description: `
Screen a person or company against official government sanctions and export-control lists (US, UN, EU, UK and more,
refreshed daily) before onboarding, paying or trading with them. Fuzzy matching across spellings, aliases and word order.

Each possible match returns the listed name, match score, list, record ID, programmes and a comparison of the date of
birth, nationality and type you pass against the listed record, which helps rule out namesakes. Pass dob and country
whenever you know them.

Costs $0.02 in USDC, paid automatically from the agent's wallet. A possible match is for a person to review, not proof.`,
    schema: ScreenNameSchema,
  })
  async screenName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenNameSchema>,
  ): Promise<string> {
    return this.paidRequest(walletProvider, "/screen", args);
  }

  /**
   * Screens a crypto wallet address against sanctioned, frozen and hack-linked addresses.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - The address to screen.
   * @returns JSON string with the screening result and payment receipt.
   */
  @CreateAction({
    name: "screen_wallet",
    description: `
Check a crypto wallet address before sending or accepting funds: OFAC-sanctioned addresses (a hit names the sanctioned
party), wallets frozen by the stablecoin issuer, and wallets publicly tied to major hacks. Exact match; each source is
reported separately. Works for Bitcoin, Ethereum/EVM, Tron, Solana and more.

Costs $0.02 in USDC, paid automatically from the agent's wallet.`,
    schema: ScreenWalletSchema,
  })
  async screenWallet(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenWalletSchema>,
  ): Promise<string> {
    return this.paidRequest(walletProvider, "/screen-address", args);
  }

  /**
   * Checks an email address for fraud and trust signals.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - The email address to check.
   * @returns JSON string with the risk level, signals and payment receipt.
   */
  @CreateAction({
    name: "check_email",
    description: `
Assess an email address for signup or payout fraud: working mailbox, disposable or brand-new domain, lookalike domains,
role accounts and more. Returns low, medium or high risk with each signal explained.

Costs $0.02 in USDC, paid automatically from the agent's wallet.`,
    schema: CheckEmailSchema,
  })
  async checkEmail(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckEmailSchema>,
  ): Promise<string> {
    return this.paidRequest(walletProvider, "/screen-email", args);
  }

  /**
   * Checks an IP address for sanctioned-country, VPN, proxy, Tor and hosting signals.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - The IP address to check.
   * @returns JSON string with the country, network owner, signals and payment receipt.
   */
  @CreateAction({
    name: "check_ip",
    description: `
Check a public IPv4 or IPv6 address: is it in an embargoed or heavily sanctioned country, a VPN, an anonymous proxy,
a Tor exit node, a botnet control server, or a cloud or hosting network? Returns the country and network owner.

Costs $0.02 in USDC, paid automatically from the agent's wallet.`,
    schema: CheckIpSchema,
  })
  async checkIp(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckIpSchema>,
  ): Promise<string> {
    return this.paidRequest(walletProvider, "/screen-ip", args);
  }

  /**
   * Lists the screening sources, their record counts and last refresh (free).
   *
   * @param _walletProvider - Unused.
   * @param _args - No arguments.
   * @returns JSON string with the list coverage.
   */
  @CreateAction({
    name: "screening_lists_coverage",
    description: `
Free. Which sanctions, export-control and wallet lists PayPerScreen checks, how many records each has, and when each was
last refreshed. Use it to tell a user exactly what a screening covered.`,
    schema: ListsCoverageSchema,
  })
  async listsCoverage(
    _walletProvider: EvmWalletProvider,
    _args: z.infer<typeof ListsCoverageSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/lists-meta`, { headers: this.headers() });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        return JSON.stringify({
          success: false,
          status: response.status,
          error: body ?? "Request failed",
        });
      }
      return JSON.stringify({ success: true, data: body });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Could not reach PayPerScreen: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the action provider supports the given network. Payment is made in USDC on Base,
   * Polygon or Arbitrum, so any EVM wallet is supported.
   *
   * @param network - The network to check.
   * @returns True for EVM networks.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Request headers sent to the PayPerScreen API.
   *
   * @returns The headers.
   */
  private headers(): Record<string, string> {
    return { accept: "application/json", "x-payperscreen-client": CLIENT_TAG };
  }

  /**
   * Calls a paid endpoint, paying the x402 402 response automatically within the per-check price
   * cap and the total spending cap. Only USDC payment options are ever signed.
   *
   * @param walletProvider - The wallet that pays.
   * @param path - API path, e.g. /screen.
   * @param params - Query parameters.
   * @returns JSON string with the result, or an error explaining why nothing was charged.
   */
  private async paidRequest(
    walletProvider: EvmWalletProvider,
    path: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    if (this.spentUsd + PAYPERSCREEN_CHECK_PRICE_USD > this.maxSpendUsd + 1e-9) {
      return JSON.stringify({
        success: false,
        error: `Spending cap reached: $${this.spentUsd.toFixed(2)} of $${this.maxSpendUsd.toFixed(2)} spent. Nothing was charged.`,
      });
    }

    let refused: string | null = null;
    let quoted = 0n;
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

    const maxAtomic = BigInt(Math.round(this.maxPriceUsd * 1e6));
    const leftAtomic = BigInt(Math.round((this.maxSpendUsd - this.spentUsd) * 1e6));
    const preferred = `eip155:${walletProvider.getNetwork().chainId ?? ""}`;
    client.registerPolicy(((_version: number, requirements: PaymentRequirement[]) => {
      const usdc = requirements.filter(
        r =>
          USDC_BY_NETWORK[r.network] &&
          String(r.asset ?? "").toLowerCase() === USDC_BY_NETWORK[r.network],
      );
      const affordable = usdc.filter(r => {
        const amount = atomicAmount(r);
        return amount >= 0n && amount <= maxAtomic && amount <= leftAtomic;
      });
      if (!affordable.length) {
        const cheapest = usdc
          .map(atomicAmount)
          .filter(a => a >= 0n)
          .sort((x, y) => (x < y ? -1 : 1))[0];
        refused =
          cheapest === undefined
            ? "No USDC payment option was offered."
            : cheapest > maxAtomic
              ? `The price ($${toUsd(cheapest).toFixed(4)}) is above this agent's per-check cap ($${this.maxPriceUsd.toFixed(2)}).`
              : `Spending cap reached: $${this.spentUsd.toFixed(2)} of $${this.maxSpendUsd.toFixed(2)} spent.`;
        return [];
      }
      // Pay on the wallet's own network when offered, otherwise the first affordable option.
      const chosen = affordable.find(r => r.network === preferred) ?? affordable[0];
      quoted = atomicAmount(chosen);
      return [chosen, ...affordable.filter(r => r !== chosen)];
    }) as never);

    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    const url = `${this.apiUrl}${path}${query ? `?${query}` : ""}`;

    try {
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(url, { method: "GET", headers: this.headers() });
      const data = await response.json().catch(() => null);
      if (response.status !== 200) {
        return JSON.stringify({
          success: false,
          status: response.status,
          error:
            (data as { error?: string } | null)?.error ??
            `Request failed with status ${response.status}`,
          detail: data,
          charged: false,
        });
      }

      const receiptHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
      let receipt: Record<string, unknown> | null = null;
      if (receiptHeader) {
        try {
          receipt = JSON.parse(Buffer.from(receiptHeader, "base64").toString("utf8"));
        } catch {
          receipt = null;
        }
      }
      const paidUsd = quoted > 0n ? toUsd(quoted) : PAYPERSCREEN_CHECK_PRICE_USD;
      this.spentUsd += paidUsd;
      return JSON.stringify({
        success: true,
        result: data,
        payment: {
          paidUsd,
          network: receipt?.network ?? null,
          transaction: receipt?.transaction ?? null,
          spentThisSessionUsd: Number(this.spentUsd.toFixed(4)),
          capUsd: this.maxSpendUsd,
        },
        note: RESULT_NOTE,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error:
          refused ??
          `Could not complete the check: ${error instanceof Error ? error.message : String(error)}`,
        charged: false,
      });
    }
  }
}

/**
 * Creates a PayPerScreen action provider.
 *
 * @param config - Optional API URL and spending caps.
 * @returns A new PayPerScreenActionProvider.
 */
export const payperscreenActionProvider = (config?: PayPerScreenConfig) =>
  new PayPerScreenActionProvider(config);
