import {
  AgentkitRouteConfiguration,
  PrepareAgentkitRouteConfiguration,
  MCPRouteConfiguration,
} from "./types.js";

export const EVM_NETWORKS = [
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
] as const;

export type EVMNetwork = (typeof EVM_NETWORKS)[number];

export const SVM_NETWORKS = ["solana-mainnet", "solana-devnet", "solana-testnet"] as const;

export type SVMNetwork = (typeof SVM_NETWORKS)[number];

export type Network = EVMNetwork | SVMNetwork;

const CDP_SUPPORTED_EVM_WALLET_PROVIDERS = ["SmartWallet", "CDP", "Viem", "Privy"] as const;
const SVM_WALLET_PROVIDERS = ["SolanaKeypair", "Privy"] as const;
export const NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS = ["Viem", "Privy"] as const;

export type WalletProviderChoice =
  | (typeof CDP_SUPPORTED_EVM_WALLET_PROVIDERS)[number]
  | (typeof SVM_WALLET_PROVIDERS)[number]
  | (typeof NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS)[number];

export const NetworkToWalletProviders: Record<Network, readonly WalletProviderChoice[]> = {
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
        required: ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
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
        optional: ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
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
          "CDP_API_KEY_ID",
          "CDP_API_KEY_SECRET",
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
        required: ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
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
        optional: ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
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
        optional: ["SOLANA_RPC_URL", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
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
          "CDP_API_KEY_ID",
          "CDP_API_KEY_SECRET",
        ],
      },
      prepareAgentkitRoute: "svm/privy/prepare-agentkit.ts",
    },
  },
};

export const Frameworks = ["Langchain", "Vercel AI SDK", "Model Context Protocol"] as const;

export type Framework = (typeof Frameworks)[number];

export const Templates = ["next", "mcp", "prepareAgentkit", "createAgent"] as const;

export type Template = (typeof Templates)[number];

export const FrameworkToTemplates: Record<Framework, Template[]> = {
  Langchain: ["next"],
  "Vercel AI SDK": ["next"],
  "Model Context Protocol": ["mcp"],
};

export type NextTemplateRouteConfiguration = {
  createAgentRoute: `${string}.ts`;
  apiRoute: `${string}.ts`;
};

export const NextTemplateRouteConfigurations: Partial<
  Record<Framework, NextTemplateRouteConfiguration>
> = {
  Langchain: {
    apiRoute: "langchain/route.ts",
    createAgentRoute: "langchain/create-agent.ts",
  },
  "Vercel AI SDK": {
    apiRoute: "vercel-ai-sdk/route.ts",
    createAgentRoute: "vercel-ai-sdk/create-agent.ts",
  },
};

export const MCPRouteConfigurations: Record<
  "EVM" | "CUSTOM_EVM" | "SVM",
  Partial<Record<WalletProviderChoice, MCPRouteConfiguration>>
> = {
  EVM: {
    CDP: {
      getAgentkitRoute: "evm/cdp/getAgentKit.ts",
      configRoute: "evm/cdp/claude_desktop_config.json",
    },
    Viem: {
      getAgentkitRoute: "evm/viem/getAgentKit.ts",
      configRoute: "evm/viem/claude_desktop_config.json",
    },
    Privy: {
      getAgentkitRoute: "evm/privy/getAgentKit.ts",
      configRoute: "evm/privy/claude_desktop_config.json",
    },
    SmartWallet: {
      getAgentkitRoute: "evm/smart/getAgentKit.ts",
      configRoute: "evm/smart/claude_desktop_config.json",
    },
  },
  CUSTOM_EVM: {
    Viem: {
      getAgentkitRoute: "custom-evm/viem/getAgentKit.ts",
      configRoute: "custom-evm/viem/claude_desktop_config.json",
    },
  },
  SVM: {
    SolanaKeypair: {
      getAgentkitRoute: "svm/solana-keypair/getAgentKit.ts",
      configRoute: "svm/solana-keypair/claude_desktop_config.json",
    },
    Privy: {
      getAgentkitRoute: "svm/privy/getAgentKit.ts",
      configRoute: "svm/privy/claude_desktop_config.json",
    },
  },
};

export const PrepareAgentkitRouteConfigurations: Record<
  "EVM" | "CUSTOM_EVM" | "SVM",
  Partial<Record<WalletProviderChoice, PrepareAgentkitRouteConfiguration>>
> = {
  EVM: {
    CDP: {
      route: "evm/cdp/prepareAgentkit.ts",
    },
    Viem: {
      route: "evm/viem/prepareAgentkit.ts",
    },
    Privy: {
      route: "evm/privy/prepareAgentkit.ts",
    },
    SmartWallet: {
      route: "evm/smart/prepareAgentkit.ts",
    },
  },
  CUSTOM_EVM: {
    Viem: {
      route: "custom-evm/viem/prepareAgentkit.ts",
    },
  },
  SVM: {
    SolanaKeypair: {
      route: "svm/solana-keypair/prepareAgentkit.ts",
    },
    Privy: {
      route: "svm/privy/prepareAgentkit.ts",
    },
  },
};
