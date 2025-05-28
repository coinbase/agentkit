import {
  CHAIN_ID_TO_NETWORK_ID,
  Coinbase,
  createSmartWallet,
  NetworkScopedSmartWallet,
  SendUserOperationOptions,
  Signer,
  SupportedChainId,
  toSmartWallet,
  waitForUserOperation,
} from "@coinbase/coinbase-sdk";
import {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  Hex,
  http,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
  PublicClient as ViemPublicClient,
} from "viem";
import { Network, NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network";
import { EvmWalletProvider } from "./evmWalletProvider";
import { version } from "../../package.json";

export interface ConfigureSmartWalletOptions {
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
  networkId?: string;
  smartWalletAddress?: Hex;
  paymasterUrl?: string;
  signer: Signer;
}

interface SmartWalletProviderConfig {
  smartWallet: NetworkScopedSmartWallet;
  network: Required<Network>;
  chainId: string;
}

/**
 * A wallet provider that uses Smart Wallets from the Coinbase SDK.
 */
export class SmartWalletProvider extends EvmWalletProvider {
  #smartWallet: NetworkScopedSmartWallet;
  #network: Required<Network>;
  #publicClient: ViemPublicClient;

  /**
   * Constructs a new CdpWalletProvider.
   *
   * @param config - The configuration options for the CdpWalletProvider.
   */
  private constructor(config: SmartWalletProviderConfig) {
    super();

    this.#network = config.network;
    this.#smartWallet = config.smartWallet;
    this.#publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[config.network.networkId],
      transport: http(),
    });
  }

  /**
   * Configures and returns a `SmartWalletProvider` instance using the provided configuration options.
   * This method initializes a smart wallet based on the given network and credentials.
   *
   * @param {ConfigureSmartWalletOptions} config
   *   - Configuration parameters for setting up the smart wallet.
   *
   * @returns {Promise<SmartWalletProvider>}
   *   - A promise that resolves to an instance of `SmartWalletProvider` configured with the provided settings.
   *
   * @throws {Error}
   *   - If networkId is not a supported network.
   *
   * @example
   * ```typescript
   * const smartWalletProvider = await SmartWalletProvider.configureWithWallet({
   *   networkId: "base-sepolia",
   *   signer: privateKeyToAccount("0xethprivatekey"),
   *   cdpApiKeyId: "my-api-key",
   *   cdpApiKeySecret: "my-private-key",
   *   smartWalletAddress: "0x123456...",
   * });
   * ```
   */
  public static async configureWithWallet(
    config: ConfigureSmartWalletOptions,
  ): Promise<SmartWalletProvider> {
    const networkId = config.networkId || process.env.NETWORK_ID || Coinbase.networks.BaseSepolia;
    const network = {
      protocolFamily: "evm" as const,
      chainId: NETWORK_ID_TO_CHAIN_ID[networkId],
      networkId,
    };

    if (!network.chainId) {
      throw new Error(`Unable to determine chainId for network ${networkId}`);
    }

    const supportedChainIds = Object.keys(CHAIN_ID_TO_NETWORK_ID);
    if (!supportedChainIds.includes(network.chainId)) {
      throw new Error(
        `Invalid chain id ${network.chainId}. Chain id must be one of ${supportedChainIds.join(", ")}`,
      );
    }

    const cdpApiKeyId = config.cdpApiKeyId || process.env.CDP_API_KEY_ID;
    const cdpApiKeySecret = config.cdpApiKeySecret || process.env.CDP_API_KEY_SECRET;

    if (cdpApiKeyId && cdpApiKeySecret) {
      Coinbase.configure({
        apiKeyName: cdpApiKeyId,
        privateKey: cdpApiKeySecret?.replace(/\\n/g, "\n"),
        source: "agentkit",
        sourceVersion: version,
      });
    } else {
      Coinbase.configureFromJson({ source: "agentkit", sourceVersion: version });
    }

    const smartWallet = config.smartWalletAddress
      ? toSmartWallet({
          signer: config.signer,
          smartWalletAddress: config.smartWalletAddress,
        })
      : await createSmartWallet({
          signer: config.signer,
        });

    const networkScopedSmartWallet = smartWallet.useNetwork({
      chainId: Number(network.chainId) as SupportedChainId,
      paymasterUrl: config.paymasterUrl,
    });

    const smartWalletProvider = new SmartWalletProvider({
      smartWallet: networkScopedSmartWallet,
      network,
      chainId: network.chainId,
    });

    return smartWalletProvider;
  }

  /**
   * Stub for message signing
   *
   * @throws as signing messages is not implemented for SmartWallets.
   *
   * @param _ - The message to sign.
   * @returns The signed message.
   */
  async signMessage(_: string): Promise<Hex> {
    throw new Error("Not implemented");
  }

  /**
   * Stub for typed data signing
   *
   * @throws as signing typed data is not implemented for SmartWallets.
   *
   * @param _ - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(_: any): Promise<Hex> {
    throw new Error("Not implemented");
  }

  /**
   * Stub for transaction signing
   *
   * @throws as signing transactions is not implemented for SmartWallets.
   *
   * @param _ - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(_: TransactionRequest): Promise<Hex> {
    throw new Error("Not implemented");
  }

  /**
   * Sends a transaction using the smart wallet.
   *
   * Unlike traditional Ethereum transactions, this method submits a **User Operation**
   * instead of directly broadcasting a transaction. The smart wallet handles execution,
   * but a standard transaction hash is still returned upon completion.
   *
   * @param {TransactionRequest} transaction - The transaction details, including:
   *   - `to`: The recipient address.
   *   - `value`: The amount of ETH (or native token) to send.
   *   - `data`: Optional calldata for contract interactions.
   *
   * @returns A promise resolving to the transaction hash (`0x...`).
   *
   * @throws {Error} If the transaction does not complete successfully.
   *
   * @example
   * ```typescript
   * const txHash = await smartWallet.sendTransaction({
   *   to: "0x123...",
   *   value: parseEther("0.1"),
   *   data: "0x",
   * });
   * console.log(`Transaction sent: ${txHash}`);
   * ```
   */
  sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    const { to, value, data } = transaction;

    return this.sendUserOperation({
      calls: [
        {
          to: to as Hex,
          value,
          data,
        },
      ],
    });
  }

  /**
   * Sends a **User Operation** to the smart wallet.
   *
   * This method directly exposes the **sendUserOperation** functionality, allowing
   * **SmartWallet-aware tools** to fully leverage its capabilities, including batching multiple calls.
   * Unlike `sendTransaction`, which wraps calls in a single operation, this method allows
   * direct execution of arbitrary operations within a **User Operation**.
   *
   * @param {Omit<SendUserOperationOptions<T>, "chainId" | "paymasterUrl">} operation
   *   - The user operation configuration, omitting `chainId` and `paymasterUrl`,
   *     which are managed internally by the smart wallet.
   *
   * @returns A promise resolving to the transaction hash (`0x...`) if the operation completes successfully.
   *
   * @throws {Error} If the operation does not complete successfully.
   *
   * @example
   * ```typescript
   * const txHash = await smartWallet.sendUserOperation({
   *   calls: [
   *     { to: "0x123...", value: parseEther("0.1"), data: "0x" },
   *     { to: "0x456...", value: parseEther("0.05"), data: "0x" }
   *   ],
   * });
   * console.log(`User Operation sent: ${txHash}`);
   * ```
   */
  async sendUserOperation<T extends readonly unknown[]>(
    operation: Omit<SendUserOperationOptions<T>, "chainId" | "paymasterUrl">,
  ): Promise<Hex> {
    const sendUserOperationResult = await this.#smartWallet.sendUserOperation(operation);

    const result = await waitForUserOperation(sendUserOperationResult);

    if (result.status === "complete") {
      return result.transactionHash as Hex;
    } else {
      throw new Error(`Transaction failed with status ${result.status}`);
    }
  }

  /**
   * Gets the address of the smart wallet.
   *
   * @returns The address of the smart wallet.
   */
  getAddress(): string {
    return this.#smartWallet.address;
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
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    const balance = await this.#publicClient.getBalance({
      address: this.getAddress() as Hex,
    });

    return balance;
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitForTransactionReceipt(txHash: Hex): Promise<any> {
    return this.#publicClient.waitForTransactionReceipt({
      hash: txHash,
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
    return this.#publicClient.readContract(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: Address, value: string): Promise<Hex> {
    const sendUserOperationResult = await this.#smartWallet.sendUserOperation({
      calls: [
        {
          to,
          value: BigInt(value),
        },
      ],
    });

    const result = await waitForUserOperation(sendUserOperationResult);

    if (result.status === "complete") {
      return result.transactionHash as Hex;
    } else {
      throw new Error(`Transfer failed with status ${result.status}`);
    }
  }
}
