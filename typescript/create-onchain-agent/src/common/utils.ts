import fs from "fs/promises";
import path from "path";
import { EVMNetwork, Framework, Network, SVMNetwork, WalletProviderChoice } from "./types.js";
import {
  EVM_NETWORKS,
  NetworkToWalletProviders,
  NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  SVM_NETWORKS,
  AgentkitRouteConfigurations,
  NextTemplateRouteConfigurations,
  MCPRouteConfigurations,
} from "./constants.js";

/**
 * Copied from `@coinbase/agentkit` so that we don't need to depend on it.
 * Maps EVM chain IDs to Coinbase network IDs
 */
export const CHAIN_ID_TO_NETWORK_ID: Record<number, string> = {
  1: "ethereum-mainnet",
  11155111: "ethereum-sepolia",
  137: "polygon-mainnet",
  80001: "polygon-mumbai",
  8453: "base-mainnet",
  84532: "base-sepolia",
  42161: "arbitrum-mainnet",
  421614: "arbitrum-sepolia",
  10: "optimism-mainnet",
  11155420: "optimism-sepolia",
};

/**
 * Copied from `@coinbase/agentkit` so that we don't need to depend on it.
 * Maps Coinbase network IDs to EVM chain IDs
 */
export const NETWORK_ID_TO_CHAIN_ID: Record<string, string> = Object.entries(
  CHAIN_ID_TO_NETWORK_ID,
).reduce(
  (acc, [chainId, networkId]) => {
    acc[networkId] = String(chainId);
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Determines the network family based on the provided network.
 *
 * @param {EVMNetwork | SVMNetwork} network - The network to check.
 * @param {string} chainId - The chain ID to check.
 * @returns {"EVM" | "SVM" | undefined} The network family, or `undefined` if not recognized.
 */
export function getNetworkType(
  network?: EVMNetwork | SVMNetwork,
  chainId?: string,
): "EVM" | "SVM" | "CUSTOM_EVM" | null {
  if (network) {
    if (EVM_NETWORKS.includes(network as EVMNetwork)) {
      return "EVM";
    }
    if (SVM_NETWORKS.includes(network as SVMNetwork)) {
      return "SVM";
    }
  }

  if (chainId) {
    return "CUSTOM_EVM";
  }

  return null;
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
export const getWalletProviders = (network?: Network): readonly WalletProviderChoice[] => {
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
 * @param {Framework} framework - The selected framework.
 * @param {WalletProviderChoice} walletProvider - The selected wallet provider.
 * @param {Network} [network] - The optional blockchain network.
 * @param {string} [chainId] - The optional chain ID for the network.
 * @param {string} [rpcUrl] - The optional RPC URL for the network.
 * @throws {Error} If neither `network` nor `chainId` are provided, or if the selected combination is invalid.
 * @returns {Promise<void>} A promise that resolves when the selection process is complete.
 */
export async function handleNextSelection(
  root: string,
  framework: Framework,
  walletProvider: WalletProviderChoice,
  network?: Network,
  chainId?: string,
  rpcUrl?: string,
): Promise<void> {
  const agentDir = path.join(root, "app", "api", "agent");

  const networkFamily = getNetworkType(network, chainId);
  if (!networkFamily) {
    throw new Error("Unsupported network and chainId selected");
  }

  const agentkitRouteConfig = AgentkitRouteConfigurations[networkFamily][walletProvider];
  const frameworkRouteConfig = NextTemplateRouteConfigurations[framework];

  if (!agentkitRouteConfig) {
    throw new Error("Selected invalid network & wallet provider combination");
  }

  if (!frameworkRouteConfig) {
    throw new Error("Selected invalid framework for this template");
  }

  // Create .env file
  const envPath = path.join(root, ".env.local");
  const envLines = [
    // Start file with notes regarding .env var setup
    ...[
      "Get keys from OpenAI Platform: https://platform.openai.com/api-keys",
      ...agentkitRouteConfig.env.topComments,
    ]
      .map(comment => `# ${comment}`)
      .join("\n"),
    // Continue with # Required section
    "\n\n# Required\n",
    ...["OPENAI_API_KEY=", ...agentkitRouteConfig.env.required.map(line => `${line}=`)].join("\n"),
    // Finish with # Optional section
    "\n\n# Optional\n",
    ...[
      `NETWORK_ID=${network ?? ""}`,
      rpcUrl ? `RPC_URL=${rpcUrl}` : null,
      chainId ? `CHAIN_ID=${chainId}` : null,
      ...agentkitRouteConfig.env.optional.map(line => `${line}=`),
    ]
      .filter(Boolean)
      .join("\n"),
  ];
  await fs.writeFile(envPath, envLines);

  // Promose selected routes to
  const promoteRoute = async (toPromose: string, type: string, to: string) => {
    const selectedRoutePath = path.join(agentDir, type, toPromose);
    const newRoutePath = path.join(agentDir, to);
    await fs.rename(selectedRoutePath, newRoutePath);
  };

  await promoteRoute(agentkitRouteConfig.prepareAgentkitRoute, "agentkit", "prepare-agentkit.ts");
  await promoteRoute(frameworkRouteConfig.createAgentRoute, "framework", "create-agent.ts");
  await promoteRoute(frameworkRouteConfig.apiRoute, "framework", "route.ts");

  // Delete boilerplate routes
  await fs.rm(path.join(agentDir, "agentkit"), { recursive: true, force: true });
  await fs.rm(path.join(agentDir, "framework"), { recursive: true, force: true });
}

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
 * @param {string} [rpcUrl] - The optional RPC URL for the network.
 *
 * @returns {Promise<void>} A promise that resolves when the function completes.
 */
export async function handleMcpSelection(
  root: string,
  walletProvider: WalletProviderChoice,
  network?: Network,
  chainId?: string,
  rpcUrl?: string,
): Promise<void> {
  const srcDir = path.join(root, "src");

  const networkFamily = getNetworkType(network, chainId);
  if (!networkFamily) {
    throw new Error("Unsupported network and chainId selected");
  }

  const mcpConfig = MCPRouteConfigurations[networkFamily][walletProvider];
  if (!mcpConfig) {
    throw new Error("Selected invalid network & wallet provider combination");
  }

  /**
   * Copies the claude_desktop_config.json file to the root directory
   * and replaces the {parentFolderPath} placeholder with the absolute path.
   */
  async function copyAndReplaceConfig() {
    const existingConfig = await fs.readFile(
      path.join(srcDir, "agentkit", mcpConfig!.configRoute),
      "utf-8",
    );
    const configJson = JSON.parse(existingConfig);

    configJson.mcpServers.agentkit.args[0] = configJson.mcpServers.agentkit.args[0].replace(
      "{absolutePath}",
      root,
    );

    if (network) {
      // privy uses CHAIN_ID, others use NETWORK_ID
      if (configJson.mcpServers.agentkit.env.NETWORK_ID) {
        configJson.mcpServers.agentkit.env.NETWORK_ID = network;
      }

      if (configJson.mcpServers.agentkit.env.CHAIN_ID) {
        configJson.mcpServers.agentkit.env.CHAIN_ID = NETWORK_ID_TO_CHAIN_ID[network];
      }
    }

    if (chainId) {
      configJson.mcpServers.agentkit.env.CHAIN_ID = chainId;
    }

    if (rpcUrl) {
      configJson.mcpServers.agentkit.env.RPC_URL = rpcUrl;
    }

    await fs.writeFile(
      path.join(root, "claude_desktop_config.json"),
      JSON.stringify(configJson, null, 2),
    );
  }

  // Promote selected routes to
  const promoteRoute = async (toPromote: string, to: string) => {
    const selectedRoutePath = path.join(srcDir, "agentkit", toPromote);
    const newRoutePath = path.join(srcDir, to);
    await fs.rename(selectedRoutePath, newRoutePath);
  };

  await copyAndReplaceConfig();

  await promoteRoute(mcpConfig.getAgentkitRoute, "getAgentKit.ts");

  await fs.rm(path.join(srcDir, "agentkit"), { recursive: true, force: true });
}

/**
 * Converts a string to camel case
 *
 * @param str - The string to convert to camel case
 * @returns The camel case version of the string
 */
export function toCamelCase(str: string): string {
  // First character should be lowercase
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Converts a string to snake case
 *
 * @param str - The string to convert to snake case
 * @returns The snake case version of the string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Converts a string to a class name
 *
 * @param str - The string to convert to class name
 * @returns The class name version of the string
 */
export function toClassName(str: string): string {
  // Capitalize first letter of each word, remove any "Provider" suffix
  return str
    .split(/(?=[A-Z])|[\s_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}
