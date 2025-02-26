#!/usr/bin/env node
/**
 * Action Provider Generator Script
 *
 * This script provides an interactive CLI for creating new action providers.
 * It guides users through selecting protocol families, networks, and wallet providers,
 * then generates all necessary files with appropriate boilerplate code.
 *
 * @module scripts/create-action-provider
 */

import ora from "ora";
import path from "path";
import pc from "picocolors";
import prompts, { PromptObject } from "prompts";

import {
  NETWORKS_BY_PROTOCOL,
  PROTOCOL_FAMILIES,
  WALLET_PROVIDERS_BY_PROTOCOL,
  ProtocolFamily,
} from "./constants";
import { ProviderConfig } from "./types";
import {
  addProviderExport,
  addProviderFiles,
  displayBanner,
  displaySuccessMessage,
  providerExists,
  validateProviderName,
} from "./utils";

/**
 * Prompt configuration for creating a new action provider
 */
const CREATE_PROVIDER_PROMPTS: PromptObject[] = [
  {
    type: "text",
    name: "name",
    message: "Enter action provider name (e.g. mytoken):",
    validate: validateProviderName,
  },
  {
    type: (prev, values) => (providerExists(values.name) ? "confirm" : null),
    name: "overwrite",
    message: (prev, values) =>
      `Action provider '${values.name}' already exists. Do you want to overwrite it?`,
    initial: false,
  },
  {
    type: (prev, values) => {
      if (providerExists(values.name) && !values.overwrite) {
        throw new Error("Action provider creation cancelled - provider already exists");
      }
      return "select";
    },
    name: "protocolFamily",
    message: "Select target blockchain protocol:",
    choices: PROTOCOL_FAMILIES.map(pf => ({
      title: pf.title,
      value: pf.value,
      description: pf.description,
    })),
    initial: 0,
    hint: "Use arrow keys to navigate, enter to select",
  },
  {
    type: (prev, values) => (values.protocolFamily === "all" ? null : "multiselect"),
    name: "networkIds",
    message: (prev, values) =>
      `Select target networks for ${values.protocolFamily?.toUpperCase()}:`,
    choices: (prev, values) =>
      NETWORKS_BY_PROTOCOL[values.protocolFamily as ProtocolFamily].map(net => ({
        title: net.title,
        value: net.value,
        description: net.description,
      })),
    min: 1,
    hint: "Space to select, enter to confirm",
  },
  {
    type: (prev, values) => (values.protocolFamily === "all" ? null : "select"),
    name: "walletProvider",
    message: (prev, values) =>
      `Select wallet provider for ${values.protocolFamily?.toUpperCase()}:`,
    choices: (prev, values) =>
      WALLET_PROVIDERS_BY_PROTOCOL[values.protocolFamily as ProtocolFamily].map(wp => ({
        title: wp.title,
        value: wp.value,
        description: wp.description,
      })),
    initial: 0,
    hint: "Use arrow keys to navigate, enter to select",
  },
];

/**
 * Creates a new action provider
 */
async function createActionProvider() {
  displayBanner(
    "Creating a new Action Provider",
    "This utility will help you create a new action provider with all necessary files and boilerplate.",
  );

  const spinner = ora();

  try {
    // prompt
    const result = await prompts(CREATE_PROVIDER_PROMPTS, {
      onCancel: () => {
        throw new Error("Action provider creation cancelled by user");
      },
    });

    let networkIds: string[] = [];

    if (
      result.protocolFamily !== "all" &&
      result.networkIds?.length &&
      result.networkIds[0] !== "all"
    ) {
      networkIds = result.networkIds;
    }

    console.log("NetworkIds:\n", networkIds);

    const walletProvider =
      result.protocolFamily === "all" ? "WalletProvider" : result.walletProvider;

    // ensure
    if (!result.name || !result.protocolFamily || !walletProvider) {
      throw new Error("Missing required fields in provider configuration");
    }

    // config
    const config: ProviderConfig = {
      name: result.name,
      protocolFamily: result.protocolFamily,
      networkIds,
      walletProvider,
    };

    // target
    const targetDir = path.join(process.cwd(), "src", "action-providers", config.name);

    // begin
    spinner.start(`Creating ${config.name} action provider...`);

    addProviderFiles(config, targetDir);
    addProviderExport(config.name);

    // end
    spinner.succeed(pc.green("Action provider created successfully!"));
    displaySuccessMessage(config.name);
  } catch (error) {
    spinner.fail(pc.red("Failed to create action provider"));

    if (error instanceof Error) {
      console.error(pc.red(error.message));
    } else {
      console.error(pc.red("An unexpected error occurred"));
    }
    process.exit(1);
  }
}

createActionProvider().catch(console.error);
