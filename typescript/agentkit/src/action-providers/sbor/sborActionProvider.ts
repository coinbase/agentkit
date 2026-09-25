import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { CompareRateToSborSchema, GetSborRateSchema, ListSborMarketsSchema } from "./schemas";
import {
  BTC_COLLATERAL_USDC,
  SBOR_INDICES,
  SBOR_LATEST_URL,
  STALE_AFTER_HOURS,
  STOP_THRESHOLD_BPS,
} from "./constants";
import { ageHours, fetchSborFixing, isRate, resolveBenchmark } from "./utils";

const REFERENCE_NOTE =
  "BTC-COLLATERAL-USDC is a reference, not an SBOR index: what it costs to borrow USDC against bitcoin wrapped by a custodian (cbBTC, WBTC), from the Morpho markets on Base and Ethereum whose only collateral is that bitcoin.";

/**
 * SborActionProvider reads SBOR, a benchmark of lending rates read from lending
 * contract state and published once a day. It lets an agent check an offered
 * rate against the market before it borrows. It only reads public data: it
 * needs no key and never builds or sends a transaction.
 */
export class SborActionProvider extends ActionProvider {
  /**
   * Constructor for the SborActionProvider class.
   */
  constructor() {
    super("sbor", []);
  }

  /**
   * Gets the current SBOR fixing: borrow and supply rates for each benchmark.
   *
   * @param args - The benchmark to read, or null for all of them.
   * @returns A JSON string with the rates and the age of the fixing, or an error message.
   */
  @CreateAction({
    name: "get_sbor_rate",
    description: `This tool gets the current SBOR benchmark lending rates, read from lending contract state and published once a day.
It takes the following inputs:
- benchmark: SBOR-USD, SBOR-BTC or SBOR-STX for lending on Stacks, BTC-COLLATERAL-USDC for borrowing USDC against bitcoin on Base and Ethereum, or null for all

Important notes:
- Rates are effective annual percentages (APY): 4.2 means 4.2%
- Always read ageHours: the fixing is published once a day, and data older than ${STALE_AFTER_HOURS} hours is flagged as stale
- A benchmark missing from the fixing is unknown, never zero
- BTC-COLLATERAL-USDC is a reference, not an SBOR index; SBOR-USD is a dollar on Stacks, borrowed against any crypto collateral`,
    schema: GetSborRateSchema,
  })
  async getSborRate(args: z.infer<typeof GetSborRateSchema>): Promise<string> {
    try {
      const fixing = await fetchSborFixing();
      const age = ageHours(fixing.fixing);
      const names = args.benchmark ? [args.benchmark] : [...SBOR_INDICES, BTC_COLLATERAL_USDC];
      const published = names
        .map(name => resolveBenchmark(fixing, name))
        .filter((b): b is NonNullable<typeof b> => b !== null);
      const missing = names.filter(name => !published.some(b => b.name === name));

      return JSON.stringify(
        {
          fixing: fixing.fixing,
          ageHours: age === null ? null : Number(age.toFixed(1)),
          stale: age === null || age > STALE_AFTER_HOURS,
          methodologyVersion: fixing.methodologyVersion,
          benchmarks: published.map(b => ({
            name: b.name,
            borrow: b.borrow,
            supply: b.supply,
            isReference: b.isReference,
          })),
          notPublished: missing,
          notes: [
            ...(missing.length
              ? [
                  "Benchmarks in notPublished could not be read today. Treat them as unknown, never as zero.",
                ]
              : []),
            ...(published.some(b => b.isReference) ? [REFERENCE_NOTE] : []),
          ],
          source: SBOR_LATEST_URL,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error fetching SBOR rates: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Compares an offered rate against an SBOR benchmark, before borrowing or supplying.
   *
   * @param args - The offered rate, the side, and the benchmark.
   * @returns A JSON string with the verdict, or a message explaining why there is none.
   */
  @CreateAction({
    name: "compare_rate_to_sbor",
    description: `This tool compares an offered lending rate against the SBOR benchmark. Use it before borrowing, not after.
It takes the following inputs:
- rate: the offered rate as an annual percentage, 4.2 for 4.2%
- side: "borrow" or "supply"
- benchmark: BTC-COLLATERAL-USDC for USDC borrowed against cbBTC or WBTC on Base or Ethereum; SBOR-USD, SBOR-BTC or SBOR-STX for lending on Stacks

Important notes:
- If stopAndAskHuman is true, the borrow offer is more than ${STOP_THRESHOLD_BPS} basis points above the benchmark: stop and ask a human before borrowing
- Returns no verdict on data older than ${STALE_AFTER_HOURS} hours, or when the benchmark is not published; fall back to your own logic
- Never compare a Base or Ethereum loan with a Stacks index`,
    schema: CompareRateToSborSchema,
  })
  async compareRateToSbor(args: z.infer<typeof CompareRateToSborSchema>): Promise<string> {
    try {
      const { rate, side, benchmark } = args;
      if (!isRate(rate) || rate <= 0 || rate > 100) {
        return `No verdict: the rate must be a percentage between 0 and 100, got ${rate}. 4.2% is 4.2, not 0.042.`;
      }

      const fixing = await fetchSborFixing();

      const age = ageHours(fixing.fixing);
      if (age === null) {
        return `No verdict: the age of the SBOR fixing could not be read. Fall back to your own logic.`;
      }
      if (age > STALE_AFTER_HOURS) {
        return `No verdict: the last SBOR fixing is ${age.toFixed(1)} hours old, past the ${STALE_AFTER_HOURS} hour limit. Fall back to your own logic.`;
      }

      const b = resolveBenchmark(fixing, benchmark);
      if (!b) {
        return `No verdict: ${benchmark} is not published in the current SBOR fixing, so there is nothing to compare against. Treat it as unknown, not as zero.`;
      }

      const benchmarkRate = b[side];
      const diff = rate - benchmarkRate;
      const bps = Math.round(Math.abs(diff) * 100);
      const verdict = bps < 1 ? "at" : diff > 0 ? "above" : "below";
      const stopAndAskHuman = side === "borrow" && diff * 100 > STOP_THRESHOLD_BPS;

      const best = [...b.markets]
        .filter(m => isRate(m[side]))
        .sort((p, q) => (side === "borrow" ? p[side] - q[side] : q[side] - p[side]))[0];

      const notes: string[] = [];
      if (rate < 0.5) {
        notes.push(
          `CHECK UNITS FIRST: this was read as ${rate}%, not ${(rate * 100).toFixed(1)}%. Rates this low do occur, so it has been answered as given.`,
        );
      }
      if (!b.isReference && b.venueCount === 1) {
        notes.push(
          "This index covers one venue, so it is a reading of that venue rather than a market average.",
        );
      }
      if (b.isReference) notes.push(REFERENCE_NOTE);

      return JSON.stringify(
        {
          benchmark: b.name,
          side,
          offeredRate: rate,
          benchmarkRate,
          differenceBps: Math.round(diff * 100),
          verdict,
          stopAndAskHuman,
          guidance: stopAndAskHuman
            ? `The offer is ${bps} basis points above the benchmark, more than ${STOP_THRESHOLD_BPS}. Stop and ask a human before borrowing.`
            : verdict === "at"
              ? "The offer is at the benchmark."
              : `The offer is ${bps} basis points ${verdict} the benchmark.`,
          bestMarket: best
            ? {
                venue: best.venue,
                asset: best.asset,
                rate: best[side],
                utilization: best.utilization,
              }
            : null,
          notes,
          fixing: fixing.fixing,
          ageHours: Number(age.toFixed(1)),
          source: SBOR_LATEST_URL,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error comparing against SBOR: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Lists the lending markets behind an SBOR benchmark.
   *
   * @param args - The benchmark, or null for the three Stacks indices.
   * @returns A JSON string with each market's rates, utilization and depth, or an error message.
   */
  @CreateAction({
    name: "list_sbor_markets",
    description: `This tool lists the lending markets behind an SBOR benchmark, with each market's borrow and supply rate, utilization and depth.
It takes the following inputs:
- benchmark: SBOR-USD, SBOR-BTC, SBOR-STX or BTC-COLLATERAL-USDC, or null for the three Stacks indices

Important notes:
- Utilization explains why a rate sits where it does: near full, a variable rate can jump quickly
- Rates are effective annual percentages; depthUsd is the amount supplied, in US dollars`,
    schema: ListSborMarketsSchema,
  })
  async listSborMarkets(args: z.infer<typeof ListSborMarketsSchema>): Promise<string> {
    try {
      const fixing = await fetchSborFixing();
      const names = args.benchmark ? [args.benchmark] : [...SBOR_INDICES];
      const result = names.map(name => {
        const b = resolveBenchmark(fixing, name);
        if (!b) {
          const notRead =
            name === BTC_COLLATERAL_USDC ? fixing.bitcoinCollateralUsdc?.notRead : undefined;
          return {
            name,
            published: false,
            note: `Not published in the current fixing${notRead?.length ? ": not every market could be read" : ""}. Treat it as unknown, not as zero.`,
          };
        }
        return { name, published: true, isReference: b.isReference, markets: b.markets };
      });
      return JSON.stringify(
        { fixing: fixing.fixing, benchmarks: result, source: SBOR_LATEST_URL },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error listing SBOR markets: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the SBOR action provider supports the given network.
   * SBOR reads public data and is network-agnostic, so this always returns true.
   *
   * @returns True, as SBOR actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the SBOR action provider.
 *
 * @returns A new SborActionProvider instance
 */
export const sborActionProvider = () => new SborActionProvider();
