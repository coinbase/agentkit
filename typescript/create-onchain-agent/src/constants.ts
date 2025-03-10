import {
  EVMNetwork,
  Network,
  SVMNetwork,
  WalletProviderChoice,
  AgentkitRouteConfiguration,
  Framework,
  Template,
} from "./types";

export const EVM_NETWORKS: EVMNetwork[] = [
  "base-mainnet",
  "base-sepolia",
  "ethereum-mainnet",
  "ethereum-sepolia",
  "arbitrum-mainnet",
  "arbitrum-sepolia",
  "optimism-mainnet",
  "optimism-sepolia",
  "polygon-mainnet",
  "polygon-mumbai",
];

export const SVM_NETWORKS: SVMNetwork[] = ["solana-mainnet", "solana-devnet", "solana-testnet"];

const CDP_SUPPORTED_EVM_WALLET_PROVIDERS: WalletProviderChoice[] = [
  "CDP",
  "SmartWallet",
  "Viem",
  "Privy",
];
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

export const AgentkitRouteConfigurations: Record<
  "EVM" | "CUSTOM_EVM" | "SVM",
  Partial<Record<WalletProviderChoice, AgentkitRouteConfiguration>>
> = {
  EVM: {
    CDP: {
      env: {
        topComments: ["Get keys from CDP Portal: https://portal.cdp.coinbase.com/"],
        required: ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
        optional: [],
      },
      prepareAgentkitRoute: "evm/cdp/prepare-agentkit.ts",
    },
    Viem: {
      env: {
        topComments: [
          "Export private key from your Ethereum wallet and save",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["PRIVATE_KEY"],
        optional: ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
      },
      prepareAgentkitRoute: "evm/viem/prepare-agentkit.ts",
    },
    Privy: {
      env: {
        topComments: [
          "Get keys from Privy Dashboard: https://dashboard.privy.io/",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["PRIVY_APP_ID", "PRIVY_APP_SECRET"],
        optional: [
          "CHAIN_ID",
          "PRIVY_WALLET_ID",
          "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
          "PRIVY_WALLET_AUTHORIZATION_KEY_ID",
          "CDP_API_KEY_NAME",
          "CDP_API_KEY_PRIVATE_KEY",
        ],
      },
      prepareAgentkitRoute: "evm/privy/prepare-agentkit.ts",
    },
    SmartWallet: {
      env: {
        topComments: [
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
          "Optionally provide a private key, otherwise one will be generated",
        ],
        required: ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
        optional: ["PRIVATE_KEY"],
      },
      prepareAgentkitRoute: "evm/smart/prepare-agentkit.ts",
    },
  },
  CUSTOM_EVM: {
    Viem: {
      env: {
        topComments: [
          "Export private key from your Ethereum wallet and save",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["PRIVATE_KEY"],
        optional: ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
      },
      prepareAgentkitRoute: "custom-evm/viem/prepare-agentkit.ts",
    },
  },
  SVM: {
    SolanaKeypair: {
      env: {
        topComments: [
          "Export private key from your Solana wallet and save",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["SOLANA_PRIVATE_KEY"],
        optional: ["SOLANA_RPC_URL", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
      },
      prepareAgentkitRoute: "svm/solanaKeypair/prepare-agentkit.ts",
    },
    Privy: {
      env: {
        topComments: [
          "Get keys from Privy Dashboard: https://dashboard.privy.io/",
          "Get keys from CDP Portal: https://portal.cdp.coinbase.com/",
        ],
        required: ["PRIVY_APP_ID", "PRIVY_APP_SECRET"],
        optional: [
          "PRIVY_WALLET_ID",
          "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
          "PRIVY_WALLET_AUTHORIZATION_KEY_ID",
          "CDP_API_KEY_NAME",
          "CDP_API_KEY_PRIVATE_KEY",
        ],
      },
      prepareAgentkitRoute: "svm/privy/prepare-agentkit.ts",
    },
  },
};

export const Frameworks: Framework[] = ["Langchain", "Vercel AI SDK", "Model Context Protocol"];

export const Templates: Template[] = ["next", "mcpServer"];

export const FrameworkToTemplates: Record<Framework, Template[]> = {
  "Langchain": ["next"],
  "Vercel AI SDK": ["next"],
  "Model Context Protocol": ["mcpServer"],
};

export type NextTemplateRouteConfiguration = {
  createAgentRoute: `${string}.ts`,
  apiRoute: `${string}.ts`,
};

export const NextTemplateRouteConfigurations: Partial<Record<Framework, NextTemplateRouteConfiguration>> = {
  "Langchain": {
    apiRoute: "langchain/route.ts",
    createAgentRoute: "langchain/create-agent.ts",
  },
  "Vercel AI SDK": {
    apiRoute: "vercel-ai-sdk/route.ts",
    createAgentRoute: "vercel-ai-sdk/create-agent.ts",
  },
};
