import {
  EVMNetwork,
  Network,
  SVMNetwork,
  WalletProviderChoice,
  WalletProviderRouteConfiguration,
} from "./types";

export const EVM_NETWORKS: Set<EVMNetwork> = new Set([
  "ethereum-mainnet",
  "ethereum-sepolia",
  "polygon-mainnet",
  "polygon-mumbai",
  "base-mainnet",
  "base-sepolia",
  "arbitrum-mainnet",
  "arbitrum-sepolia",
  "optimism-mainnet",
  "optimism-sepolia",
]);

export const SVM_NETWORKS: Set<SVMNetwork> = new Set([
  "solana-mainnet",
  "solana-devnet",
  "solana-testnet",
]);

const CDP_SUPPORTED_EVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["CDP", "Viem", "Privy"];
const SVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["SolanaKeypair", "Privy"];
export const NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["Viem", "Privy"];

export const NetworkToWalletProviders: Record<Network, WalletProviderChoice[]> = {
  "arbitrum-mainnet": CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "arbitrum-sepolia": NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "base-mainnet": CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "base-sepolia": CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "ethereum-mainnet": CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "ethereum-sepolia": NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "optimism-mainnet": NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "optimism-sepolia": NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "polygon-mainnet": CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "polygon-mumbai": NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  "solana-mainnet": SVM_WALLET_PROVIDERS,
  "solana-devnet": SVM_WALLET_PROVIDERS,
  "solana-testnet": SVM_WALLET_PROVIDERS,
};

export const Networks: Network[] = [...EVM_NETWORKS, ...SVM_NETWORKS];

export const WalletProviderChoices: WalletProviderChoice[] = [
  ...new Set([
    ...CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
    ...NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
    ...SVM_WALLET_PROVIDERS,
  ]),
];

export const WalletProviderRouteConfigurations: Record<
  "EVM" | "SVM",
  Partial<Record<WalletProviderChoice, WalletProviderRouteConfiguration>>
> = {
  EVM: {
    CDP: {
      env: {
        topComments: ["Get keys from CDP Portal: https://portal.cdp.coinbase.com/"],
        required: ["CDP_API_KEY_NAME=", "CDP_API_KEY_PRIVATE_KEY="],
        optional: [],
      },
      apiRoute: "evm/cdp/route.ts",
    },
    Viem: {
      env: {
        topComments: [
          "Export private key from your Ethereum wallet and save",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["PRIVATE_KEY=", "CDP_API_KEY_NAME=", "CDP_API_KEY_PRIVATE_KEY="],
        optional: [],
      },
      apiRoute: "evm/viem/route.ts",
    },
    Privy: {
      env: {
        topComments: [
          "Get keys from Privy Dashboard: https://dashboard.privy.io/",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: [
          "PRIVY_APP_ID=",
          "PRIVY_APP_SECRET=",
          "CDP_API_KEY_NAME=",
          "CDP_API_KEY_PRIVATE_KEY=",
        ],
        optional: [
          "CHAIN_ID=",
          "PRIVY_WALLET_ID=",
          "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY=",
          "PRIVY_WALLET_AUTHORIZATION_KEY_ID=",
        ],
      },
      apiRoute: "evm/privy/route.ts",
    },
  },
  SVM: {
    SolanaKeypair: {
      env: {
        topComments: [
          "Export private key from your Solana wallet and save",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["SOLANA_PRIVATE_KEY=", "CDP_API_KEY_NAME=", "CDP_API_KEY_PRIVATE_KEY="],
        optional: ["SOLANA_RPC_URL="],
      },
      apiRoute: "svm/solanaKeypair/route.ts",
    },
    Privy: {
      env: {
        topComments: [
          "Get keys from Privy Dashboard: https://dashboard.privy.io/",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: [
          "PRIVY_APP_ID=",
          "PRIVY_APP_SECRET=",
          "CDP_API_KEY_NAME=",
          "CDP_API_KEY_PRIVATE_KEY=",
        ],
        optional: [
          "PRIVY_WALLET_ID=",
          "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY=",
          "PRIVY_WALLET_AUTHORIZATION_KEY_ID=",
        ],
      },
      apiRoute: "svm/privy/route.ts",
    },
  },
};
