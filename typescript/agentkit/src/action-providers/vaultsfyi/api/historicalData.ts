import z from "zod";
import { VAULTS_API_URL } from "../constants";
import { VaultHistoricalDataActionSchema } from "../schemas";
import { ApiError } from "./types";
import { createSearchParams } from "../utils";

type ApyData = {
  timestamp: number;
  blockNumber: number;
  apy: {
    base: number;
    rewards: number;
    total: number;
  };
};

type TvlData = {
  timestamp: number;
  blockNumber: number;
  tvlDetails: {
    tvlUsd: number;
  };
};

/**
 * Fetch historical data for a vault
 *
 * @param args - The arguments for the action
 * @param apiKey - The API key to use for the request
 * @returns The historical data for the vault
 */
export async function fetchVaultHistoricalData(
  args: z.infer<typeof VaultHistoricalDataActionSchema>,
  apiKey: string,
) {
  const params = createSearchParams({
    interval: args.apyRange ?? "7day",
  });
  const timestamp = new Date(args.date).getTime() / 1000;
  const [tvlResponse, apyResponse] = await Promise.all([
    fetch(
      `${VAULTS_API_URL}/vaults/${args.network}/${args.vaultAddress}/historical-tvl/${timestamp}?${params}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      },
    ),
    fetch(
      `${VAULTS_API_URL}/vaults/${args.network}/${args.vaultAddress}/historical-apy/${timestamp}?${params}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      },
    ),
  ]);
  const [apy, tvl] = await Promise.all([
    apyResponse.json() as Promise<ApyData | ApiError>,
    tvlResponse.json() as Promise<TvlData | ApiError>,
  ]);
  if ("error" in apy) return apy;
  if ("error" in tvl) return tvl;

  return {
    apy,
    tvl,
  };
}
