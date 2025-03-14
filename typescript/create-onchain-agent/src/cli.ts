#!/usr/bin/env node
import fs from "fs";
import ora from "ora";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { EVM_NETWORKS, NetworkToWalletProviders, SVM_NETWORKS } from "./constants.js";
import { Network, WalletProviderChoice, Framework } from "./types.js";
import { copyTemplate } from "./fileSystem.js";
import {
  handleNextSelection,
  isValidPackageName,
  toValidPackageName,
  getWalletProviders,
  handleMcpSelection,
} from "./utils.js";
import { Frameworks, FrameworkToTemplates } from "./constants.js";

/**
 * Initializes the project creation process.
 *
 * - Prompts the user for project details including project name, package name, network, chain ID, and wallet provider.
 * - Validates user input, ensuring directories do not already exist and package names are valid.
 * - Copies the selected template to the new project directory.
 * - Handles network and wallet provider selection logic.
 * - Displays a summary of the created project along with next steps.
 */
async function init() {
  console.log(
    `${pc.blue(`
 █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████ 
██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██    
███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██    
██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██    
██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██    
                                                                   
           Giving every AI agent a crypto wallet
`)}`,
  );

  const defaultProjectName = "onchain-agent";

  let result: prompts.Answers<
    | "projectName"
    | "packageName"
    | "networkFamily"
    | "networkType"
    | "network"
    | "chainId"
    | "rpcUrl"
    | "walletProvider"
    | "framework"
    | "template"
  >;

  try {
    result = await prompts(
      [
        {
          type: "text",
          name: "projectName",
          message: pc.reset("Project name:"),
          initial: defaultProjectName,
          onState: state => {
            state.value = state.value.trim();
          },
          validate: value => {
            const targetDir = path.join(process.cwd(), value);
            if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
              return "Directory already exists and is not empty. Please choose a different name.";
            }
            return true;
          },
        },
        {
          type: (_, { projectName }: { projectName: string }) =>
            isValidPackageName(projectName) ? null : "text",
          name: "packageName",
          message: pc.reset("Package name:"),
          initial: (_, { projectName }: { projectName: string }) => toValidPackageName(projectName),
          validate: dir => isValidPackageName(dir) || "Invalid package.json name",
        },
        {
          type: "select",
          name: "framework",
          message: pc.reset("Choose a framework:"),
          choices: Frameworks.map(framework => ({
            title: framework,
            value: framework,
          })),
        },
        {
          type: (prev, { framework }) =>
            FrameworkToTemplates[framework as Framework].length > 1 ? "select" : null,
          name: "template",
          message: pc.reset("Choose a template:"),
          choices: (prev, { framework }) =>
            FrameworkToTemplates[framework as Framework].map(template => ({
              title: template,
              value: template,
            })),
        },
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
              // Show all Solana networks
              return SVM_NETWORKS.map(network => ({
                title: network,
                value: network as Network,
              }));
            } else {
              // Filter EVM networks by mainnet/testnet
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
            // For all other cases (regular EVM networks and SVM networks), show selection
            return "select";
          },
          name: "walletProvider",
          initial: (prev, { networkFamily, networkType, network }) => {
            // For custom EVM networks, use Viem
            if (networkFamily === "EVM" && networkType === "custom") {
              return "Viem";
            }
            // For networks with one provider, use that provider
            if (network && NetworkToWalletProviders[network as Network].length === 1) {
              return NetworkToWalletProviders[network as Network][0];
            }
            return 0;
          },
          message: (prev, { network }) => {
            const walletDescriptions: Record<WalletProviderChoice, string> = {
              CDP: "Uses Coinbase Developer Platform (CDP)'s managed wallet.",
              SmartWallet: "Uses Coinbase Developer Platform (CDP)'s Smart Wallet.",
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
          console.log("\nProject creation cancelled.");
          process.exit(0);
        },
      },
    );
  } catch (cancelled: unknown) {
    if (cancelled instanceof Error) {
      console.info(cancelled.message);
    } else {
      console.info("An unknown error occurred");
    }
    process.exit(1);
  }
  const { projectName, network, chainId, rpcUrl, framework } = result;
  const packageName = result.packageName || toValidPackageName(projectName);
  const walletProvider = result.walletProvider || "Viem";
  // If template wasn't selected (because there was only one option), use the first template
  const template = result.template || FrameworkToTemplates[framework as Framework][0];

  const spinner = ora(`Creating ${projectName}...`).start();

  // Copy template over to new project
  const root = await copyTemplate(projectName, packageName, template);

  // Handle selection-specific logic over copied-template
  switch (template) {
    case "next":
      await handleNextSelection(root, framework, walletProvider, network, chainId, rpcUrl);

      spinner.succeed();
      console.log(pc.blueBright(`\nSuccessfully created your AgentKit project in ${root}`));

      console.log(`\nFrameworks:`);
      console.log(pc.gray("- AgentKit"));
      console.log(pc.gray(`- ${framework}`));
      console.log(pc.gray("- React"));
      console.log(pc.gray("- Next.js"));
      console.log(pc.gray("- Tailwind CSS"));
      console.log(pc.gray("- ESLint"));

      console.log(pc.bold("\nWhat's Next?"));

      console.log(`\nTo get started, run the following commands:\n`);
      if (root !== process.cwd()) {
        console.log(` - cd ${path.relative(process.cwd(), root)}`);
      }
      console.log(" - npm install");
      console.log(pc.gray(" - # Open .env.local and configure your API keys"));
      console.log(" - mv .env.local .env");
      console.log(" - npm run dev");
      break;
    case "mcp":
      await handleMcpSelection(root, walletProvider, network, chainId);

      spinner.succeed();
      console.log(pc.blueBright(`\nSuccessfully created your AgentKit project in ${root}`));

      console.log(`\nTo get started, run the following commands:\n`);
      if (root !== process.cwd()) {
        console.log(` - cd ${path.relative(process.cwd(), root)}`);
      }
      console.log(" - npm install");
      console.log(" - npm run build");
      console.log(
        " - cp claude_desktop_config.json ~/Library/Application\\ Support/Claude/claude_desktop_config.json",
      );

      if (walletProvider === "CDP" || walletProvider === "SmartWallet") {
        console.log(
          " - # Make sure to open claude_desktop_config.json and configure your CDP API keys!",
        );
      }

      if (walletProvider === "Privy") {
        console.log(
          " - # Make sure to open claude_desktop_config.json and configure your Privy API keys!",
        );
      }

      console.log(
        "\nNow open Claude Desktop and start prompting Claude to do things onchain",
        "\nFor example, ask it to print your wallet details",
      );
      break;
    default:
      break;
  }

  console.log(pc.bold("\nLearn more"));
  console.log("   - Checkout the docs");
  console.log(pc.blueBright("      - https://docs.cdp.coinbase.com/agentkit/docs/welcome"));
  console.log("   - Visit the repo");
  console.log(pc.blueBright("      - http://github.com/coinbase/agentkit"));
  console.log("   - Join the community");
  console.log(pc.blueBright("      - https://discord.gg/CDP\n"));
}

init().catch(e => {
  console.error(e);
});
