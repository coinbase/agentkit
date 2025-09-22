import z from "zod";
import { VaultDetailsActionSchema, VaultsActionSchema } from "../schemas";
import { createSearchParams } from "../utils";
import { VAULTS_API_URL } from "../constants";
import { ApiError } from "./types";

type ApyData = {
  "1day": number;
  "7day": number;
  "30day": number;
};

export type ApiVault = {
  name: string;
  address: string;
  network: string;
  protocol: string;
  isTransactional: boolean;
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
    base: ApyData;
    rewards: ApyData;
    total: ApyData;
  };
  numberOfHolders: number;
  rewards: {
    apy: ApyData;
    asset: {
      name: string;
      symbol: string;
      assetAddress: string;
      decimals: number;
    };
  }[];
  description: string;
  additionalIncentives: string;
  score: {
    vaultScore: number;
    vaultTvlScore: number;
    protocolTvlScore: number;
    holderScore: number;
    networkScore: number;
    assetScore: number;
  };
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
    transactionalOnly: true,
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

/**
 * Fetches the details of a specific vault from the vaultsfyi API.
 *
 * @param args - The action parameters
 * @param apiKey - The vaultsfyi API key
 * @returns The vault details
 */
export async function fetchVault(args: z.infer<typeof VaultDetailsActionSchema>, apiKey: string) {
  const response = await fetch(`${VAULTS_API_URL}/vaults/${args.network}/${args.vaultAddress}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });
  const data = (await response.json()) as ApiVault | ApiError;
  return data;
}
