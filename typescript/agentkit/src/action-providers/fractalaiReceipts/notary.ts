import {
  NOTARY_NETWORK,
  NOTARY_NETWORK_LEGACY,
  NOTARY_PAY_TO,
  NOTARY_USDC_ASSET,
  SEAL_SCHEMA,
} from "./constants";
import { sha256Hex } from "./encoding";

/** Unsigned settlement-seal body, as the FractalAI notary expects it in `seal_body`. */
export interface SealBody {
  schema: string;
  resource: string | null;
  scheme: string | null;
  network: string | null;
  asset: string | null;
  payTo: string | null;
  amount: string | null;
  payer: string | null;
  transaction: string | null;
  success: boolean | null;
  response_sha256: string | null;
  sealed_at: string;
}

/**
 * Builds the `seal_body` the notary signs (same fields as `buildSealBody` of
 * `@fractalai/x402-pqc-witness`). Every field describes the payment being notarized; the notary
 * re-derives asset, payTo, amount and payer from Base before signing and refuses on mismatch.
 *
 * @param p - Payment description
 * @param p.transaction - Settlement transaction hash
 * @param p.payTo - Recipient of the payment
 * @param p.amount - Amount in atomic units
 * @param p.asset - Asset contract (defaults to USDC on Base)
 * @param p.payer - Payer as claimed by the requester (replaced by the notary's on-chain view)
 * @param p.resource - Paid resource URL
 * @param p.responseBody - Body text received, hashed into `response_sha256`
 * @param p.now - Clock, for tests
 * @returns The seal body
 */
export function buildSealBody(p: {
  transaction: string;
  payTo: string;
  amount: string;
  asset?: string | null;
  payer?: string | null;
  resource?: string | null;
  responseBody?: string | null;
  now?: Date;
}): SealBody {
  return {
    schema: SEAL_SCHEMA,
    resource: p.resource ?? null,
    scheme: "exact",
    network: NOTARY_NETWORK,
    asset: p.asset ?? NOTARY_USDC_ASSET,
    payTo: p.payTo,
    amount: p.amount,
    payer: p.payer ?? null,
    transaction: p.transaction,
    success: true,
    response_sha256: typeof p.responseBody === "string" ? sha256Hex(p.responseBody) : null,
    sealed_at: (p.now ?? new Date()).toISOString(),
  };
}

/** The payment-requirement fields this provider inspects before paying the notary. */
export interface NotaryRequirement {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  amount?: string;
  maxAmountRequired?: string;
}

/**
 * Whether a 402 payment option is the notary's published one: `exact`, USDC on Base mainnet, paid
 * to FractalAI's pinned treasury, for no more than `maxAtomic`.
 *
 * @param r - Payment requirement offered by the server
 * @param maxAtomic - Maximum amount in USDC atomic units
 * @returns Whether paying it is allowed
 */
export function isAcceptableNotaryRequirement(r: NotaryRequirement, maxAtomic: bigint): boolean {
  try {
    const raw = r.amount ?? r.maxAmountRequired;
    if (typeof raw !== "string" || !/^[0-9]{1,30}$/.test(raw)) return false;
    return (
      r.scheme === "exact" &&
      (r.network === NOTARY_NETWORK || r.network === NOTARY_NETWORK_LEGACY) &&
      typeof r.asset === "string" &&
      r.asset.toLowerCase() === NOTARY_USDC_ASSET.toLowerCase() &&
      typeof r.payTo === "string" &&
      r.payTo.toLowerCase() === NOTARY_PAY_TO.toLowerCase() &&
      BigInt(raw) <= maxAtomic
    );
  } catch {
    return false;
  }
}

/**
 * Fields of the returned seal body that must equal what was submitted. `payer` is excluded: the
 * notary replaces it with the sender it derives on-chain.
 *
 * @param submitted - Body sent to the notary
 * @param sealed - Body the notary signed
 * @returns Names of fields that differ
 */
export function sealBodyMismatches(submitted: SealBody, sealed: Record<string, unknown>): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(submitted)) {
    if (k === "payer") continue;
    if (sealed[k] !== v) bad.push(k);
  }
  return bad;
}
