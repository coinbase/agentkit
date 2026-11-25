import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { PreflightX402EndpointSchema } from "./schemas";

export const X402_DOCTOR_URL = "https://x402-doctor.onrender.com";

/** The preflight costs $0.001; never pay more than $0.002 (USDC, 6 decimals). */
const MAX_PREFLIGHT_ATOMIC = BigInt(2000);

/** Networks the preflight can be paid on, by AgentKit network id. */
const PAYMENT_NETWORKS: Record<string, string> = {
  "base-mainnet": "eip155:8453",
  "solana-mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

const ADVICE: Record<string, string> = {
  go: "Safe to pay: continue with retry_http_request_with_x402 using the recommended option.",
  caution: "Payable, but with a caveat: tell the user the summary and pay only after they confirm.",
  no_go: "Do not pay this endpoint: the payment would fail, is over budget, or should not be made.",
};

/**
 * Configuration for the X402DoctorActionProvider.
 */
export interface X402DoctorConfig {
  /** x402 Doctor base URL. Default https://x402-doctor.onrender.com (or X402_DOCTOR_URL). */
  doctorUrl?: string;
}

/**
 * X402DoctorActionProvider checks an x402 endpoint before the agent pays it, using the
 * x402 Doctor preflight ($0.001 in USDC, paid via x402 from the agent's wallet on Base or
 * Solana). It complements the x402 action provider: call preflight_x402_endpoint between
 * make_http_request (which returns the 402) and retry_http_request_with_x402.
 */
export class X402DoctorActionProvider extends ActionProvider<WalletProvider> {
  private readonly doctorUrl: string;

  /**
   * Creates a new X402DoctorActionProvider.
   *
   * @param config - Optional configuration
   */
  constructor(config: X402DoctorConfig = {}) {
    super("x402Doctor", []);
    this.doctorUrl = (config.doctorUrl ?? process.env.X402_DOCTOR_URL ?? X402_DOCTOR_URL).replace(
      /\/$/,
      "",
    );
  }

  /**
   * Checks an x402 endpoint before paying it.
   *
   * @param walletProvider - The wallet that pays the $0.001 preflight
   * @param args - The endpoint URL, method and budget
   * @returns A JSON string with the verdict (go, caution or no_go), the reasons and advice
   */
  @CreateAction({
    name: "preflight_x402_endpoint",
    description: `
Checks an x402 (HTTP 402) endpoint BEFORE paying it, using the x402 Doctor preflight.
Costs $0.001 in USDC, paid automatically from the wallet (Base or Solana mainnet).

Use it after make_http_request returned a 402 for an endpoint you have not used before,
and before retry_http_request_with_x402. It reads the endpoint's payment requirements and
checks the price against your budget and against what the service advertises, whether the
option is payable on your network (USDC, a valid payout address, a Solana payout account that
exists), HTTPS, the endpoint's payability track record, and whether it is listed in the CDP Bazaar.

Returns a verdict:
- go: safe to pay the recommended option
- caution: payable, but tell the user the summary and pay only after they confirm
- no_go: do not pay (the payment would fail, is over budget, or should not be made)

Inputs:
- url: the endpoint you are about to pay
- method: GET or POST (optional, default GET)
- maxUsd: your budget per call in USD (optional)`,
    schema: PreflightX402EndpointSchema,
  })
  async preflightX402Endpoint(
    walletProvider: WalletProvider,
    args: z.infer<typeof PreflightX402EndpointSchema>,
  ): Promise<string> {
    const network = PAYMENT_NETWORKS[walletProvider.getNetwork().networkId ?? ""];
    if (!network) {
      return JSON.stringify(
        {
          error: true,
          message: "Unsupported network",
          details: "The x402 Doctor preflight is paid in USDC on Base mainnet or Solana mainnet.",
        },
        null,
        2,
      );
    }
    if (
      !(walletProvider instanceof EvmWalletProvider || walletProvider instanceof SvmWalletProvider)
    ) {
      return JSON.stringify(
        {
          error: true,
          message: "Unsupported wallet provider",
          details: "Only EvmWalletProvider and SvmWalletProvider are supported",
        },
        null,
        2,
      );
    }

    const method = args.method ?? "GET";
    const query = new URLSearchParams({ url: args.url, method, network });
    if (args.maxUsd !== null && args.maxUsd !== undefined)
      query.set("max_usd", String(args.maxUsd));

    try {
      const client = await this.createClient(walletProvider, network);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(`${this.doctorUrl}/api/v1/preflight?${query}`, {
        headers: { accept: "application/json" },
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.verdict) {
        return JSON.stringify(
          {
            error: true,
            message: `Preflight failed with status ${response.status}`,
            details: data,
            advice: "No verdict: do not pay the endpoint without one.",
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          url: args.url,
          method,
          verdict: data.verdict,
          summary: data.summary,
          advice: ADVICE[data.verdict] ?? ADVICE.no_go,
          recommendedOption:
            data.recommended_option !== null && data.recommended_option !== undefined
              ? (data.options?.[data.recommended_option] ?? null)
              : null,
          reasons: data.reasons ?? [],
          signals: data.signals ?? {},
          paymentProof: this.paymentProof(response),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "Preflight request failed",
          details: error instanceof Error ? error.message : String(error),
          advice: "No verdict: do not pay the endpoint without one.",
        },
        null,
        2,
      );
    }
  }

  /**
   * The preflight can be paid on Base mainnet and Solana mainnet.
   *
   * @param network - The network to check
   * @returns True when the preflight can be paid on this network
   */
  supportsNetwork = (network: Network): boolean =>
    Boolean(network.networkId && PAYMENT_NETWORKS[network.networkId]);

  /**
   * An x402 client that pays only on the wallet's network and never more than $0.002.
   *
   * @param walletProvider - The wallet that signs the payment
   * @param network - The CAIP-2 network to pay on
   * @returns A configured x402Client
   */
  private async createClient(
    walletProvider: EvmWalletProvider | SvmWalletProvider,
    network: string,
  ): Promise<x402Client> {
    const client = new x402Client().registerPolicy((_version, requirements) =>
      requirements.filter(r => {
        const amount = (r as { amount?: string }).amount;
        return (
          r.network === network && amount !== undefined && BigInt(amount) <= MAX_PREFLIGHT_ATOMIC
        );
      }),
    );

    if (walletProvider instanceof EvmWalletProvider) {
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
    } else {
      registerExactSvmScheme(client, { signer: await walletProvider.toSigner() });
    }
    return client;
  }

  /**
   * The settlement receipt of a paid response.
   *
   * @param response - The paid response
   * @returns The decoded PAYMENT-RESPONSE header, or null
   */
  private paymentProof(response: Response): Record<string, unknown> | null {
    const header =
      response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
    if (!header) return null;
    try {
      return JSON.parse(atob(header));
    } catch {
      return { raw: header };
    }
  }
}

/**
 * Factory function to create a new X402DoctorActionProvider.
 *
 * @param config - Optional configuration
 * @returns A new X402DoctorActionProvider
 */
export const x402DoctorActionProvider = (config?: X402DoctorConfig) =>
  new X402DoctorActionProvider(config);
