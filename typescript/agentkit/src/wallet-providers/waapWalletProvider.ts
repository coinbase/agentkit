// TODO: Improve type safety
/* eslint-disable @typescript-eslint/no-explicit-any */

import { execFile, execFileSync } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  TransactionRequest,
  PublicClient as ViemPublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  Abi,
  ContractFunctionName,
  ContractFunctionArgs,
} from "viem";
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import { CHAIN_ID_TO_NETWORK_ID, getChain } from "../network/network";

/**
 * Exported wallet data from the WaaP wallet provider.
 * Can be used to reconstruct the provider across sessions.
 */
export type WaapWalletExport = {
  /** The email address associated with the WaaP wallet. */
  email: string | undefined;
  /** The EVM chain ID the provider is connected to. */
  chainId: string;
  /** The AgentKit network ID corresponding to the chain. */
  networkId: string | undefined;
  /** The RPC URL override, if any. */
  rpcUrl: string | undefined;
};

/**
 * Configuration for the WaaP wallet provider.
 */
export interface WaapWalletProviderConfig {
  /** Path to the waap-cli binary. Defaults to "waap-cli". */
  cliPath?: string;

  /** EVM chain ID (e.g. "8453" for Base). */
  chainId: string;

  /** RPC URL for the target network. */
  rpcUrl?: string;

  /** Email for waap-cli login. If provided with password, auto-login on configure. */
  email?: string;

  /** Password for waap-cli login. */
  password?: string;
}

const WAAP_CLI_TIMEOUT = 300_000; // 5 min — send-tx may wait for on-chain confirmation

/**
 * Executes a waap-cli command synchronously and returns trimmed stdout.
 * Only used for the login step in configureWithWallet (startup, pre-event-loop).
 */
function execWaapCliSync(cliPath: string, args: string[]): string {
  const result = execFileSync(cliPath, args, {
    encoding: "utf-8",
    timeout: WAAP_CLI_TIMEOUT,
    env: { ...process.env },
  });
  return result.trim();
}

/**
 * Executes a waap-cli command asynchronously and returns trimmed stdout.
 * Used for all signing and transaction operations to avoid blocking the event loop.
 */
async function execWaapCli(cliPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(cliPath, args, {
    encoding: "utf-8",
    timeout: WAAP_CLI_TIMEOUT,
    env: { ...process.env },
  });
  return stdout.trim();
}

/**
 * Extracts a hex value (0x...) from waap-cli output, which may contain
 * emoji decorations and status lines.
 */
function extractHex(output: string): `0x${string}` {
  const match = output.match(/(0x[0-9a-fA-F]+)/);
  if (!match) {
    throw new Error(`Could not extract hex value from waap-cli output: ${output}`);
  }
  return match[1] as `0x${string}`;
}

/**
 * Extracts a value after a label (e.g. "Wallet address: 0x...") from waap-cli output.
 */
function extractLabeled(output: string, label: string): string {
  const regex = new RegExp(`${label}\\s*[:=]\\s*(.+)`, "i");
  const match = output.match(regex);
  if (!match) {
    throw new Error(`Could not find "${label}" in waap-cli output: ${output}`);
  }
  return match[1].trim();
}

/**
 * Extracts the longest hex value from waap-cli output. Useful when the output
 * contains multiple hex values (e.g. key IDs, addresses) and we need the
 * longest one (signatures, signed transactions).
 */
function extractLongestHex(output: string): `0x${string}` {
  const matches = output.match(/0x[0-9a-fA-F]+/g);
  if (!matches || matches.length === 0) {
    throw new Error(`Could not extract hex value from waap-cli output: ${output}`);
  }
  const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return longest as `0x${string}`;
}

/**
 * A wallet provider that uses the waap-cli binary for signing operations.
 *
 * WaaP (Wallet as a Protocol) manages private keys server-side using
 * two-party computation, so keys are never exposed locally. This provider
 * shells out to the waap-cli for all signing operations and uses a Viem
 * PublicClient for read-only blockchain queries.
 */
export class WaapWalletProvider extends EvmWalletProvider {
  #cliPath: string;
  #chainId: string;
  #rpcUrl: string | undefined;
  #email: string | undefined;
  #publicClient: ViemPublicClient;
  #address: string | undefined;

