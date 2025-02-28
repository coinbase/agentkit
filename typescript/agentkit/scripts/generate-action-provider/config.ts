import { CliArgs } from "./args";
import { PROTOCOL_FAMILIES, WALLET_PROVIDERS_BY_PROTOCOL } from "./constants";
import {
  promptForName,
  promptForNetworks,
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

  // handle network selection if we have a specific protocol
  // if (config.protocolFamily && !config.networkIds.length) {
  //   config.networkIds = await promptForNetworks(config.protocolFamily);
  // }

  // handle wallet provider in interactive mode
  if (!config.walletProvider && config.protocolFamily !== "none") {
    if (config.protocolFamily !== "all" && (await shouldPromptForWalletProvider())) {
      config.walletProvider = await promptForWalletProvider(config.protocolFamily);
    } else if (config.protocolFamily === "evm") {
      config.walletProvider = "EvmWalletProvider";
    } else if (config.protocolFamily === "svm") {
      config.walletProvider = "SvmWalletProvider";
    } else {
      config.walletProvider = "WalletProvider";
    }
  }

  // convert special values to null
  if (config.protocolFamily === "all" || config.protocolFamily === "none") {
    config.protocolFamily = null;
  }

  return config;
}
