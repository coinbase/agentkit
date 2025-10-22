import fs from "fs/promises";
import nunjucks from "nunjucks";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { fileURLToPath } from "url";
import { toCamelCase, toClassName, toSnakeCase } from "../common/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a new wallet provider
 */
export async function createWalletProvider() {
  nunjucks.configure(path.join(__dirname, "../../../templates"), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });

  const answers = await prompts([
    {
      type: "text",
      name: "name",
      message: "What is the name of your wallet provider?",
      validate: (value: string) => (value.length > 0 ? true : "Name is required"),
    },
    {
      type: "select",
      name: "protocolFamily",
      message: "Which protocol family will this support?",
      choices: [
        { title: "EVM", value: "EVM" },
        { title: "SVM", value: "SVM" },
      ],
    },
  ]);

  const className = `${toClassName(answers.name)}WalletProvider`;
  const fileName = `${toCamelCase(answers.name)}WalletProvider`;
  const snakeName = toSnakeCase(answers.name);

  const baseClass = answers.protocolFamily === "EVM" ? "EvmWalletProvider" : "SvmWalletProvider";

  const generatedCode = nunjucks.render("walletProvider/walletProvider.njk", {
    name: snakeName,
    className,
    protocolFamily: answers.protocolFamily,
    baseClass,
  });

  // Write file directly to current directory
  await fs.writeFile(`./${fileName}.ts`, generatedCode);

  console.log(pc.green(`Successfully created ${fileName}.ts`));
}
