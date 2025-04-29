export type ApiError = {
  statusCode: number;
  error: string;
  message: string;
};

export type Balances = {
  [network: string]: {
    address: string;
    name: string;
    symbol: string;
    balance: string;
    decimals: number;
  }[];
};

export type Positions = {
  [network: string]: {
    vaultName: string;
    vaultAddress: string;
    asset: {
      assetAddress: string;
      name: string;
      symbol: string;
      decimals: number;
    };
    balanceNative: string;
    balanceLp: string;
    unclaimedUsd: string;
    apy: {
      base: number;
      rewards: number;
      total: number;
    };
  }[];
};
