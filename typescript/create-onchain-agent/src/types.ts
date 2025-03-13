import { Network } from "./constants";

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

export type {
  EVMNetwork,
  SVMNetwork,
  Network,
  WalletProviderChoice,
  Framework,
  Template,
} from "./constants";
