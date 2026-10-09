import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { Network } from "../../network";
import { CheckPayeeSchema, PreflightPaymentSchema, SpendPreflightConfig } from "./schemas";

const API = "https://api.spendpreflight.com";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const SCREENING_PAYEE = "0xbf4164e07552e4c1b1b1597e72c7acaa3f0a1c58";

/** Informational screening; pays only its disclosed screening fee, never a reviewed merchant. */
export class SpendPreflightActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs the provider with optional free-trial access.
   *
   * @param config - Agent-operator configuration.
   */
  constructor(private readonly config: SpendPreflightConfig = {}) {
    super("spendpreflight", []);
  }

  /**
   * Screens merchant identifiers against OFAC and domain signals.
   *
   * @param walletProvider - The existing agent wallet paying only the screening fee.
   * @param args - Merchant identifiers.
   * @returns The informational result as JSON, or a fail-safe error.
   */
  @CreateAction({
    name: "check_payee",
    description: `Operated by SpendPreflight. Before paying, screen a merchant wallet/name against OFAC SDN and a domain's age/DNS.
Inputs: address (EVM wallet), name (payee name), or domain; supply at least one. Example: {"name":"Acme","domain":"merchant.example"}.
Costs $0.01 in Base USDC from the existing agent wallet, solely for screening. Optional operator-configured trial shares three calls/day/IP with HTTP/MCP.
Returns risk and flags. Informational screening, not legal advice or a compliance certification. Unavailable screening is not approval. Never pays the merchant under review.`,
    schema: CheckPayeeSchema,
  })
  async checkPayee(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckPayeeSchema>,
  ): Promise<string> {
    const input = CheckPayeeSchema.parse(args);
    const url = new URL(`${API}/v1/check`);
    for (const [key, value] of Object.entries(input)) {
      if (value) url.searchParams.set(key, value);
    }
    return this.request(walletProvider, url, "10000");
  }

  /**
   * Reviews a challenge and caller rules without executing the reviewed payment.
   *
   * @param walletProvider - The existing agent wallet paying only the screening fee.
   * @param args - Merchant challenge, resource URL, rules and spend context.
   * @returns An allow/hold/block decision with a receipt, or a fail-safe error.
   */
  @CreateAction({
    name: "preflight_payment",
    description: `Operated by SpendPreflight. Before an x402 payment, review the merchant's complete 402 challenge, resource_url and optional rules/context.
Example: pass the original challenge, resource_url and rules {"max_per_payment_usd":1,"hold_above_usd":0.25}.
Costs $0.02 in Base USDC from the existing agent wallet, solely for screening. Optional operator-configured trial shares three calls/day/IP with HTTP/MCP.
Returns allow/hold/block, reasons and a receipt. Deny hold/block or unavailable screening in the payment path; do not treat this tool as an automatic payment gate.
Informational screening, not legal advice or a compliance certification. Never signs, settles or executes the merchant payment being reviewed.`,
    schema: PreflightPaymentSchema,
  })
  async preflightPayment(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PreflightPaymentSchema>,
  ): Promise<string> {
    const input = PreflightPaymentSchema.parse(args);
    return this.request(walletProvider, new URL(`${API}/v1/preflight`), "20000", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  /**
   * Checks whether screening-fee payments can use this wallet network.
   *
   * @param network - The wallet network.
   * @returns Whether the network is Base mainnet.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  /**
   * Calls only the fixed screening API, limiting payment to the exact disclosed fee.
   *
   * @param wallet - The existing Base wallet.
   * @param url - Fixed-origin screening URL.
   * @param amount - Expected atomic USDC screening fee.
   * @param init - Screening request options.
   * @returns A structured screening result or hold/error.
   */
  private async request(
    wallet: EvmWalletProvider,
    url: URL,
    amount: string,
    init: RequestInit = {},
  ): Promise<string> {
    try {
      if (!this.supportsNetwork(wallet.getNetwork())) throw new Error("Unsupported network");
      let screeningFetch: typeof fetch = fetch;
      if (this.config.trial) {
        url.searchParams.set("trial", "1");
      } else {
        const signer = {
          ...wallet.toSigner(),
          readContract: (args: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args?: readonly unknown[];
          }) =>
            wallet.readContract({
              address: args.address,
              abi: args.abi as never,
              functionName: args.functionName as never,
              args: args.args as never,
            }),
        };
        const client = new x402Client().register("eip155:8453", new ExactEvmScheme(signer));
        client.onBeforePaymentCreation(({ selectedRequirements: req }) => {
          if (
            req.scheme !== "exact" ||
            req.network !== "eip155:8453" ||
            req.asset.toLowerCase() !== BASE_USDC ||
            req.payTo.toLowerCase() !== SCREENING_PAYEE ||
            req.amount !== amount
          ) {
            return Promise.resolve({
              abort: true,
              reason: "Unexpected SpendPreflight screening fee",
            });
          }
          return Promise.resolve();
        });
        screeningFetch = wrapFetchWithPayment(fetch, client);
      }
      const response = await screeningFetch(url.toString(), {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Screening unavailable");
      const data: unknown = await response.json();
      const result =
        amount === "20000"
          ? z
              .object({
                decision: z.enum(["allow", "hold", "block"]),
                reasons: z.array(z.string()),
                receipt: z.object({ id: z.string() }).passthrough(),
              })
              .passthrough()
              .parse(data)
          : z
              .object({ risk: z.enum(["low", "medium", "high", "unknown"]) })
              .passthrough()
              .parse(data);
      return JSON.stringify({ success: true, data: result });
    } catch {
      return JSON.stringify({
        success: false,
        decision: "hold",
        error: "SpendPreflight screening unavailable; do not proceed with the reviewed payment",
      });
    }
  }
}

/**
 * Creates a SpendPreflight screening provider.
 *
 * @param config - Agent-operator configuration.
 * @returns The provider.
 */
export const spendpreflightActionProvider = (config?: SpendPreflightConfig) =>
  new SpendPreflightActionProvider(config);
