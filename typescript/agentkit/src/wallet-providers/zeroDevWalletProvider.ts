import { createKernelAccount, KernelSmartAccountImplementation } from "@zerodev/sdk";
import { KERNEL_V3_2, getEntryPoint } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createIntentClient,
  type GetCABParameters,
  type GetCABResult,
  installIntentExecutor,
  INTENT_V0_3,
} from "@zerodev/intent";
import {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  http,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
  Hex,
  zeroAddress,
  Hash,
  Account,
} from "viem";
import { SmartAccount } from "viem/account-abstraction";
import { EvmWalletProvider } from "./evmWalletProvider";
import { NETWORK_ID_TO_VIEM_CHAIN, type Network } from "../network";
import { Signer } from "@zerodev/sdk/types";

/**
 * Configuration options for the ZeroDev Wallet Provider.
 */
export interface ZeroDevWalletProviderConfig {
  /**
   * The underlying EVM wallet provider to use as a signer.
   */
  signer: Account;

  /**
   * The ZeroDev project ID.
   */
  projectId: string;

  /**
   * The EntryPoint version ("0.6" or "0.7").
   * Defaults to "0.7".
   */
  entryPointVersion?: "0.6" | "0.7";

  /**
   * The network ID of the wallet.
   */
  networkId?: string;

  /**
   * The address of the wallet.
   * If not provided, it will be computed from the signer.
   */
  address?: Address;
}

/**
 * A wallet provider that uses ZeroDev's account abstraction.
 */
export class ZeroDevWalletProvider extends EvmWalletProvider {
  #signer: Account;
  #projectId: string;
  #network: Network;
  #address: Address;
  #publicClient: PublicClient;
  #kernelAccount: SmartAccount<KernelSmartAccountImplementation>;
  #intentClient: Awaited<ReturnType<typeof createIntentClient>>;

  /**
   * Constructs a new ZeroDevWalletProvider.
   *
   * @param config - The configuration options for the ZeroDevWalletProvider.
   * @param kernelAccount - The kernel account.
   * @param intentClient - The intent client.
   */
  private constructor(
    config: ZeroDevWalletProviderConfig,
    kernelAccount: SmartAccount<KernelSmartAccountImplementation>,
    intentClient: Awaited<ReturnType<typeof createIntentClient>>,
  ) {
    super();

    this.#signer = config.signer;
    this.#projectId = config.projectId;
    this.#network = {
      protocolFamily: "evm",
      networkId: config.networkId!,
      chainId: NETWORK_ID_TO_VIEM_CHAIN[config.networkId!].id.toString(),
    };
    this.#address = kernelAccount.address;
    this.#kernelAccount = kernelAccount;
    this.#intentClient = intentClient;

