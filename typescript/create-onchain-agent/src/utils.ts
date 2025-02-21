import fs from "fs/promises";
import path from "path";
import { EVMNetwork, Network, SVMNetwork, WalletProviderChoice } from "./types";
import {
  EVM_NETWORKS,
  NetworkToWalletProviders,
  NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  SVM_NETWORKS,
  WalletProviderRouteConfigurations,
} from "./constants.js";

/**
 * Determines the network family based on the provided network.
 *
 * @param {EVMNetwork | SVMNetwork} network - The network to check.
 * @returns {"EVM" | "SVM" | undefined} The network family, or `undefined` if not recognized.
 */
export function getNetworkFamily(network: EVMNetwork | SVMNetwork): "EVM" | "SVM" | undefined {
  return EVM_NETWORKS.has(network as EVMNetwork)
    ? "EVM"
    : SVM_NETWORKS.has(network as SVMNetwork)
      ? "SVM"
      : undefined;
}

/**
 * Copies a file from the source path to the destination path.
 *
 * @param {string} src - The source file path.
 * @param {string} dest - The destination file path.
 * @returns {Promise<void>} A promise that resolves when the file is copied.
 */
async function copyFile(src: string, dest: string): Promise<void> {
  await fs.copyFile(src, dest);
}

/**
 * Recursively copies a directory from the source path to the destination path.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @returns {Promise<void>} A promise that resolves when the directory and its contents are copied.
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async entry => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }),
  );
}
/**
 * Recursively copies a file or directory from the source path to the destination path.
 *
 * @param {string} src - The source file or directory path.
 * @param {string} dest - The destination file or directory path.
 * @returns {Promise<void>} A promise that resolves when the copy operation is complete.
 */
export async function optimizedCopy(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await copyDir(src, dest);
  } else {
    await copyFile(src, dest);
  }
}

/**
 * Generates a clickable terminal hyperlink using ANSI escape codes.
 *
 * @param {string} text - The display text for the link.
 * @param {string} url - The URL the link points to.
 * @returns {string} The formatted clickable link string.
 */
export function createClickableLink(text: string, url: string): string {
  // OSC 8 ;; URL \a TEXT \a
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

/**
 * Validates whether a given string is a valid npm package name.
 *
 * @param {string} projectName - The package name to validate.
 * @returns {boolean} `true` if the package name is valid, otherwise `false`.
 */
export function isValidPackageName(projectName: string): boolean {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(projectName);
}

/**
 * Converts a given project name into a valid npm package name.
 *
 * @param {string} projectName - The input project name.
 * @returns {string} A sanitized, valid npm package name.
 */
export function toValidPackageName(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z\d\-~]+/g, "-");
}

/**
 * Detects the package manager currently being used.
 *
 * Checks the `npm_config_user_agent` environment variable to determine if `npm`, `yarn`, `pnpm`, or `bun` is being used.
 * If no package manager is detected, it defaults to `npm`.
 *
 * @returns {string} The detected package manager (`npm`, `yarn`, `pnpm`, or `bun`).
 */
export function detectPackageManager(): string {
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.startsWith("yarn")) {
      return "yarn";
    }
    if (process.env.npm_config_user_agent.startsWith("pnpm")) {
      return "pnpm";
    }
    if (process.env.npm_config_user_agent.startsWith("npm")) {
      return "npm";
    }
    if (process.env.npm_config_user_agent.startsWith("bun")) {
      return "bun";
    }
  }
  return "npm"; // Default to npm if unable to detect
}

/**
 * Retrieves the available wallet providers for a given blockchain network.
 *
 * - If a `network` is provided, returns the corresponding wallet providers.
 * - If no network is specified, returns a default list of EVM wallet providers.
 *
 * @param {Network} [network] - The optional network to get wallet providers for.
 * @returns {WalletProviderChoice[]} An array of wallet providers for the specified network.
 */
export const getWalletProviders = (network?: Network): WalletProviderChoice[] => {
  if (network) {
    return NetworkToWalletProviders[network];
  }
  return NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS;
};

/**
 * Handles the selection of a network and wallet provider, updating the project configuration accordingly.
 *
 * This function:
 * - Determines the network family (`EVM` or `SVM`) based on the provided network or chain ID.
 * - Retrieves the correct route configuration for the selected wallet provider.
 * - Creates or updates the `.env.local` file with required and optional environment variables.
 * - Moves the selected API route file to `api/agent/route.ts`.
 * - Deletes all unselected API routes and cleans up empty directories.
 *
 * @param {string} root - The root directory of the project.
 * @param {WalletProviderChoice} walletProvider - The selected wallet provider.
 * @param {Network} [network] - The optional blockchain network.
 * @param {string} [chainId] - The optional chain ID for the network.
 * @throws {Error} If neither `network` nor `chainId` are provided, or if the selected combination is invalid.
 * @returns {Promise<void>} A promise that resolves when the selection process is complete.
 */
export async function handleSelection(
  root: string,
  walletProvider: WalletProviderChoice,
  network?: Network,
  chainId?: string,
) {
  const agentDir = path.join(root, "app", "api", "agent");

  let networkFamily: ReturnType<typeof getNetworkFamily>;
  if (network) {
    networkFamily = getNetworkFamily(network);
  } else if (chainId) {
    networkFamily = "EVM";
  } else {
    throw new Error("Unsupported network and chainId selected");
  }

  const selectedRouteConfig = WalletProviderRouteConfigurations[networkFamily!][walletProvider];

  if (!selectedRouteConfig) {
    throw new Error("Selected invalid network & wallet provider combination");
  }

  // Create .env file
  const envPath = path.join(root, ".env.local");
  const envLines = [
    // Start file with notes regarding .env var setup
    ...[
      "Get keys from OpenAI Platform: https://platform.openai.com/api-keys",
      ...selectedRouteConfig.env.topComments,
    ]
      .map(comment => `# ${comment}`)
      .join("\n"),
    // Continue with # Required section
    "\n\n# Required\n",
    ...["OPENAI_API_KEY=", ...selectedRouteConfig.env.required].join("\n"),
    // Finish with # Optional section
    "\n\n# Optional\n",
    ...[`NETWORK_ID=${network}`, ...selectedRouteConfig.env.optional].join("\n"),
  ];
  await fs.writeFile(envPath, envLines);

  // Promote selected route (move `apiRoute` to `api/agent/route.ts`)
  const selectedRoutePath = path.join(agentDir, selectedRouteConfig.apiRoute);
  const newRoutePath = path.join(agentDir, "route.ts");

  await fs.rename(selectedRoutePath, newRoutePath);

  // Delete all unselected routes
  const allRouteConfigurations = Object.values(WalletProviderRouteConfigurations)
    .flatMap(routeConfigurations => Object.values(routeConfigurations))
    .filter(x => x);
  const providerRoutes = allRouteConfigurations.map(config => path.join(agentDir, config.apiRoute));
  for (const routePath of providerRoutes) {
    // Remove file
    await fs.rm(routePath, { recursive: true, force: true });

    // If directory is empty, remove directory
    const parentFolder = path.dirname(routePath);
    const files = await fs.readdir(parentFolder);
    if (files.length === 0) {
      await fs.rm(parentFolder, { recursive: true, force: true });
    }
  }
  await fs.rm(path.join(agentDir, "evm"), { recursive: true, force: true });
  await fs.rm(path.join(agentDir, "svm"), { recursive: true, force: true });
}
