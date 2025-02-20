import fs from 'fs/promises';
import path from 'path';

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

const EVM_NETWORKS: Set<string> = new Set<EVMNetwork>([
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

const SVM_NETWORKS: Set<string> = new Set<SVMNetwork>([
  "solana-mainnet",
  "solana-devnet",
  "solana-testnet",
]);

export function getNetworkFamily(network: EVMNetwork | SVMNetwork) {
  return EVM_NETWORKS.has(network) ? 'EVM' : SVM_NETWORKS.has(network) ? 'SVM' : undefined;
}

export const CDP_SUPPORTED_EVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["CDP", "Viem", "Privy"];
export const NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["Viem", "Privy"];
export const SVM_WALLET_PROVIDERS: WalletProviderChoice[] = ["SolanaKeypair", "Privy"]

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
  "solana-testnet": ["SolanaKeypair", "Privy"]
}

export const Networks: Network[] = ["ethereum-mainnet", "ethereum-sepolia", "base-mainnet", "base-sepolia", "arbitrum-mainnet", "arbitrum-sepolia", "optimism-mainnet", "optimism-sepolia", "polygon-mainnet", "polygon-mumbai", "solana-mainnet", "solana-devnet", "solana-testnet" ]

export type WalletProviderChoice = 'CDP' | 'Viem' | 'Privy' | 'SolanaKeypair'
export const WalletProviderChoices: WalletProviderChoice[] = ['CDP', 'Viem', 'Privy', 'SolanaKeypair']
type WalletProviderRouteConfiguration = {
    env: string[];
    apiRoute: string
}

async function copyFile(src: string, dest: string) {
  await fs.copyFile(src, dest);
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    })
  );
}

export async function optimizedCopy(src: string, dest: string) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await copyDir(src, dest);
  } else {
    await copyFile(src, dest);
  }
}

export function createClickableLink(text: string, url: string): string {
  // OSC 8 ;; URL \a TEXT \a
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

export function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName
  );
}

export function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-');
}

export function detectPackageManager(): string {
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.startsWith('yarn')) {
      return 'yarn';
    }
    if (process.env.npm_config_user_agent.startsWith('pnpm')) {
      return 'pnpm';
    }
    if (process.env.npm_config_user_agent.startsWith('npm')) {
      return 'npm';
    }
    if (process.env.npm_config_user_agent.startsWith('bun')) {
      return 'bun';
    }
  }
  return 'npm'; // default to npm if unable to detect
}

export const WalletProviderRouteConfigurations: Record<('EVM' | 'SVM'), Partial<Record<WalletProviderChoice, WalletProviderRouteConfiguration>>> = {
    EVM: {
      CDP: {
          env: ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY'],
          apiRoute: 'evm/cdp/route.ts'
      },
      Viem: {
          env: ['PRIVATE_KEY'],
          apiRoute: 'evm/viem/route.ts'
      },
      Privy: {
          env: ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'PRIVY_WALLET_ID', 'CHAIN_ID', 'PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY', 'PRIVY_WALLET_AUTHORIZATION_KEY_ID'],
          apiRoute: 'evm/privy/route.ts'
      },
    },
    SVM: {
      SolanaKeypair: {
          env: ['SOLANA_RPC_URL', 'SOLANA_PRIVATE_KEY'],
          apiRoute: 'svm/solanaKeypair/route.ts'
      },
      Privy: {
          env: ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'PRIVY_WALLET_ID', 'CHAIN_ID', 'PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY', 'PRIVY_WALLET_AUTHORIZATION_KEY_ID'],
          apiRoute: 'svm/privy/route.ts'
      },
    }
}

export async function handleWalletProviderSelection(root: string, walletProvider: WalletProviderChoice, network?: Network, chainId?: string) {
  const agentDir = path.join(root, "app", "api", "agent");

  let networkFamily: ReturnType<typeof getNetworkFamily>;
  if (network) {
    networkFamily = getNetworkFamily(network);
  }
  else if (chainId) {
    networkFamily = 'EVM';
  }
  else {
    throw new Error('Unsupported network and chainId selected');
  }

  const selectedRouteConfig = WalletProviderRouteConfigurations[networkFamily!][walletProvider];

  if (!selectedRouteConfig) {
    throw new Error('Selected invalid network & wallet provider combination')
  }

  // Create .env file
  const envPath = path.join(root, ".env.local");
  await fs.writeFile(
    envPath,
    `NETWORK_ID=${network}\nOPENAI_API_KEY=\n${selectedRouteConfig.env.map(envVar => `${envVar}=`).join('\n')}`
  );

  // Promote selected route (move `apiRoute` to `api/agent/route.ts`)
  const selectedRoutePath = path.join(agentDir, selectedRouteConfig.apiRoute);
  const newRoutePath = path.join(agentDir, "route.ts");

  await fs.rename(selectedRoutePath, newRoutePath);

  // Delete all unselected routes
  const allRouteConfigurations = Object.values(WalletProviderRouteConfigurations).flatMap(routeConfigurations => Object.values(routeConfigurations)).filter(x => x);
  const providerRoutes = allRouteConfigurations.map((config) => path.join(agentDir, config.apiRoute));
  for (const routePath of providerRoutes) {
    // Remove file
    await fs.rm(routePath, { recursive: true, force: true });

    // If directory is empty, remove directory
    try {
      const parentFolder = path.dirname(routePath);
      const files = await fs.readdir(parentFolder);
      if (files.length === 0) {
        await fs.rm(parentFolder, { recursive: true, force: true });
      }
    } catch (error) {
      // Skip removing directory
    }
  }
  await fs.rm(path.join(agentDir, 'evm'), { recursive: true, force: true });
  await fs.rm(path.join(agentDir, 'svm'), { recursive: true, force: true });
}
