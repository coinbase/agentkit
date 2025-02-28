export type EVMNetwork =
  | "ethereum-mainnet"
  | "ethereum-sepolia"
  | "polygon-mainnet"
  | "polygon-mumbai"
  | "base-mainnet"
  | "base-sepolia"
  | "arbitrum-mainnet"
  | "arbitrum-sepolia"
  | "optimism-mainnet"
  | "optimism-sepolia";

export type SVMNetwork = "solana-mainnet" | "solana-devnet" | "solana-testnet";

export type Network = EVMNetwork | SVMNetwork;

export type WalletProviderChoice = "CDP" | "Viem" | "Privy" | "SolanaKeypair";

export type WalletProviderRouteConfiguration = {
  env: {
    topComments: string[];
    required: string[];
    optional: string[];
  };
  apiRoute: string;
};

export type NetworkSelection = {
  networkFamily: "EVM" | "SVM";
  networkType: "mainnet" | "testnet" | "custom";
  network?: Network;
  chainId?: string;
  rpcUrl?: string;
};
