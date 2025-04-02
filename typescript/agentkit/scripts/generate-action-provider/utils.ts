/**
 * Utility functions for the action provider scripts
 */

import fs from "fs";
import path from "path";
import pc from "picocolors";
import nunjucks from "nunjucks";
import { exec } from "child_process";
import { promisify } from "util";

import { ProviderConfig } from "./types";
import { AGENTKIT_BANNER, SUCCESS_MESSAGES } from "./constants";

// Convert exec to Promise-based
const execPromise = promisify(exec);

// Configure Nunjucks environment ONCE, pointing to the base templates directory
const templateBaseDir = path.join(__dirname, "templates");
const env = nunjucks.configure(templateBaseDir, {
  // Pass base path here
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
});

/**
 * Displays the AgentKit ASCII art banner
 *
 * @param subtitle - The subtitle to display under the banner (centered)
 * @param description - Optional description text to display below the subtitle
 */
export function displayBanner(subtitle: string, description?: string): void {
  console.log(pc.blue(AGENTKIT_BANNER + `           ${subtitle}`));

  if (description) {
    console.log(pc.dim(description + "\n"));
  }
}

/**
 * Checks if a provider already exists
 *
 * @param name - The provider name to check
 * @returns true if provider exists, false otherwise
 */
export function providerExists(name: string): boolean {
  const targetDir = path.join(process.cwd(), "src", "action-providers", name);
  return fs.existsSync(targetDir);
}

/**
 * Validates provider name format to ensure it follows camelCase
 *
 * @param name - The provider name to validate
 * @returns true if valid camelCase format, error message string otherwise
 */
export function validateName(name: string): true | string {
  if (!name) {
    return "Please enter a provider name";
  }

  if (!/^[a-z]/.test(name)) {
    return "Provider name must start with a lowercase letter";
  }

  if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    return "Provider name must be in camelCase format (e.g. myProvider)";
  }

  return true;
}

/**
 * Converts a network ID to a human-readable display name
 * Example: "ethereum-mainnet" -> "Ethereum Mainnet"
 *
 * @param networkId - The network ID to convert (e.g. "ethereum-mainnet")
 * @returns The formatted display name (e.g. "Ethereum Mainnet")
 */
export function networkIdToDisplayName(networkId: string): string {
  return networkId
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Renders a template file with the given configuration context.
 *
 * @param templateName - The name of the template file relative to the base templates directory.
 * @param config - The provider configuration object for context.
 * @returns The processed template content as a string.
 * @throws Throws an error if template rendering fails.
 */
function processTemplate(templateName: string, config: ProviderConfig): string {
  const { name, protocolFamily, networkIds, walletProvider, providerKey } = config;
  const namePascal = name.charAt(0).toUpperCase() + name.slice(1);

  const context = {
    name,
    name_pascal: namePascal,
    protocol_family: protocolFamily,
    networkIds,
    wallet_provider: walletProvider,
    provider_key: providerKey,
  };

  try {
    // Use env.render with the relative template name
    return env.render(templateName, context);
  } catch (error) {
    console.error(`Error rendering template ${templateName}:`, error);
    throw error; // Re-throw after logging
  }
}

/**
 * Process templates and create provider files
 *
 * @param config - The provider configuration
 * @param targetDir - The directory to create files in
 */
export function addProviderFiles(config: ProviderConfig, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });

  // Template Map: Source Template Name (relative to base) -> Output Filename
  const templates = {
    "actionProvider.ts.template": `${config.name}ActionProvider.ts`,
    "actionProvider.test.ts.template": `${config.name}ActionProvider.test.ts`,
    "action.test.ts.template": `exampleAction.test.ts`,
    "schemas.ts.template": `schemas.ts`,
    "README.md.template": `README.md`,
    "index.ts.template": `index.ts`,
  };

  for (const [templateName, outputFile] of Object.entries(templates)) {
    try {
      // Call processTemplate with the template name (relative to base dir)
      const processedContent = processTemplate(templateName, config);
      const outputPath = path.join(targetDir, outputFile);
      fs.writeFileSync(outputPath, processedContent);
    } catch (error) {
      // Error already logged in processTemplate, indicate failure point
      console.error(`Failed to process template ${templateName} for output file ${outputFile}`);
      throw error; // Stop the process if a template fails
    }
  }
}

