import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { USDC_DECIMALS } from "./constants";

/**
 * Converts an atomic USDC amount (6 decimals) to a USD number.
 *
 * @param amount - The atomic amount as a decimal string
 * @returns The amount in USD
 */
export function atomicUsdcToUsd(amount: string): number {
  return Number(BigInt(amount)) / 10 ** USDC_DECIMALS;
}

/**
 * Returns the price in USD that an x402 payment requirement asks for.
 *
 * @param requirements - The selected x402 payment requirements
 * @returns The price in USD
 */
export function priceInUsd(requirements: PaymentRequirements): number {
  return atomicUsdcToUsd(requirements.amount);
}

/**
 * Creates an x402 client that signs with the agent's wallet and refuses to pay more than
 * `maxPriceUsd` for a single call. The refusal happens before anything is signed.
 *
 * @param walletProvider - The EVM wallet provider that signs the payment
 * @param maxPriceUsd - The highest price in USD allowed for a single call
 * @returns A configured x402Client
 */
export function createAgentumPaymentClient(
  walletProvider: EvmWalletProvider,
  maxPriceUsd: number,
): x402Client {
  const client = new x402Client();
  const account = walletProvider.toSigner();
  registerExactEvmScheme(client, {
    signer: {
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
    },
    networks: ["eip155:8453"],
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    const requestedUsd = priceInUsd(selectedRequirements);
    if (requestedUsd > maxPriceUsd) {
      return {
        abort: true,
        reason: `Agentum asked for $${requestedUsd.toFixed(6)} USDC for this call but maxPriceUsd is $${maxPriceUsd}. Raise maxPriceUsd in agentumActionProvider({ maxPriceUsd }) to allow it.`,
      };
    }
  });
  return client;
}

/**
 * Options for a single Agentum POST request.
 */
export interface AgentumPostOptions {
  baseUrl: string;
  endpoint: string;
  body: unknown;
  walletProvider: EvmWalletProvider;
  maxPriceUsd: number;
  timeoutMs: number;
  agentId: string;
}

/**
 * POSTs to an Agentum endpoint through an x402-enabled fetch. When the server answers HTTP 402
 * the payment is signed by the wallet provider and the request is retried once.
 *
 * @param options - The request options
 * @returns The JSON result, with the x402 settlement receipt attached when the call was paid
 */
export async function postToAgentum(options: AgentumPostOptions): Promise<string> {
  const client = createAgentumPaymentClient(options.walletProvider, options.maxPriceUsd);
  const payingFetch = wrapFetchWithPayment(fetch, client);

  const response = await payingFetch(`${options.baseUrl}${options.endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Agent-Id": options.agentId,
    },
    body: JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text || "(empty body)"}`);
  }

  const result = await response.json();
  const receiptHeader = response.headers.get("PAYMENT-RESPONSE");
  if (receiptHeader && result && typeof result === "object" && !Array.isArray(result)) {
    try {
      return JSON.stringify({ ...result, x402Receipt: decodePaymentResponseHeader(receiptHeader) });
    } catch {
      // A receipt that cannot be decoded must not hide a paid result.
    }
  }
  return JSON.stringify(result);
}
