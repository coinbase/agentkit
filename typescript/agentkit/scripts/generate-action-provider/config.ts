import { CliArgs } from "./args";
import {
  promptForName,
  promptForOverwrite,
  promptForProtocolFamily,
  promptForWalletProvider,
  shouldPromptForWalletProvider,
} from "./prompts";
import { ProviderConfig } from "./types";
import { providerExists, validateName } from "./utils";

/**
 * Prepare provider configuration from CLI args with interactive prompt fallbacks
 */
export async function prepareProviderConfig(args: CliArgs): Promise<ProviderConfig> {
  if (!args.name && !args.protocolFamily && !args.networks && !args.walletProvider) {
    args.interactive = true;
  }

  // always get a valid name first
  let resolvedName = args.name;
  if (!resolvedName || !validateName(resolvedName)) {
    resolvedName = await promptForName();
  }

  // check if provider exists and prompt for overwrite
  if (providerExists(resolvedName)) {
    const shouldOverwrite = await promptForOverwrite(resolvedName);
    if (!shouldOverwrite) {
      throw new Error("Action provider creation cancelled - provider already exists");
    }
  }

  // start with provided values
  const config: ProviderConfig = {
    name: resolvedName,
    protocolFamily: args.protocolFamily ?? null,
    networkIds: args.networks || [],
    walletProvider: args.walletProvider || undefined,
    providerKey: "default",
  };

  // set default wallet providers by protocol
  if (!config.walletProvider) {
    switch (config.protocolFamily) {
      case "evm":
        config.walletProvider = "EvmWalletProvider";
        break;
      case "svm":
        config.walletProvider = "SvmWalletProvider";
        break;
    }
  }

  if (!args.interactive) {
    return config;
  }

  // handle missing values in interactive mode
  if (!config.protocolFamily) {
    config.protocolFamily = await promptForProtocolFamily();
  }

  // handle wallet provider in interactive mode
  if (config.protocolFamily && config.protocolFamily !== "none" && !config.walletProvider) {
    if (config.protocolFamily !== "all" && (await shouldPromptForWalletProvider())) {
      config.walletProvider = await promptForWalletProvider(config.protocolFamily);
    } else if (config.protocolFamily === "evm") {
      config.walletProvider = "EvmWalletProvider";
    } else if (config.protocolFamily === "svm") {
      config.walletProvider = "SvmWalletProvider";
    } else if (config.protocolFamily !== "all") {
      config.walletProvider = "WalletProvider";
    }
  }

  // convert special values to null
  if (config.protocolFamily === "all" || config.protocolFamily === "none") {
    config.protocolFamily = null;
  }

  // Set provider key
  config.providerKey = config.walletProvider ? "walletProvider" : "default";

  return config;
}