/**
 * Add export to index.ts for the new action provider
 *
 * @param providerName - The name of the provider to export
 */
export function addProviderExport(providerName: string): void {
  const indexPath = path.join(process.cwd(), "src", "action-providers", "index.ts");
  let content = fs.readFileSync(indexPath, "utf-8");

  if (content.includes(`export * from "./${providerName}";`)) {
    console.log(pc.yellow(`\nNote: Export for ${providerName} already exists in index.ts`));
    return;
  }

  content = content.trimEnd() + `\nexport * from "./${providerName}";\n`;
  fs.writeFileSync(indexPath, content);
}

/**
 * Runs ESLint to fix any linting issues in the generated files
 *
 * @param targetDir - The directory containing the generated files
 */
export async function runLint(targetDir: string): Promise<void> {
  try {
    console.log(pc.blue("Linting generated files..."));

    const command = `npx eslint -c .eslintrc.json "${targetDir}/**/*.ts" --fix`;
    await execPromise(command);

    console.log(pc.green("Linting complete."));
  } catch (error) {
    // ESLint returns non-zero exit code if it finds any linting errors
    console.log(pc.yellow("Linting failed with errors."));
  }
}

/**
 * Runs Prettier to format the generated files
 *
 * @param targetDir - The directory containing the generated files
 */
export async function runFormat(targetDir: string): Promise<void> {
  try {
    console.log(pc.blue("Formatting generated files..."));

    const command = `npx prettier -c .prettierrc --write "${targetDir}/**/*.{ts,js,cjs,json,md}"`;
    await execPromise(command);

    console.log(pc.green("Formatting complete."));
  } catch (error) {
    // Prettier might return non-zero exit code
    console.log(pc.yellow("Formatting failed with errors."));
  }
}

/**
 * Display success message and next steps after provider creation.
 * Shows the created file structure, next steps to implement the provider,
 * and important reminders for the developer.
 *
 * @param providerName - The name of the created provider
 */
export function displaySuccessMessage(providerName: string): void {
  const files = SUCCESS_MESSAGES.FILE_STRUCTURE(providerName);
  const desc = SUCCESS_MESSAGES.DESCRIPTIONS;

  const maxLength = Math.max(
    files.PROVIDER.length,
    files.TEST.length,
    files.EXAMPLE_TEST.length,
    files.SCHEMAS.length,
    files.INDEX.length,
    files.README.length,
  );

  console.log(SUCCESS_MESSAGES.FILES_CREATED);
  console.log(pc.dim(files.DIR));
  for (const key of ["PROVIDER", "TEST", "EXAMPLE_TEST", "SCHEMAS", "INDEX", "README"] as const) {
    console.log(pc.green(files[key].padEnd(maxLength + 2)) + pc.dim(desc[key]));
  }

  console.log(SUCCESS_MESSAGES.NEXT_STEPS);
  console.log("1. Replace the example action schema in schemas.ts with your own");
  console.log(
    `2. Replace the example action implementation in ${providerName}ActionProvider.ts with your own`,
  );
  console.log("3. Add unit tests to cover your action implementation");
  console.log("4. Update the README.md with relevant documentation");
  console.log(
    "5. Add a changelog entry (see here for instructions: https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#changelog)",
  );

  console.log(SUCCESS_MESSAGES.REMINDERS);
  console.log("• Run pnpm run test to verify your implementation");
  console.log("• Run pnpm run format to format your code");
  console.log("• Run pnpm run lint to ensure code style");
}
