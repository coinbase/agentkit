#!/usr/bin/env node
import fs from "fs";
import ora from "ora";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { fileURLToPath } from "url";
import {
  handleWalletProviderSelection,
  isValidPackageName,
  Network,
  Networks,
  NetworkToWalletProviders,
  NON_CDP_SUPPORTED_EVM_WALLET_PROVIDERS,
  optimizedCopy,
  toValidPackageName,
  WalletProviderChoice,
} from "./utils.js";

const sourceDir = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../templates/next"
);

const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
  "_env.local": ".env.local",
};

const excludeDirs = ["node_modules", ".next"];
const excludeFiles = [".DS_Store", "Thumbs.db"];

async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, renameFiles[entry.name] || entry.name);

    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        await copyDir(srcPath, destPath);
      }
    } else {
      if (!excludeFiles.includes(entry.name)) {
        await optimizedCopy(srcPath, destPath);
      }
    }
  }
}

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

  const root = path.join(process.cwd(), projectName);

  const spinner = ora(`Creating ${projectName}...`).start();

  await copyDir(sourceDir, root);

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
  pkg.name = packageName || toValidPackageName(projectName);
  await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

  await handleWalletProviderSelection(root, walletProvider, network, chainId)

  spinner.succeed();
  console.log(`\n${pc.blueBright(`Created new AgentKit project in ${root}`)}`);

  console.log(`\nFrameworks:`);
  console.log(`${pc.blueBright("- AgentKit")}`);
  console.log(`${pc.blueBright("- React")}`);
  console.log(`${pc.blueBright("- Next.js")}`);
  console.log(`${pc.blueBright("- Tailwind CSS")}`);
  console.log(`${pc.blueBright("- ESLint")}`);

  console.log(
    `\nTo get started with ${pc.blueBright(projectName)}, run the following commands:\n`
  );
  if (root !== process.cwd()) {
    console.log(` - cd ${path.relative(process.cwd(), root)}`);
  }
  console.log(" - npm install");
  console.log(" - mv .env.local .env");
  console.log(" - npm run dev");
}

init().catch((e) => {
  console.error(e);
});
