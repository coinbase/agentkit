#!/usr/bin/env node

import { createActionProvider } from "./actions/createActionProvider.js";
import { createAgent } from "./actions/createAgent.js";
import { prepareAgentKit } from "./actions/prepareAgentkit.js";
import { createWalletProvider } from "./actions/createWalletProvider.js";

const VALID_GENERATE_TYPES = [
  "action-provider",
  "wallet-provider",
  "prepare",
  "create-agent",
] as const;
type GenerateType = (typeof VALID_GENERATE_TYPES)[number];

/**
 * Finds command arguments regardless of script invocation method
 *
 * @param args - The command line arguments
 * @returns The command and type
 */
function findCommands(args: string[]): { command: string | null; type: string | null } {
  const generateIndex = args.findIndex(arg => arg === "generate");
  if (generateIndex === -1) {
    return { command: null, type: null };
  }

  const type = args[generateIndex + 1];
  return { command: "generate", type };
}

/**
 * Checks if a value is a valid generate type
 *
 * @param value - The value to check
 * @returns True if the value is a valid generate type, false otherwise
 */
function isGenerateType(value: string | null): value is GenerateType {
  return Boolean(value && VALID_GENERATE_TYPES.includes(value as GenerateType));
}

/**
 * Handles command line arguments and executes the appropriate action
 */
async function handleArgs() {
  const { command, type } = findCommands(process.argv);

  if (!command) {
    console.error("Error: Please provide a valid command (generate)");
    process.exit(1);
  }

  switch (command) {
    case "generate": {
      if (!type) {
        console.error("Error: Please specify what to generate");
        console.error(`Valid options: ${VALID_GENERATE_TYPES.join(", ")}`);
        break;
      }

      if (!isGenerateType(type)) {
        console.error(`Error: Unknown generate argument: ${type}`);
        console.error(`Valid options: ${VALID_GENERATE_TYPES.join(", ")}`);
        break;
      }

      switch (type) {
        case "action-provider":
          await createActionProvider();
          break;
        case "wallet-provider":
          await createWalletProvider();
          break;
        case "prepare":
          await prepareAgentKit();
          break;
        case "create-agent":
          await createAgent();
          break;
      }
      break;
    }
    default: {
      console.error(`Error: Unknown command: ${command}`);
      break;
    }
  }
}

handleArgs().catch(e => {
  console.error(e);
  process.exit(1);
});
