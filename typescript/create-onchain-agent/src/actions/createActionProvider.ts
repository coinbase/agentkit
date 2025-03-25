import fs from "fs/promises";
import nunjucks from "nunjucks";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { fileURLToPath } from "url";
import { toCamelCase, toClassName, toSnakeCase } from "../common/utils.js";

// Get current file's directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a new action provider
 */
export async function createActionProvider() {
  // Configure nunjucks with the correct path
  nunjucks.configure(path.join(__dirname, "../../../templates"), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });

  // Get user input
  const answers = await prompts([
    {
      type: "text",
      name: "name",
      message: "What is the name of your action provider?",
      validate: (value: string) => (value.length > 0 ? true : "Name is required"),
    },
    {
      type: "select",
      name: "walletProvider",
      message: "Which wallet provider is expected?",
      choices: [
        { title: "None (No wallet/network required)", value: "none" },
        { title: "WalletProvider (Any network)", value: "WalletProvider" },
        { title: "EvmWalletProvider (EVM networks)", value: "EvmWalletProvider" },
        { title: "SvmWalletProvider (Solana networks)", value: "SvmWalletProvider" },
      ],
    },
  ]);

  // Process the name variations
  const baseName = toClassName(answers.name);
  const className = `${baseName}ActionProvider`;
  const fileName = `${toCamelCase(baseName)}ActionProvider`;
  const snakeName = toSnakeCase(answers.name);
  const exportName = `${toCamelCase(baseName)}ActionProvider`;

  const walletProvider = answers.walletProvider;

  // Generate code using nunjucks
  const generatedCode = nunjucks.render("actionProvider/actionProvider.njk", {
    name: exportName,
    className,
    walletProvider,
    actionName: `${snakeName}_action`,
    schemaName: `${baseName}ActionSchema`,
  });

  // Write files directly to current directory
  await fs.writeFile(`./${fileName}.ts`, generatedCode);

  // Generate schema file using nunjucks with updated schema name
  const schemaCode = nunjucks.render("actionProvider/schema.njk", {
    className: `${baseName}Action`,
    actionName: `${snakeName}_action`,
  });

  await fs.writeFile(`./schemas.ts`, schemaCode);

  console.log(pc.green(`Successfully created ${className}.ts and schemas.ts`));
}
