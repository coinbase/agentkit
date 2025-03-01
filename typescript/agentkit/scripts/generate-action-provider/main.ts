#!/usr/bin/env node
/**
 * Action Provider Generator Script
 *
 * This script provides both CLI flags and interactive prompts for creating new action providers.
 * It guides users through selecting protocol families, networks, and wallet providers,
 * then generates all necessary files with appropriate boilerplate code.
 *
 * @module scripts/create-action-provider
 */

import ora from "ora";
import path from "path";
import pc from "picocolors";

import { parseCliArgs } from "./args";
import { prepareProviderConfig } from "./config";
import { addProviderExport, addProviderFiles, displayBanner, displaySuccessMessage } from "./utils";

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
    const args = await parseCliArgs();
    const config = await prepareProviderConfig(args);

    const targetDir = path.join(process.cwd(), "src", "action-providers", config.name);
    spinner.start(`Creating ${config.name} action provider...`);

    addProviderFiles(config, targetDir);
    addProviderExport(config.name);

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
