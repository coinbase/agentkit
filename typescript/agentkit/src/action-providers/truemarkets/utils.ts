import { MarketStatus } from "./constants";

// Create mapping for status lookup
export const GetMarketStatus = Object.entries(MarketStatus).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<number, string>,
);
