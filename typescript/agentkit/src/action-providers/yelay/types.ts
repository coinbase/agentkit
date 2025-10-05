export type VaultsDetailsResponse = {
  address: `0x${string}`;
  name: string;
  underlying: `0x${string}`;
  decimals: number;
  chainId: ChainId;
};

export type APYResponse = {
  vault: `0x${string}`;
  startBlock: number;
  finishBlock: number;
  startTimestamp: number;
  finishTimestamp: number;
  yield: string;
  apy: string;
};

export type ClaimRequest = {
  yelayLiteVault: `0x${string}`;
  projectId: number;
  cycle: number;
  yieldSharesTotal: string;
  proof: string[];
};

export type ChainId = "1" | "146" | "8453" | "42161" | "43114";
