import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ProtocolFamily, WalletProvider } from "./constants";

export interface CliArgs {
  name?: string;
  protocolFamily?: ProtocolFamily | null;
  networks?: string[];
  walletProvider?: WalletProvider | undefined;
  interactive: boolean;
}

/**
 * Parse CLI arguments
 */
export async function parseCliArgs(): Promise<CliArgs> {
  if (process.argv.length <= 2) {
    return {
      name: undefined,
      protocolFamily: null,
      networks: undefined,
      walletProvider: undefined,
      interactive: false,
    };
  }

  const args = await yargs(hideBin(process.argv))
    .option("name", {
      alias: "n",
      type: "string",
      description: "Name of the action provider",
    })
    .option("protocol-family", {
      alias: "p",
      type: "string",
      description: "Protocol family (e.g. evm, all)",
    })
    .option("networks", {
      alias: "t",
      type: "string",
      description: "Comma-separated list of networks",
    })
    .option("wallet-provider", {
      alias: "w",
      type: "string",
      description: "Wallet provider to use (optional)",
    })
    .option("interactive", {
      alias: "i",
      type: "boolean",
      description: "Enable interactive mode for missing values",
      default: false,
    })
    .help().argv;

  const protocolFamily = args["protocol-family"] as string;

  return {
    name: args.name,
    protocolFamily:
      protocolFamily && ["evm", "svm"].includes(protocolFamily)
        ? (protocolFamily as ProtocolFamily)
        : null,
    networks: args.networks?.split(",").map(id => id.trim()),
    walletProvider: args["wallet-provider"] as WalletProvider | undefined,
    interactive: args.interactive || false,
  };
}
