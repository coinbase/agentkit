import { sanitizeOnchainMetadata } from "../../utils";
import { BTC_COLLATERAL_USDC, SBOR_LATEST_URL } from "./constants";
import { ResolvedBenchmark, SborFixing } from "./types";

/**
 * Fetches the current SBOR fixing.
 *
 * @returns The parsed fixing.
 */
export async function fetchSborFixing(): Promise<SborFixing> {
  const response = await fetch(SBOR_LATEST_URL);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return (await response.json()) as SborFixing;
}

/**
 * Hours since the fixing was published.
 *
 * @param fixing - The fixing timestamp, ISO 8601.
 * @param now - The current time in milliseconds, for testing.
 * @returns The age in hours, or null when the timestamp cannot be read.
 */
export function ageHours(fixing: string, now: number = Date.now()): number | null {
  const t = Date.parse(fixing);
  return Number.isFinite(t) ? (now - t) / 36e5 : null;
}

/**
 * A number that can be used as a rate.
 *
 * @param value - The value to check.
 * @returns True when the value is a finite number.
 */
export function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Resolves a benchmark into one shape, whether it is an SBOR index or the
 * bitcoin-collateral reference. Venue and asset names come from an external
 * API and are sanitized before they reach the agent.
 *
 * @param fixing - The current fixing.
 * @param name - The benchmark to resolve.
 * @returns The benchmark, or null when it is not published in this fixing.
 */
export function resolveBenchmark(fixing: SborFixing, name: string): ResolvedBenchmark | null {
  const clean = (s: unknown) => sanitizeOnchainMetadata(String(s ?? ""));

  if (name === BTC_COLLATERAL_USDC) {
    const ref = fixing.bitcoinCollateralUsdc;
    if (!ref || !isRate(ref.borrow) || !isRate(ref.supply)) return null;
    return {
      name,
      isReference: true,
      borrow: ref.borrow,
      supply: ref.supply,
      venueCount: ref.markets.length,
      markets: ref.markets.map(m => ({
        venue: `Morpho on ${clean(m.chain)}`,
        asset: `${clean(m.collateral)}/USDC`,
        borrow: m.borrow,
        supply: m.supply,
        utilization: m.utilization,
        depthUsd: m.depthUsd,
      })),
    };
  }

  const ix = fixing.indices?.[name];
  if (!ix || !isRate(ix.borrow) || !isRate(ix.supply)) return null;
  return {
    name,
    isReference: false,
    borrow: ix.borrow,
    supply: ix.supply,
    venueCount: ix.venues.length,
    markets: ix.markets.map(m => ({
      venue: clean(m.venue),
      asset: clean(m.asset),
      borrow: m.borrow,
      supply: m.supply,
      utilization: m.utilization,
      depthUsd: m.depthUsd,
    })),
  };
}
