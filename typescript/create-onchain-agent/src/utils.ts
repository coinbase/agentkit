import fs from 'fs/promises';
import path from 'path';

export type EVMNetwork =  "ethereum-mainnet" | "ethereum-sepolia" | "polygon-mainnet" | "polygon-mumbai" | "base-mainnet" |  "base-sepolia" | "arbitrum-mainnet" | "arbitrum-sepolia" | "optimism-mainnet" | "optimism-sepolia";
export type SVMNetwork = "solana-mainnet" | "solana-devnet" | "solana-testnet";
export type Network = EVMNetwork | SVMNetwork;

export const NetworkToWalletProviders: Record<Network, WalletProviderChoice[]> = {
  "arbitrum-mainnet": ["CDP", "Viem", "Privy"],
  "arbitrum-sepolia": ["Viem", "Privy"],
  "base-mainnet": ["CDP","Viem", "Privy" ],
  "base-sepolia": ["CDP", "Viem", "Privy"],
  "ethereum-mainnet": ["CDP", "Viem", "Privy"],
  "ethereum-sepolia": ["Viem", "Privy"],
  "optimism-mainnet": ["Viem", "Privy"],
  "optimism-sepolia": ["Viem", "Privy"],
  "polygon-mainnet": ["CDP", "Viem", "Privy"],
  "polygon-mumbai": ["Viem", "Privy"],
  "solana-mainnet": ["SolanaKeypair", "Privy"],
  "solana-devnet": ["SolanaKeypair", "Privy"],
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

export const WalletProviderRouteConfigurations: Record<WalletProviderChoice, WalletProviderRouteConfiguration> = {
    CDP: {
        env: ['NETWORK_ID', 'CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY'],
        apiRoute: 'cdp/route.ts'
    },
    Viem: {
        env: ['NETWORK_ID', 'PRIVATE_KEY'],
        apiRoute: 'viem/route.ts'
    },
    Privy: {
        env: ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'PRIVY_WALLET_ID', 'CHAIN_ID', 'PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY', 'PRIVY_WALLET_AUTHORIZATION_KEY_ID'],
        apiRoute: 'privy/route.ts'
    },
    SolanaKeypair: {
        env: ['NETWORK_ID', 'SOLANA_RPC_URL', 'SOLANA_PRIVATE_KEY'],
        apiRoute: 'solanaKeypair/route.ts'
    },
}

export async function handleWalletProviderSelection(root: string, walletProvider: WalletProviderChoice, network: Network) {
  const agentDir = path.join(root, "app", "api", "agent");
  const selectedRouteConfig = WalletProviderRouteConfigurations[walletProvider];

  // Create .env file
  const envPath = path.join(root, ".env");
  await fs.writeFile(
    envPath,
    `NETWORK_ID=${network}\nOPENAI_API_KEY=\n${selectedRouteConfig.env.map(envVar => `${envVar}=`).join('\n')}`
  );

  // Promote selected route (move `apiRoute` to `api/agent/route.ts`)
  const selectedRoutePath = path.join(agentDir, selectedRouteConfig.apiRoute);
  const newRoutePath = path.join(agentDir, "route.ts");

  await fs.rename(selectedRoutePath, newRoutePath);

  // Delete all unselected routes
  const providerRoutes = Object.values(WalletProviderRouteConfigurations).map((config) => path.join(agentDir, config.apiRoute));
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
}
