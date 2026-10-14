import { CdpClient, EvmSmartAccount, EvmServerAccount } from "@coinbase/cdp-sdk";
import {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  Hex,
  http,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
  LocalAccount,
  toEventSelector,
} from "viem";
import { Network, NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network";
import { EvmWalletProvider } from "./evmWalletProvider";
import { WalletProviderWithClient, CdpSmartWalletProviderConfig } from "./cdpShared";

/**
 * The topic of UserOperationEvent, emitted by the ERC-4337 EntryPoint (v0.6 and v0.7) once for
 * each user operation in a bundle. Derived from the event signature rather than written out, so a
 * typo cannot silently stop every match.
 */
const USER_OPERATION_EVENT_TOPIC = toEventSelector(
  "UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)",
).toLowerCase();

/**
 * Reads whether a user operation's own call succeeded from the bundle transaction's logs. The
 * bundle transaction succeeds even when one of its user operations reverts; the EntryPoint records
 * each operation's result in the `success` field of its UserOperationEvent.
 *
 * @param logs - The logs of the bundle transaction.
 * @param userOpHash - The user operation hash.
 * @returns The event's `success` value, or undefined when the logs hold no event for this hash.
 */
function userOperationSucceeded(
  logs: ReadonlyArray<{ topics: readonly Hex[]; data: Hex }>,
  userOpHash: Hex,
): boolean | undefined {
  const event = logs.find(
    log =>
      log.topics[0]?.toLowerCase() === USER_OPERATION_EVENT_TOPIC &&
      log.topics[1]?.toLowerCase() === userOpHash.toLowerCase(),
  );
  // non-indexed data: nonce, success, actualGasCost, actualGasUsed, 32 bytes each
  if (!event || event.data.length < 2 + 64 * 2) return undefined;
  return BigInt("0x" + event.data.slice(2 + 64, 2 + 128)) !== BigInt(0);
}

/**
 * Supported network types for CDP SDK smart wallet operations
 */
type CdpSmartWalletNetwork =
  | "base"
  | "base-sepolia"
  | "ethereum"
  | "ethereum-sepolia"
  | "polygon"
  | "arbitrum"
  | "optimism";

interface ConfigureCdpSmartWalletProviderWithWalletOptions {
  /**
   * The CDP client of the wallet.
   */
  cdp: CdpClient;

  /**
   * The smart account of the wallet.
   */
  smartAccount: EvmSmartAccount;

  /**
   * The owner account of the smart wallet.
   */
  ownerAccount: EvmServerAccount | LocalAccount;

  /**
   * The public client of the wallet.
   */
  publicClient: PublicClient;

  /**
   * The network of the wallet.
   */
  network: Network;

  /**
   * The paymaster URL for gasless transactions.
   */
  paymasterUrl?: string;
}

/**
 * A wallet provider that uses the Coinbase CDP SDK smart wallets.
 */
export class CdpSmartWalletProvider extends EvmWalletProvider implements WalletProviderWithClient {
  public smartAccount: EvmSmartAccount;
  public ownerAccount: LocalAccount | EvmServerAccount;

  #publicClient: PublicClient;
  #cdp: CdpClient;
  #network: Network;
  #paymasterUrl?: string;

  /**
   * Constructs a new CdpSmartWalletProvider.
   *
   * @param config - The configuration options for the CdpSmartWalletProvider.
   */
  private constructor(config: ConfigureCdpSmartWalletProviderWithWalletOptions) {
    super();

    this.smartAccount = config.smartAccount;
    this.ownerAccount = config.ownerAccount;
    this.#cdp = config.cdp;
    this.#publicClient = config.publicClient;
    this.#network = config.network;
    this.#paymasterUrl = config.paymasterUrl;
  }
  /**
   * Configures a new CdpSmartWalletProvider with a smart wallet.
   *
   * @param config - Optional configuration parameters
   * @returns A Promise that resolves to a new CdpSmartWalletProvider instance
   * @throws Error if required environment variables are missing or wallet initialization fails
   */
  public static async configureWithWallet(
    config: CdpSmartWalletProviderConfig = {},
  ): Promise<CdpSmartWalletProvider> {
    const apiKeyId = config.apiKeyId || process.env.CDP_API_KEY_ID;
    const apiKeySecret = config.apiKeySecret || process.env.CDP_API_KEY_SECRET;
    const walletSecret = config.walletSecret || process.env.CDP_WALLET_SECRET;
    const idempotencyKey = config.idempotencyKey || process.env.IDEMPOTENCY_KEY;
    const paymasterUrl = config.paymasterUrl || process.env.PAYMASTER_URL;

    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error(
        "Missing required environment variables. CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET are required.",
      );
    }

    const networkId: string = config.networkId || process.env.NETWORK_ID || "base-sepolia";

    const network = {
      protocolFamily: "evm" as const,
      chainId: NETWORK_ID_TO_CHAIN_ID[networkId],
      networkId: networkId,
    };

    const cdpClient = new CdpClient({
      apiKeyId,
      apiKeySecret,
      walletSecret,
    });

    // Create or get the owner account
    const ownerAccount = await (() => {
      if (typeof config.owner === "string") {
        return cdpClient.evm.getAccount({ address: config.owner as Address });
      }

      if (typeof config.owner === "object") {
        return config.owner;
      }

      return cdpClient.evm.createAccount({ idempotencyKey });
    })();

    // Create or get the smart account
    const smartAccount = await (config.address || config.smartAccountName
      ? cdpClient.evm.getSmartAccount({
          address: config.address,
          name: config.smartAccountName,
          owner: ownerAccount as EvmServerAccount,
        })
      : cdpClient.evm.createSmartAccount({
          owner: ownerAccount as EvmServerAccount,
        }));

    const rpcUrl = config.rpcUrl || process.env.RPC_URL;
    const publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    return new CdpSmartWalletProvider({
      publicClient,
      cdp: cdpClient,
      smartAccount,
      ownerAccount,
      network,
      paymasterUrl,
    });
  }

  /**
   * Exports the wallet.
   *
   * @returns The wallet's data.
   */
  async exportWallet(): Promise<{
    name: string | undefined;
    address: Address;
    ownerAddress: Address;
  }> {
    return {
      name: this.smartAccount.name,
      address: this.smartAccount.address as Address,
      ownerAddress: this.ownerAccount.address as Address,
    };
  }

  /**
   * Signs a raw hash using the owner account.
   *
   * @param _hash - The hash to sign.
   * @returns The signed hash.
   */
  async sign(_hash: Hex): Promise<Hex> {
    if (!this.ownerAccount.sign) {
      throw new Error("Owner account does not support raw hash signing");
    }

    return this.ownerAccount.sign({ hash: _hash });
  }

  /**
   * Signs a message using the owner account.
   *
   * @param _message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(_message: string): Promise<Hex> {
    return this.ownerAccount.signMessage({ message: _message });
  }

  /**
   * Signs a typed data object using the owner account.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<Hex> {
    const { domain, types, primaryType, message } = typedData;
    return await this.smartAccount.signTypedData({
      domain,
      types,
      primaryType,
      message,
      network: this.getCdpSdkNetwork(),
    });
  }

  /**
   * Signs a transaction using the owner account.
   *
   * @param _ - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(_: TransactionRequest): Promise<Hex> {
    throw new Error(
      "Direct transaction signing not supported for smart wallets. Use sendTransaction instead.",
    );
  }

  /**
   * Sends a user operation through the smart wallet.
   *
   * @param transaction - The transaction to send.
   * @returns The user operation hash.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    const calls = [
      {
        to: transaction.to as Address,
        value: transaction.value ? BigInt(transaction.value.toString()) : 0n,
        data: (transaction.data as Hex) || "0x",
      },
    ];

    const userOperation = await this.#cdp.evm.sendUserOperation({
      smartAccount: this.smartAccount,
      network: this.getCdpSdkNetwork(),
      calls,
      paymasterUrl: this.#paymasterUrl,
    });

    return userOperation.userOpHash as Hex;
  }

  /**
   * Gets the address of the smart wallet.
   *
   * @returns The address of the smart wallet.
   */
  getAddress(): string {
    return this.smartAccount.address;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return this.#network;
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  getName(): string {
    return "cdp_smart_wallet_provider";
  }

  /**
   * Gets the CDP client.
   *
   * @returns The CDP client.
   */
  getClient(): CdpClient {
    return this.#cdp;
  }

  /**
   * Gets the paymaster URL for gasless transactions.
   *
   * @returns The paymaster URL if configured, undefined otherwise.
   */
  getPaymasterUrl(): string | undefined {
    return this.#paymasterUrl;
  }

  /**
   * Gets the Viem PublicClient used for read-only operations.
   *
   * @returns The Viem PublicClient instance used for read-only operations.
   */
  getPublicClient(): PublicClient {
    return this.#publicClient;
  }

  /**
   * Gets the balance of the smart wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    return await this.#publicClient.getBalance({ address: this.smartAccount.address });
  }

  /**
   * Waits for a user operation receipt.
   *
   * @param userOpHash - The user operation hash to wait for.
   * @returns The user operation receipt.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(userOpHash: Hex): Promise<any> {
    // For smart wallets, we need to wait for the user operation to be confirmed
    const receipt = await this.#cdp.evm.waitForUserOperation({
      smartAccountAddress: this.smartAccount.address,
      userOpHash,
    });

    // Append transaction logs if available
    if (receipt.status === "complete") {
      const receiptTx = await this.#publicClient.waitForTransactionReceipt({
        hash: receipt.transactionHash as Hex,
      });
      if (receiptTx.logs) {
        // "complete" means the bundle transaction was mined, not that this operation's call
        // succeeded, so an operation the EntryPoint marked unsuccessful is reported as failed
        const succeeded = userOperationSucceeded(receiptTx.logs, userOpHash);
        // a reverted bundle transaction keeps no logs, so it holds no event, and none of its
        // operations can have succeeded
        const bundleReverted = receiptTx.status === "reverted";
        if (succeeded === undefined && !bundleReverted) {
          // "complete" is all we can report, but say that the operation's own result was not read
          console.warn(
            `No UserOperationEvent for ${userOpHash} in bundle ${receipt.transactionHash}; reporting the SDK status "${receipt.status}" without confirming the operation's own result.`,
          );
        }
        return {
          ...receipt,
          ...(succeeded === false || bundleReverted ? { status: "failed" } : {}),
          logs: receiptTx.logs,
        };
      }
    }

    return receipt;
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
   * Transfer the native asset of the network using smart wallet.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in atomic units (Wei).
   * @returns The user operation hash.
   */
  async nativeTransfer(to: Address, value: string): Promise<Hex> {
    return this.sendTransaction({
      to: to,
      value: BigInt(value),
      data: "0x",
    });
  }

  /**
   * Converts the internal network ID to the format expected by the CDP SDK.
   *
   * @returns The network ID in CDP SDK format
   * @throws Error if the network is not supported
   */
  getCdpSdkNetwork(): CdpSmartWalletNetwork {
    switch (this.#network.networkId) {
      case "base-sepolia":
        return "base-sepolia";
      case "base-mainnet":
        return "base";
      case "ethereum-mainnet":
        return "ethereum";
      case "ethereum-sepolia":
        return "ethereum-sepolia";
      case "polygon-mainnet":
        return "polygon";
      case "arbitrum-mainnet":
        return "arbitrum";
      case "optimism-mainnet":
        return "optimism";
      default:
        throw new Error(`Unsupported network for smart wallets: ${this.#network.networkId}`);
    }
  }
}
