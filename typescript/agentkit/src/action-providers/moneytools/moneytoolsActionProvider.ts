import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { MoneyToolsConfig, TokenInfoSchema, TokenSafetySchema, WalletRiskSchema } from "./schemas";

const DEFAULT_BASE_URL = "https://tools.moneytools.dev";
const BASE_MAINNET_CAIP2 = "eip155:8453";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

interface PaymentTerms {
  amount: string;
  network: string;
  asset: string;
  payTo: string;
}

/**
 * MoneyToolsActionProvider exposes read-only onchain safety checks from MoneyTools
 * (https://tools.moneytools.dev), paid per call over x402 in USDC on Base:
 * a wallet risk card ($0.02), an ERC-20 honeypot / sell-tax simulation ($0.005)
 * and ERC-20 contract facts ($0.005). The token checks have a small free daily tier.
 *
 * Payments are only signed when the wallet is an EVM wallet on base-mainnet and the
 * quoted price is USDC on Base at or below `maxPaymentUsdc`.
 */
export class MoneyToolsActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Creates a new MoneyToolsActionProvider.
   *
   * @param config - Optional configuration.
   */
  constructor(config: MoneyToolsConfig = {}) {
    super("moneytools", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? 0.02;
  }

  /**
   * Gets a wallet risk card for an address.
   *
   * @param walletProvider - The wallet provider used to pay over x402.
   * @param args - The address and chain.
   * @returns JSON string with the risk card or the payment terms.
   */
  @CreateAction({
    name: "wallet_risk_card",
    description: `Score an EVM wallet before paying, trusting or interacting with it.
Returns a 0-100 risk score, an A-F grade, whether the address is on the OFAC SDN list,
address checks (contract, EIP-7702 delegation, burn/zero) and a summary of open ERC-20 approvals.
Costs 0.02 USDC on Base, paid over x402 from the agent wallet. Read-only.

Inputs:
- address: 0x address or ENS name
- chain: base, ethereum, arbitrum, optimism, polygon, bsc or avalanche (default base)`,
    schema: WalletRiskSchema,
  })
  async walletRiskCard(
    walletProvider: WalletProvider,
    args: z.infer<typeof WalletRiskSchema>,
  ): Promise<string> {
    return this.call(walletProvider, "/v1/wallet-risk", {
      address: args.address,
      chain: args.chain ?? "base",
    });
  }

  /**
   * Simulates a round trip trade on an ERC-20 to detect honeypots and sell taxes.
   *
   * @param walletProvider - The wallet provider used to pay over x402.
   * @param args - The token, chain and notional size.
   * @returns JSON string with the safety verdict or the payment terms.
   */
  @CreateAction({
    name: "token_safety_check",
    description: `Check an ERC-20 before buying it: simulates a USDC -> token -> USDC round trip with live DEX
quotes and reads owner / proxy / paused state to flag honeypots, high sell taxes and admin risk.
Free for the first calls each day, then 0.005 USDC on Base over x402. Read-only.

Inputs:
- token: ERC-20 address
- chain: base, ethereum, arbitrum, optimism, polygon, bsc or avalanche (default base)
- usd: notional size for the simulation (default 10)`,
    schema: TokenSafetySchema,
  })
  async tokenSafetyCheck(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenSafetySchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      "/v1/token-safety",
      { token: args.token, chain: args.chain ?? "base", usd: String(args.usd ?? 10) },
      true,
    );
  }

  /**
   * Reads ERC-20 contract facts.
   *
   * @param walletProvider - The wallet provider used to pay over x402.
   * @param args - The token and chain.
   * @returns JSON string with the token facts or the payment terms.
   */
  @CreateAction({
    name: "token_contract_info",
    description: `Read ERC-20 contract facts: name, symbol, decimals, total supply, owner, paused state
and upgradeable-proxy detection. Free for the first calls each day, then 0.005 USDC on Base over x402.

Inputs:
- token: ERC-20 address
- chain: base, ethereum, arbitrum, optimism, polygon, bsc or avalanche (default base)`,
    schema: TokenInfoSchema,
  })
  async tokenContractInfo(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenInfoSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      "/v1/token",
      { token: args.token, chain: args.chain ?? "base" },
      true,
    );
  }

  /**
   * The checks read many EVM chains; payment needs base-mainnet, which is enforced per call.
   *
   * @param _ - The network.
   * @returns Always true.
   */
  supportsNetwork = (_: Network) => true;

  /**
   * Performs an unpaid request, then pays the 402 only when the terms are acceptable.
   *
   * @param walletProvider - The wallet provider.
   * @param path - API path.
   * @param query - Query parameters.
   * @param freeTier - Whether to request the free daily tier.
   * @returns JSON string result.
   */
  private async call(
    walletProvider: WalletProvider,
    path: string,
    query: Record<string, string>,
    freeTier = false,
  ): Promise<string> {
    const url = `${this.baseUrl}${path}?${new URLSearchParams(query).toString()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (freeTier) headers["X-MoneyTools-Free"] = "1";

    try {
      const first = await fetch(url, { headers });
      if (first.status !== 402) return this.format(first);

      const terms = this.readTerms(first, await first.json().catch(() => ({})));
      const refusal = this.checkTerms(walletProvider, terms);
      if (refusal) {
        return JSON.stringify({ success: false, paymentRequired: true, terms, error: refusal });
      }

      const client = new x402Client();
      const evm = walletProvider as EvmWalletProvider;
      const account = evm.toSigner();
      registerExactEvmScheme(client, {
        signer: {
          ...account,
          readContract: (a: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args?: readonly unknown[];
          }) =>
            evm.readContract({
              address: a.address,
              abi: a.abi as never,
              functionName: a.functionName as never,
              args: a.args as never,
            }),
        },
      });
      const paidFetch = wrapFetchWithPayment(fetch, client);
      return this.format(await paidFetch(url, { headers: { Accept: "application/json" } }));
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `MoneyTools request failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Decodes the x402 payment terms from the 402 response.
   *
   * @param res - The 402 response.
   * @param body - The parsed body.
   * @returns The first accepted payment option, if any.
   */
  private readTerms(res: Response, body: unknown): PaymentTerms | undefined {
    let req = body as { accepts?: Array<Record<string, string>> };
    const header = res.headers.get("payment-required");
    if (header) {
      try {
        req = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      } catch {
        // fall back to the JSON body
      }
    }
    const a = req?.accepts?.[0];
    if (!a) return undefined;
    return {
      amount: a.amount ?? a.maxAmountRequired,
      network: a.network,
      asset: a.asset,
      payTo: a.payTo,
    };
  }

  /**
   * Returns a reason to refuse payment, or undefined when payment may proceed.
   *
   * @param walletProvider - The wallet provider.
   * @param terms - The decoded terms.
   * @returns Refusal reason or undefined.
   */
  private checkTerms(walletProvider: WalletProvider, terms?: PaymentTerms): string | undefined {
    if (!(walletProvider instanceof EvmWalletProvider)) return "x402 payment needs an EVM wallet";
    if (walletProvider.getNetwork().networkId !== "base-mainnet") {
      return "x402 payment needs a wallet on base-mainnet";
    }
    if (!terms) return "could not read the x402 payment terms";
    if (terms.network !== BASE_MAINNET_CAIP2 || terms.asset?.toLowerCase() !== USDC_BASE) {
      return "quote is not USDC on Base; not paying";
    }
    const usdc = Number(terms.amount) / 1e6;
    if (!Number.isFinite(usdc) || usdc > this.maxPaymentUsdc) {
      return `quoted ${usdc} USDC exceeds maxPaymentUsdc ${this.maxPaymentUsdc}; not paying`;
    }
    return undefined;
  }

  /**
   * Formats a final response.
   *
   * @param res - The response.
   * @returns JSON string.
   */
  private async format(res: Response): Promise<string> {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    delete data._sponsored; // keep tool output to the requested data only
    if (res.ok) return JSON.stringify({ success: true, data });
    return JSON.stringify({
      success: false,
      status: res.status,
      error: (data as { error?: string }).error ?? `HTTP ${res.status}`,
      details: data,
    });
  }
}

export const moneytoolsActionProvider = (config?: MoneyToolsConfig) =>
  new MoneyToolsActionProvider(config);
