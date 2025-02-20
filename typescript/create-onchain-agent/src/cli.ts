#!/usr/bin/env node
import fs from "fs";
import ora from "ora";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { Networks, NetworkToWalletProviders, NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS } from "./constants.js";
import { Network, WalletProviderChoice } from "./types.js";
import { copyTemplate } from "./fileSystem.js";
import {
  handleSelection,
  isValidPackageName,
  toValidPackageName
} from "./utils.js";

async function init() {
  console.log(
    `${pc.blue(`
 █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████ 
██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██    
███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██    
██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██    
██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██    
                                                                  
           Giving every AI agent a crypto wallet
`)}`
  );

  const defaultProjectName = "onchain-agent";

  let result: prompts.Answers<"projectName" | "packageName" | 'walletProvider' | 'network' | 'chainId'>;

  try {
    result = await prompts(
      [
        {
          type: "text",
          name: "projectName",
          message: pc.reset("Project name:"),
          initial: defaultProjectName,
          onState: (state) => {
            state.value = state.value.trim();
          },
          validate: (value) => {
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
          initial: (_, { projectName }: { projectName: string }) =>
            toValidPackageName(projectName),
          validate: (dir) =>
            isValidPackageName(dir) || "Invalid package.json name",
        },
        {
          type: "select",
          name: "network",
          message: pc.reset("Choose a network:"),
          choices: Networks.map((network) => ({
            title: network === "base-sepolia" ? `${network} (default)` : network,
            value: network as Network | null,
          })).concat([{ title: 'other', value: null}]),
          initial: Networks.indexOf("base-sepolia"),
        },
        {
          type: (prev, { network }) => network === null ? "text" : null,
          name: "chainId",
          message: pc.reset("Enter your Ethereum chain ID:"),
          validate: (value) => value.trim() ? Number.parseInt(value) ? true : "Chain ID must be a number." : "Chain ID cannot be empty.",
        },
        {
          type: (prev, { network }) => !network || NetworkToWalletProviders[network as Network].length > 1 ? "select" : null,
          name: "walletProvider",
          message: pc.reset("Choose a wallet provider:"),
          choices: (prev, { network, chainId }) => {
            let walletProviderChoises: WalletProviderChoice[];

            if (network) {
              walletProviderChoises = NetworkToWalletProviders[network as Network];
            }
            else {
              walletProviderChoises = NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS;
            }

            return walletProviderChoises.map((provider) => ({
              title: provider === walletProviderChoises[0] ? `${provider} (default)` : provider,
              value: provider,
            }))
          },
          initial: 0,
        },
      ],
      {
        onCancel: () => {
          console.log("\nProject creation cancelled.");
          process.exit(0);
        },
      }
    );
  } catch (cancelled: any) {
    console.log(cancelled.message);
    process.exit(1);
  }
  const { projectName, packageName, network, chainId, walletProvider } = result;

  const spinner = ora(`Creating ${projectName}...`).start();

  // Copy template over to new project 
  const root = await copyTemplate(projectName, packageName);

  // Handle selection-specific logic over copied-template
  await handleSelection(root, walletProvider, network, chainId)

  spinner.succeed();
  console.log(pc.blueBright(`\nSuccessfully created your AgentKit project in ${root}`));

  console.log(`\nFrameworks:`);
  console.log(pc.gray("- AgentKit"));
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

  console.log(pc.bold("\nLearn more"));
  console.log("   - Checkout the docs");
  console.log(pc.blueBright("      - https://docs.cdp.coinbase.com/agentkit/docs/welcome"));
  console.log("   - Visit the repo");
  console.log(pc.blueBright("      - http://github.com/coinbase/agentkit"));
  console.log("   - Join the community");
  console.log(pc.blueBright("      - https://discord.gg/CDP"));
}

init().catch((e) => {
  console.error(e);
});
