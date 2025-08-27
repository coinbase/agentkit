import { MarketStatus } from "./constants";

// Type for Uniswap V3 Pool slot0 result
export type Slot0Result = readonly [bigint, number, number, number, number, number, boolean];

// Create mapping for status lookup
export const GetMarketStatus = Object.entries(MarketStatus).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<number, string>,
);

/**
 * Interface representing a TruthMarket
 */
export interface TruthMarket {
  id: number;
  address: string;
  marketQuestion: string;
}
