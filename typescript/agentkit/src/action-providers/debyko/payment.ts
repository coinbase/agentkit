import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

/** Production API. Payable routes answer 402 when the request has no key and no payment. */
export const API_ROOT = "https://api.debyko.com";

/** Base mainnet, the only network DEBYKO settles on. */
export const BASE_CAIP2 = "eip155:8453";

/** Native USDC on Base. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Default per-call cap, in USDC whole units. The x402 client's own default spend control is $1. */
export const DEFAULT_MAX_PAYMENT_USDC = 0.05;

const USDC_DECIMALS = 6;

type Offer = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
};

export type OfferDecision = { ok: true; response: Response } | { ok: false; reason: string };

/**
 * Converts a USDC amount in whole units to atomic units.
 *
 * Uses the same six-decimal conversion as AgentKit's own payment limit.
 *
 * @param maxPaymentUsdc - The cap in USDC whole units.
 * @returns The cap in atomic units.
 */
export function maxAtomic(maxPaymentUsdc: number): bigint {
  if (!Number.isFinite(maxPaymentUsdc) || maxPaymentUsdc < 0) {
    throw new Error("maxPaymentUsdc must be a finite number that is at least 0");
  }
  return parseUnits(maxPaymentUsdc.toString(), USDC_DECIMALS);
}

/**
 * Reads PAYMENT-REQUIRED and keeps only offers this provider will sign.
 *
 * `createX402Client` builds `new x402Client()`, spreads `toSigner()` with `readContract`, and calls
 * `registerExactEvmScheme(client, { signer })`. That registration covers `eip155:*`. The library's
 * default spend control is $1, so a 0.06 USDC offer on another EVM network would be signed. DEBYKO
 * also lists 30-day plan prices on the same 402, above a per-call cap. Those offers are dropped here,
 * before that client is constructed. A header this layer cannot parse is refused here too.
 *
 * @param header - The PAYMENT-REQUIRED header value.
 * @param maxPaymentUsdc - The cap in USDC whole units.
 * @returns The filtered 402 to replay, or a refusal.
 */
export function decideOffers(header: string | null, maxPaymentUsdc: number): OfferDecision {
  const parsed = parseRequired(header);
  if (!parsed) {
    return {
      ok: false,
      reason: "Payment refused before signing: PAYMENT-REQUIRED could not be read.",
    };
  }
  const cap = maxAtomic(maxPaymentUsdc);
  const kept = parsed.accepts.filter(offer => offerWithinCap(offer, cap));
  if (kept.length === 0) {
    return {
      ok: false,
      reason: `Payment refused before signing: no exact offer on ${BASE_CAIP2} for native USDC at or under ${maxPaymentUsdc} USDC.`,
    };
  }
  const document = { ...parsed.document, accepts: kept };
  const encoded = Buffer.from(JSON.stringify(document), "utf8").toString("base64");
  return {
    ok: true,
    response: new Response(JSON.stringify(document), {
      status: 402,
      headers: {
        "content-type": "application/json",
        "payment-required": encoded,
      },
    }),
  };
}

/**
 * Builds the x402 client the way AgentKit does, against a fetch that will first see an acceptable 402.
 *
 * Signing happens inside wrapFetchWithPayment, and only for an offer decideOffers kept.
 *
 * @param wallet - The wallet whose signer pays.
 * @param fetchImpl - Fetch implementation. The first call must return the filtered 402.
 * @param maxPaymentUsdc - The cap in USDC whole units.
 * @returns Fetch that attaches a payment when the response is 402.
 */
export function paidFetch(
  wallet: EvmWalletProvider,
  fetchImpl: typeof fetch,
  maxPaymentUsdc: number,
): typeof fetch {
  const client = new x402Client();
  const account = wallet.toSigner();
  const signer = {
    ...account,
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
  const cap = maxAtomic(maxPaymentUsdc);
  registerExactEvmScheme(client, {
    signer,
    networks: [BASE_CAIP2],
    policies: [
      (_version, requirements) =>
        requirements.filter(requirement => offerWithinCap(requirement, cap)),
    ],
  });
  return wrapFetchWithPayment(fetchImpl, client);
}

/**
 * Decodes a PAYMENT-REQUIRED header into its offers.
 *
 * @param header - The header value.
 * @returns The document and its accepts list, or null when the header cannot be read.
 */
function parseRequired(
  header: string | null,
): { document: Record<string, unknown>; accepts: Offer[] } | null {
  if (!header || !/^[A-Za-z0-9+/]+={0,2}$/.test(header)) return null;
  try {
    const json = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as unknown;
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const accepts = (json as { accepts?: unknown }).accepts;
    if (!Array.isArray(accepts) || accepts.length === 0) return null;
    if (!accepts.every(item => item !== null && typeof item === "object" && !Array.isArray(item)))
      return null;
    return { document: json as Record<string, unknown>, accepts: accepts as Offer[] };
  } catch {
    return null;
  }
}

/**
 * Reports whether one offer is an exact Base USDC payment at or under the cap.
 *
 * @param offer - One entry of accepts.
 * @param cap - The cap in atomic units.
 * @returns True when this provider may sign the offer.
 */
function offerWithinCap(offer: Offer, cap: bigint): boolean {
  if (offer.scheme !== "exact") return false;
  if (offer.network !== BASE_CAIP2) return false;
  if (typeof offer.asset !== "string" || offer.asset.toLowerCase() !== BASE_USDC.toLowerCase())
    return false;
  if (typeof offer.amount !== "string" || !/^[0-9]+$/.test(offer.amount)) return false;
  try {
    return BigInt(offer.amount) <= cap;
  } catch {
    return false;
  }
}
