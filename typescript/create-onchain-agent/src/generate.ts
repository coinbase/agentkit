#!/usr/bin/env node
import { createActionProvider } from "./actions/createActionProvider.js";
import { createAgent } from "./actions/createAgent.js";
import { prepareAgentKit } from "./actions/prepareAgentkit.js";
import { createWalletProvider } from "./actions/createWalletProvider.js";
import { initProject } from "./actions/initProject.js";

const VALID_GENERATE_TYPES = ["action-provider", "wallet-provider", "prepare", "create-agent"] as const;
type GenerateType = (typeof VALID_GENERATE_TYPES)[number];

/**
 * Finds command arguments regardless of script invocation method
 *
 * @param args - The command line arguments
 * @returns The command and type
 */
function findCommands(args: string[]): { command: string | null; type: string | null } {
  // Handle direct "new" command
  if (args.includes("new")) {
    return { command: "new", type: null };
  }

  // Handle generate commands
  const generateIndex = args.findIndex(arg => arg === "generate");
  if (generateIndex === -1) {
    return { command: null, type: null };
  }

  const type = args[generateIndex + 1];
  return { command: "generate", type };
}

/**
 * Handles command line arguments and executes the appropriate action
 */
async function handleArgs() {
  const { command, type } = findCommands(process.argv);

  if (!command) {
    console.error("Error: Please provide a valid command (new or generate)");
    process.exit(1);
  }

  switch (command) {
    case "new": {
      await initProject();
      return;
    }
    case "generate": {
      if (!type) {
        console.error("Error: Please specify what to generate");
        console.error(`Valid options: ${VALID_GENERATE_TYPES.join(", ")}`);
        break;
      }

      if (!VALID_GENERATE_TYPES.includes(type as GenerateType)) {
        console.error(`Error: Unknown generate type: ${type}`);
        console.error(`Valid options: ${VALID_GENERATE_TYPES.join(", ")}`);
        break;
      }

      switch (type as GenerateType) {
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