    // Create public client
    this.#publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[this.#network.networkId!],
      transport: http(),
    });
  }

  /**
   * Configures a new ZeroDevWalletProvider with an existing wallet provider as the signer.
   *
   * @param config - The configuration options for the ZeroDevWalletProvider.
   * @returns A Promise that resolves to a new ZeroDevWalletProvider instance.
   */
  public static async configureWithWallet(
    config: ZeroDevWalletProviderConfig,
  ): Promise<ZeroDevWalletProvider> {
    if (!config.signer) {
      throw new Error("Signer is required");
    }

    if (!config.projectId) {
      throw new Error("ZeroDev project ID is required");
    }
    const networkId = config.networkId || "base-sepolia";

    const chain = NETWORK_ID_TO_VIEM_CHAIN[networkId];
    const bundlerRpc = `https://rpc.zerodev.app/api/v3/bundler/${config.projectId}`;

    // Create public client
    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    // Create ECDSA validator
    const entryPoint = getEntryPoint(config.entryPointVersion || "0.7");
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: config.signer as Signer,
      entryPoint,
      kernelVersion: KERNEL_V3_2,
    });

    // Create kernel account with intent executor
    const kernelAccount = await createKernelAccount(publicClient, {
      plugins: {
        sudo: ecdsaValidator,
      },
      entryPoint,
      kernelVersion: KERNEL_V3_2,
      address: config.address as Address | undefined,
      initConfig: [installIntentExecutor(INTENT_V0_3)],
    });

    // Create intent client
    const intentClient = await createIntentClient({
      account: kernelAccount,
      chain,
      bundlerTransport: http(bundlerRpc),
      version: INTENT_V0_3,
    });

    return new ZeroDevWalletProvider(
      config,
      kernelAccount as SmartAccount<KernelSmartAccountImplementation>,
      intentClient,
    );
  }

  /**
   * Signs a message using the Kernel account.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string | Uint8Array): Promise<Hex> {
    // Convert Uint8Array to string if needed
    const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);

    return this.#kernelAccount.signMessage({
      message: messageStr,
    });
  }

  /**
   * Signs a typed data object using the Kernel account.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<Hex> {
    return this.#kernelAccount.signTypedData(typedData);
  }

  /**
   * Signs a transaction using the Kernel account.
   *
   * @param _transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(_transaction: TransactionRequest): Promise<Hex> {
    throw new Error("signTransaction is not supported for ZeroDev Wallet Provider");
  }

  /**
   * Sends a transaction using ZeroDev's Intent system.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    // Get the chain ID from the network
    const chainId = parseInt(this.#network.chainId!);

    // Determine if this is a native token transfer
    const isNativeTransfer =
      transaction.value &&
      BigInt(transaction.value) > 0 &&
      (!transaction.data || transaction.data === "0x");

    // For native token transfers, use ETH as the output token
    if (isNativeTransfer) {
      const intent = await this.#intentClient.sendUserIntent({
        calls: [
          {
            to: transaction.to as Address,
            value: BigInt(transaction.value || 0),
            data: (transaction.data as Hex) || "0x",
          },
        ],
        outputTokens: [
          {
            address: zeroAddress,
            chainId,
            amount: BigInt(transaction.value || 0),
          },
        ],
      });

      const receipt = await this.#intentClient.waitForUserIntentExecutionReceipt({
        uiHash: intent.outputUiHash.uiHash,
      });

      return (receipt?.receipt.transactionHash as Hash) || "0x";
    }

    const intent = await this.#intentClient.sendUserIntent({
      calls: [
        {
          to: transaction.to as Address,
          value: BigInt(transaction.value || 0),
          data: (transaction.data as Hex) || "0x",
        },
      ],
      chainId: chainId,
    });

    const receipt = await this.#intentClient.waitForUserIntentExecutionReceipt({
      uiHash: intent.outputUiHash.uiHash,
    });

    return (receipt?.receipt.transactionHash as Hash) || "0x";
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  async waitForTransactionReceipt(txHash: Hash): Promise<unknown> {
    return this.#publicClient.waitForTransactionReceipt({ hash: txHash });
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
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): Address {
    return this.#address;
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
    return "zerodev_wallet_provider";
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei.
   */
  async getBalance(): Promise<bigint> {
    return this.#publicClient.getBalance({
      address: this.#address as Address,
    });
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH).
   * @returns The transaction hash.
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    // Convert value to wei (assuming value is in whole units)
    const valueInWei = BigInt(parseFloat(value) * 10 ** 18);

    // Get the chain ID from the network
    const chainId = parseInt(this.#network.chainId || "1");

    const intent = await this.#intentClient.sendUserIntent({
      calls: [
        {
          to: to as Address,
          value: valueInWei,
          data: "0x",
        },
      ],
      outputTokens: [
        {
          address: zeroAddress,
          chainId,
          amount: valueInWei,
        },
      ],
    });

    const receipt = await this.#intentClient.waitForUserIntentExecutionReceipt({
      uiHash: intent.outputUiHash.uiHash,
    });

    return receipt?.receipt.transactionHash || "";
  }

  /**
   * Gets the ZeroDev Kernel account.
   *
   * @returns The ZeroDev Kernel account.
   */
  getKernelAccount(): SmartAccount<KernelSmartAccountImplementation> {
    return this.#kernelAccount;
  }

  /**
   * Gets the ZeroDev Intent client.
   *
   * @returns The ZeroDev Intent client.
   */
  getIntentClient(): Awaited<ReturnType<typeof createIntentClient>> {
    return this.#intentClient;
  }

  /**
   * Gets chain abstracted balance.
   *
   * @param options - The options for the get CAB.
   * @returns The chain abstracted balance.
   */
  async getCAB(options: GetCABParameters): Promise<GetCABResult> {
    return this.#intentClient.getCAB(options);
  }
}