  /**
   * Constructs a new WaapWalletProvider.
   *
   * @param config - The configuration for the wallet provider.
   */
  constructor(config: WaapWalletProviderConfig) {
    super();

    this.#cliPath = config.cliPath || "waap-cli";
    this.#chainId = config.chainId;
    this.#rpcUrl = config.rpcUrl;
    this.#email = config.email;

    const chain = getChain(config.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${config.chainId}`);
    }

    this.#publicClient = createPublicClient({
      chain,
      transport: config.rpcUrl ? http(config.rpcUrl) : http(),
    });
  }

  /**
   * Creates and configures a WaapWalletProvider. If email and password
   * are provided, automatically logs in.
   *
   * @param config - The configuration for the wallet provider.
   * @returns A configured WaapWalletProvider instance.
   */
  static configureWithWallet(config: WaapWalletProviderConfig): WaapWalletProvider {
    const cliPath = config.cliPath || "waap-cli";

    if (config.email && config.password) {
      execWaapCliSync(cliPath, [
        "login",
        "--email",
        config.email,
        "--password",
        config.password,
      ]);
    }

    const provider = new WaapWalletProvider(config);
    // Pre-warm address cache synchronously at startup so getAddress() never
    // blocks the event loop during agent tool execution.
    provider.getAddress();
    return provider;
  }

  /**
   * Executes a waap-cli command with the configured binary path.
   */
  private exec(args: string[]): Promise<string> {
    return execWaapCli(this.#cliPath, args);
  }

  /**
   * Builds common transaction CLI args.
   */
  private txArgs(transaction: TransactionRequest): string[] {
    const args: string[] = [];

    if (transaction.to) {
      args.push("--to", transaction.to as string);
    }

    if (transaction.value !== undefined && transaction.value !== null) {
      // waap-cli expects ETH, AgentKit passes Wei
      const ethValue = formatEther(BigInt(transaction.value.toString()));
      args.push("--value", ethValue);
    } else {
      // waap-cli requires --value even for contract calls (e.g. ERC20 approve)
      args.push("--value", "0");
    }

    args.push("--chain-id", this.#chainId);

    if (this.#rpcUrl) {
      args.push("--rpc", this.#rpcUrl);
    }

    if (transaction.data) {
      args.push("--data", transaction.data as string);
    }

    return args;
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The wallet address.
   */
  getAddress(): string {
    if (!this.#address) {
      // Fallback: fetch synchronously (only on first call if not pre-warmed).
      // Prefer calling configureWithWallet() which pre-warms the address cache.
      const output = execWaapCliSync(this.#cliPath, ["whoami"]);
      this.#address = extractLabeled(output, "Wallet address");
    }
    return this.#address;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return {
      protocolFamily: "evm" as const,
      chainId: this.#chainId,
      networkId: CHAIN_ID_TO_NETWORK_ID[Number(this.#chainId)],
    };
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  getName(): string {
    return "waap_wallet_provider";
  }

  /**
   * Exports the wallet data for session persistence.
   *
   * The exported data contains enough information to reconstruct the provider
   * in a future session by passing it back to `configureWithWallet`. Note that
   * the password is not included — store it separately and securely.
   *
   * @returns The wallet export data.
   */
  exportWallet(): WaapWalletExport {
    return {
      email: this.#email,
      chainId: this.#chainId,
      networkId: this.getNetwork().networkId,
      rpcUrl: this.#rpcUrl,
    };
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance in Wei.
   */
  async getBalance(): Promise<bigint> {
    return this.#publicClient.getBalance({
      address: this.getAddress() as `0x${string}`,
    });
  }

  /**
   * Signs a raw hash using waap-cli sign-message.
   *
   * @param hash - The hash to sign.
   * @returns The signature.
   */
  async sign(hash: `0x${string}`): Promise<`0x${string}`> {
    const output = await this.exec(["sign-message", "--message", hash]);
    return extractLongestHex(output);
  }

  /**
   * Signs a message using EIP-191 (personal_sign).
   *
   * @param message - The message to sign.
   * @returns The signature.
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    let msgArg: string;
    if (message instanceof Uint8Array) {
      msgArg = "0x" + Buffer.from(message).toString("hex");
    } else {
      msgArg = message;
    }
    const output = await this.exec(["sign-message", "--message", msgArg]);
    return extractLongestHex(output);
  }

  /**
   * Signs EIP-712 typed data.
   *
   * @param typedData - The typed data to sign.
   * @returns The signature.
   */
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    const output = await this.exec(["sign-typed-data", "--data", JSON.stringify(typedData)]);
    return extractLongestHex(output);
  }

  /**
   * Signs a transaction without broadcasting it.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction hex.
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const output = await this.exec(["sign-tx", ...this.txArgs(transaction)]);
    // Try labeled extraction first ("Signed transaction:" or "Signed tx:"), then
    // fall back to the longest hex value — the signed RLP blob is always longer
    // than any address or hash that waap-cli may print alongside it.
    for (const label of ["Signed transaction", "Signed tx"]) {
      try {
        return extractLabeled(output, label) as `0x${string}`;
      } catch {
        // try next label
      }
    }
    // Fallback: longest hex value in output
    const matches = output.match(/0x[0-9a-fA-F]+/g);
    if (matches) {
      const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b));
      return longest as `0x${string}`;
    }
    return extractHex(output);
  }

  /**
   * Sends a transaction (sign + broadcast).
   *
   * @param transaction - The transaction to send.
   * @returns The transaction hash.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const output = await this.exec(["send-tx", ...this.txArgs(transaction)]);
    // Use labeled extraction to avoid picking up the sender address that
    // waap-cli prints before the transaction hash.
    try {
      return extractLabeled(output, "Transaction hash") as `0x${string}`;
    } catch {
      // Fall back to last hex value in output if label not found
      const matches = output.match(/0x[0-9a-fA-F]{64}/g);
      if (matches) return matches[matches.length - 1] as `0x${string}`;
      return extractHex(output);
    }
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The transaction hash.
   * @returns The transaction receipt.
   */
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return this.#publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000, // 2 min — avoids hanging indefinitely on slow networks
    });
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  async readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>> {
    return this.#publicClient.readContract<abi, functionName, args>(params);
  }

  /**
   * Gets the Viem PublicClient for read-only operations.
   *
   * @returns The PublicClient instance.
   */
  getPublicClient(): ViemPublicClient {
    return this.#publicClient;
  }

  /**
   * Transfers native currency (ETH, etc.).
   *
   * @param to - The destination address.
   * @param value - The amount in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    // waap-cli send-tx waits for on-chain confirmation before returning the hash,
    // so we skip waitForTransactionReceipt to avoid a redundant second block wait.
    const txHash = await this.sendTransaction({
      to: to as `0x${string}`,
      value: BigInt(value),
    });

    return txHash;
  }
}
