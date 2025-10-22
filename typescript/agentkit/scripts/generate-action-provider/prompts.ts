import prompts from "prompts";
import {
  NETWORKS_BY_PROTOCOL,
  PROTOCOL_FAMILIES,
  WALLET_PROVIDERS_BY_PROTOCOL,
  ProtocolFamily,
  WalletProvider,
} from "./constants";
import { validateName } from "./utils";

/**
 * Prompt for provider name
 */
export async function promptForName(): Promise<string> {
  const { name } = await prompts({
    type: "text",
    name: "name",
    message: "Enter action provider name (e.g. mytoken):",
    validate: validateName,
  });
  return name;
}

/**
 * Prompt for overwrite if provider exists
 */
export async function promptForOverwrite(name: string): Promise<boolean> {
  const { overwrite } = await prompts({
    type: "confirm",
    name: "overwrite",
    message: `Action provider '${name}' already exists. Do you want to overwrite it?`,
    initial: false,
  });
  return overwrite;
}

/**
 * Prompt for protocol family
 */
export async function promptForProtocolFamily(): Promise<ProtocolFamily> {
  const { protocolFamily } = await prompts({
    type: "select",
    name: "protocolFamily",
    message: "Select target blockchain protocol:",
    choices: PROTOCOL_FAMILIES.map(pf => ({
      title: pf.title,
      value: pf.value,
      description: pf.description,
    })),
    initial: 0,
    hint: "Use arrow keys to navigate, enter to select",
  });
  return protocolFamily;
}

/**
 * Prompt for network IDs
 */
export async function promptForNetworks(protocolFamily: ProtocolFamily): Promise<string[]> {
  const { networkIds } = await prompts({
    type: "multiselect",
    name: "networkIds",
    message: `Select target networks for ${protocolFamily.toUpperCase()}:`,
    choices: NETWORKS_BY_PROTOCOL[protocolFamily].map(net => ({
      title: net.title,
      value: net.value,
      description: net.description,
    })),
    min: 1,
    hint: "Space to select, enter to confirm",
  });

  return networkIds;
}

/**
 * Ask if user wants to specify a wallet provider
 */
export async function shouldPromptForWalletProvider(): Promise<boolean> {
  const { shouldPrompt } = await prompts({
    type: "confirm",
    name: "shouldPrompt",
    message: "Would you like to specify a wallet provider?",
    initial: false,
  });
  return shouldPrompt;
}

/**
 * Prompt for wallet provider
 */
export async function promptForWalletProvider(
  protocolFamily: ProtocolFamily,
): Promise<WalletProvider | undefined> {
  const { walletProvider } = await prompts({
    type: "select",
    name: "walletProvider",
    message: `Select wallet provider for ${protocolFamily.toUpperCase()}:`,
    choices: WALLET_PROVIDERS_BY_PROTOCOL[protocolFamily].map(wp => ({
      title: wp.title,
      value: wp.value,
      description: wp.description,
    })),
    initial: 0,
    hint: "Use arrow keys to navigate, enter to select",
  });

  return walletProvider;
}
