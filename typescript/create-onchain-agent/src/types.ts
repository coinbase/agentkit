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

export type WalletProviderChoice = "CDP" | "Viem" | "Privy" | "SolanaKeypair" | "SmartWallet";

export type AgentkitRouteConfiguration = {
  env: {
    topComments: string[];
    required: string[];
    optional: string[];
  };
  prepareAgentkitRoute: `${string}.ts`;
};

export type NetworkSelection = {
  networkFamily: "EVM" | "SVM";
  networkType: "mainnet" | "testnet" | "custom";
  network?: Network;
  chainId?: string;
  rpcUrl?: string;
};

export type Framework = "Langchain" | "Vercel AI SDK";

export type Template = "next";
