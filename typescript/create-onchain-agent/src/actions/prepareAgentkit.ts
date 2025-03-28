import fs from "fs/promises";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import {
  EVM_NETWORKS,
  PrepareAgentkitRouteConfigurations,
  SVM_NETWORKS,
} from "../common/constants.js";
import { copyTemplate } from "../common/fileSystem.js";
import { Network, WalletProviderChoice } from "../common/types.js";
import { getNetworkType, getWalletProviders } from "../common/utils.js";

/**
 * Prompts user for network and wallet provider selection, then sets up the prepare-agentkit file
 * by promoting the correct template and cleaning up unused files.
 */
export async function prepareAgentKit() {
  let result: prompts.Answers<
    "networkFamily" | "networkType" | "network" | "chainId" | "rpcUrl" | "walletProvider"
  >;

  try {
    result = await prompts(
      [
        {
          type: "select",
          name: "networkFamily",
          message: pc.reset("Choose a network family:"),
          choices: [
            { title: "Ethereum Virtual Machine (EVM)", value: "EVM" },
            { title: "Solana Virtual Machine (SVM)", value: "SVM" },
          ],
        },
        {
          type: (prev, { networkFamily }) => (networkFamily === "EVM" ? "select" : null),
          name: "networkType",
          message: pc.reset("Choose network type:"),
          choices: [
            { title: "Mainnet", value: "mainnet" },
            { title: "Testnet", value: "testnet" },
            { title: "Custom Chain ID", value: "custom" },
          ],
        },
        {
          type: (prev, { networkFamily, networkType }) => {
            // For SVM, always show network selection
            if (networkFamily === "SVM") return "select";
            // For EVM, show network selection only if not custom
            return networkType === "custom" ? null : "select";
          },
          name: "network",
          message: pc.reset("Choose a network:"),
          choices: (prev, { networkFamily, networkType }) => {
            if (networkFamily === "SVM") {
              return SVM_NETWORKS.map(network => ({
                title: network,
                value: network as Network,
              }));
            } else {
              return EVM_NETWORKS.filter(n => {
                const isMainnet = n.includes("mainnet");
                return networkType === "mainnet" ? isMainnet : !isMainnet;
              }).map(network => ({
                title: network === "base-sepolia" ? `${network} (default)` : network,
                value: network as Network,
              }));
            }
          },
        },
        {
          type: (prev, { networkFamily, networkType }) =>
            networkFamily === "EVM" && networkType === "custom" ? "text" : null,
          name: "chainId",
          message: pc.reset("Enter your chain ID:"),
          validate: value =>
            value.trim()
              ? Number.parseInt(value)
                ? true
                : "Chain ID must be a number."
              : "Chain ID cannot be empty.",
        },
        {
          type: (prev, { networkFamily, networkType }) =>
            networkFamily === "EVM" && networkType === "custom" ? "text" : null,
          name: "rpcUrl",
          message: pc.reset("Enter your RPC URL:"),
          validate: value =>
            value.trim()
              ? value.startsWith("http")
                ? true
                : "RPC URL must start with http:// or https://"
              : "RPC URL cannot be empty.",
        },
        {
          type: (prev, { networkFamily, networkType }) => {
            // For custom EVM networks, auto-select Viem by returning null
            if (networkFamily === "EVM" && networkType === "custom") {
              return null;
            }
            return "select";
          },
          name: "walletProvider",
          message: (prev, { network }) => {
            const walletDescriptions: Record<WalletProviderChoice, string> = {
              SmartWallet: "Uses Coinbase Developer Platform (CDP)'s Smart Wallet.",
              CDP: "Uses Coinbase Developer Platform (CDP)'s managed wallet.",
              Viem: "Client-side Ethereum wallet.",
              Privy: "Authentication and wallet infrastructure.",
              SolanaKeypair: "Client-side Solana wallet.",
            };

            const providerDescriptions = getWalletProviders(network as Network)
              .map(provider => `  - ${provider}: ${walletDescriptions[provider]}`)
              .join("\n");

            return pc.reset(`Choose a wallet provider:\n${providerDescriptions}\n`);
          },
          choices: (prev, { network }) => {
            const walletProviders = getWalletProviders(network as Network);
            return walletProviders.map(provider => ({
              title: provider === walletProviders[0] ? `${provider} (default)` : provider,
              value: provider,
            }));
          },
        },
      ],
      {
        onCancel: () => {
          console.log("\nPrepare-agentkit creation cancelled.");
          process.exit(0);
        },
      },
    );
  } catch (error) {
    console.error("An error occurred during prepare-agentkit creation", error);
    process.exit(1);
  }

  const { network, chainId, walletProvider = "Viem" } = result;

  // Determine network type (EVM, CUSTOM_EVM, or SVM)
  const networkFamily = getNetworkType(network, chainId);
  if (!networkFamily) {
    throw new Error("Unsupported network and chainId selected");
  }

  // Get the route configuration for the selected wallet provider
  const routeConfig =
    PrepareAgentkitRouteConfigurations[networkFamily][walletProvider as WalletProviderChoice];
  if (!routeConfig) {
    throw new Error("Selected invalid network & wallet provider combination");
  }

  try {
    const root = await copyTemplate("prepareAgentkit", "prepareAgentkit");

    // Copy the selected route to the destination
    const selectedRoutePath = path.join(root, "agentkit", routeConfig.route);
    const newRoutePath = path.join(process.cwd(), "prepareAgentkit.ts");

    await fs.copyFile(selectedRoutePath, newRoutePath);

    const agentkitDir = path.join(root);
    await fs.rm(agentkitDir, { recursive: true, force: true });

    console.log(pc.green("Successfully created prepareAgentkit.ts"));
  } catch (error) {
    console.error("Error setting up prepareAgentkit:", error);
    process.exit(1);
  }
}
