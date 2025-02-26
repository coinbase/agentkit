/**
 * Utility functions for the action provider scripts
 */

import fs from "fs";
import path from "path";
import pc from "picocolors";
import nunjucks from "nunjucks";

import { ProviderConfig } from "./types";

// Configure Nunjucks
nunjucks.configure({ 
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});

/**
 * ASCII art banner for AgentKit
 */
const AGENTKIT_BANNER = `
 █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████ 
██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██    
███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██    
██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██    
██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██    
`;

/* eslint-disable prettier/prettier */
/**
 * Success message strings and templates for action provider creation.
 * Contains all the message templates used in the success output after creating
 * a new action provider, including file structure, descriptions, and next steps.
 */
const SUCCESS_MESSAGES = {
  FILES_CREATED: "\nFiles created:",
  NEXT_STEPS: "\nNext steps:",
  REMINDERS: "\nDon't forget to:",
  FILE_STRUCTURE: (name: string) => ({
    DIR: `  src/action-providers/${name}/`,
    PROVIDER: `    ├── ${name}ActionProvider.ts`,
    TEST: `    ├── ${name}ActionProvider.test.ts`,
    SCHEMAS: `    ├── schemas.ts`,
    README: `    └── README.md`,
  }),
  DESCRIPTIONS: {
    PROVIDER: "(main provider implementation)",
    TEST: "(test suite)",
    SCHEMAS: "(action schemas and types)",
    README: "(documentation)",
  },
};
/* eslint-enable prettier/prettier */

// Name validation and checking functions

/**
 * Validates provider name format
 *
 * @param name - The provider name to validate
 * @returns true if valid format, error message string otherwise
 */
export function validateProviderName(name: string): true | string {
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
 * Checks if a provider already exists
 *
 * @param name - The provider name to check
 * @returns true if provider exists, false otherwise
 */
export function providerExists(name: string): boolean {
  const targetDir = path.join(process.cwd(), "src", "action-providers", name);
  return fs.existsSync(targetDir);
}

// Display and formatting functions

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
  console.log(pc.green(files.PROVIDER.padEnd(maxLength + 2)) + pc.dim(desc.PROVIDER));
  console.log(pc.green(files.TEST.padEnd(maxLength + 2)) + pc.dim(desc.TEST));
  console.log(pc.green(files.SCHEMAS.padEnd(maxLength + 2)) + pc.dim(desc.SCHEMAS));
  console.log(pc.green(files.README.padEnd(maxLength + 2)) + pc.dim(desc.README));

  console.log(SUCCESS_MESSAGES.NEXT_STEPS);
  console.log(pc.cyan("1.") + " Define your action schemas in " + pc.blue("schemas.ts"));
  console.log(
    pc.cyan("2.") + " Implement your actions in " + pc.blue(`${providerName}ActionProvider.ts`),
  );
  console.log(
    pc.cyan("3.") + " Update network support check in " + pc.blue("supportsNetwork()") + " method",
  );
  console.log(
    pc.cyan("4.") + " Add more tests in " + pc.blue(`${providerName}ActionProvider.test.ts`),
  );
  console.log(pc.cyan("5.") + " Update the " + pc.blue("README.md") + " with proper documentation");

  console.log(SUCCESS_MESSAGES.REMINDERS);
  console.log(
    pc.yellow("•") + " Add proper imports in " + pc.blue("src/action-providers/index.ts"),
  );
  console.log(
    pc.yellow("•") + " Run " + pc.blue("npm run test") + " to verify your implementation",
  );
  console.log(pc.yellow("•") + " Run " + pc.blue("npm run lint") + " to ensure code style");
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

// File operations and template processing

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

  console.log("\nProcessing templates with config:", JSON.stringify(config, null, 2));

  for (const [template, outputFile] of Object.entries(templates)) {
    console.log(`\nProcessing template: ${template}`);
    const templatePath = path.join(templateDir, template);
    console.log(`Reading from: ${templatePath}`);
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    console.log(`Template content length: ${templateContent.length} bytes`);
    try {
      const processedContent = processTemplate(templateContent, config);
      const outputPath = path.join(targetDir, outputFile);
      console.log(`Writing to: ${outputPath}`);
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

  console.log("Template context:", JSON.stringify(context, null, 2));

  try {
    return nunjucks.renderString(content, context);
  } catch (error) {
    console.error("Nunjucks render error:", error);
    throw error;
  }
}
