import z from "zod";
import { VaultsActionSchema } from "../schemas";
import { createSearchParams } from "../utils";
import { VAULTS_API_URL } from "../constants";
import { ApiError } from "./types";

export type ApiVault = {
  name: string;
  address: string;
  network: string;
  protocol: string;
  tvlDetails: {
    tvlUsd: string;
  };
  token: {
    name: string;
    assetAddress: string;
    symbol: string;
    decimals: number;
  };
  apy: {
    base: {
      "7day": number;
    };
    rewards: {
      "7day": number;
    };
    total: {
      "7day": number;
    };
  };
  isTransactional: boolean;
};

type ApiResult = {
  data: ApiVault[];
  next_page: string | undefined;
};

/**
 * Fetches a list of vaults from the vaultsfyi API.
 *
 * @param args - The action parameters
 * @param apiKey - The vaultsfyi API key
 * @returns The list of vaults
 */
export async function fetchVaults(
  args: z.infer<typeof VaultsActionSchema>,
  apiKey: string,
): Promise<ApiVault[] | ApiError> {
  const vaults: ApiVault[] = [];

  const params = createSearchParams({
    per_page: 250,
    token: args.token,
    network: args.network,
    tvl_min: args.minTvl ?? 100_000,
    transactional_only: true,
  });
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${VAULTS_API_URL}/detailed/vaults?${params}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });
    const data = (await response.json()) as ApiResult | ApiError;
    if ("error" in data) return data;

    vaults.push(...data.data);

    if (!data.next_page) break;
    else params.set("page", data.next_page);
  }

  return vaults;
}
