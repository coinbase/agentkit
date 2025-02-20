import fs from 'fs/promises';
import path from 'path';
import { EVMNetwork, Network, SVMNetwork, WalletProviderChoice } from './types';
import { EVM_NETWORKS, SVM_NETWORKS, WalletProviderRouteConfigurations } from './constants.js';

export function getNetworkFamily(network: EVMNetwork | SVMNetwork) {
  return EVM_NETWORKS.has(network as EVMNetwork) ? 'EVM' : SVM_NETWORKS.has(network as SVMNetwork) ? 'SVM' : undefined;
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

export async function handleSelection(root: string, walletProvider: WalletProviderChoice, network?: Network, chainId?: string) {
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
  const envLines = [
    // Start file with notes regarding .env var setup
    ...["Get keys from OpenAI Platform: https://platform.openai.com/api-keys", ...selectedRouteConfig.env.topComments].map(comment => `# ${comment}`).join("\n"),
    // Continue with # Required section
    "\n\n# Required\n",
    ...["OPENAI_API_KEY=", ...selectedRouteConfig.env.required].join("\n"),
    // Finish with # Optional section
    "\n\n# Optional\n",
    ...[`NETWORK_ID=${network}`, ...selectedRouteConfig.env.optional].join("\n")
  ]
  await fs.writeFile(
    envPath,
    envLines
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
