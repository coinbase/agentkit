/**
 * Utility functions for the action provider scripts
 */

import fs from "fs";
import path from "path";
import pc from "picocolors";
import nunjucks from "nunjucks";

import { ProviderConfig } from "./types";
import { AGENTKIT_BANNER, SUCCESS_MESSAGES } from "./constants";

nunjucks.configure({
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
 * Validates provider name format
 *
 * @param name - The provider name to validate
 * @returns true if valid format, error message string otherwise
 */
export function validateName(name: string): true | string {
  if (!name) {
    return "Please enter a provider name";
  }

  const formatted = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!formatted) {
    return "Please enter a valid name using only lowercase letters and numbers";
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
 * Replaces template variables in a file
 *
 * @param content - The template content to process
 * @param config - The provider configuration
 * @returns The processed content with variables replaced
 */
function processTemplate(content: string, config: ProviderConfig): string {
  const { name, protocolFamily, networkIds, walletProvider } = config;
  const namePascal = name.charAt(0).toUpperCase() + name.slice(1);

  const context = {
    name,
    name_pascal: namePascal,
    protocol_family: protocolFamily,
    networkIds,
    wallet_provider: walletProvider,
  };

  try {
    return nunjucks.renderString(content, context);
  } catch (error) {
    throw error;
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

  const templateDir = path.join(__dirname, "templates");
  const templates = {
    "actionProvider.ts.template": `${config.name}ActionProvider.ts`,
    "actionProvider.test.ts.template": `${config.name}ActionProvider.test.ts`,
    "schemas.ts.template": "schemas.ts",
    "README.md.template": "README.md",
    "index.ts.template": "index.ts",
  };

  for (const [template, outputFile] of Object.entries(templates)) {
    const templatePath = path.join(templateDir, template);
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    try {
      const processedContent = processTemplate(templateContent, config);
      const outputPath = path.join(targetDir, outputFile);
      fs.writeFileSync(outputPath, processedContent);
    } catch (error) {
      console.error(`Error processing template ${template}:`, error);
      throw error;
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
    files.SCHEMAS.length,
    files.README.length,
  );

  console.log(SUCCESS_MESSAGES.FILES_CREATED);
  console.log(pc.dim(files.DIR));
  for (const key of ["PROVIDER", "TEST", "SCHEMAS", "README"] as const) {
    console.log(pc.green(files[key].padEnd(maxLength + 2)) + pc.dim(desc[key]));
  }

  console.log(SUCCESS_MESSAGES.NEXT_STEPS);
  console.log("1. Define your action schemas in schemas.ts");
  console.log(`2. Implement your actions in ${providerName}ActionProvider.ts`);
  console.log("3. Update network support check in supportsNetwork() method");
  console.log("4. Add more tests");
  console.log("5. Update the README.md with proper documentation");

  console.log(SUCCESS_MESSAGES.REMINDERS);
  console.log("• Run npm run test to verify your implementation");
  console.log("• Run npm run format to format your code");
  console.log("• Run npm run lint to ensure code style");
}
