import { CdpClient, EvmServerAccount } from "@coinbase/cdp-sdk";
import {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  createWalletClient,
  Hex,
  http,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  serializeTransaction,
  Signature,
  TransactionRequest,
  TransactionSerializable
} from "viem";
import { Network, NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network";
import { applyGasMultiplier } from "../utils";
import { EvmWalletProvider } from "./evmWalletProvider";
import { toAccount } from "viem/accounts";

export interface CdpV2ProviderConfig {
  /**
   * The CDP API Key ID.
   */
  apiKeyId?: string;

  /**
   * The CDP API Key Secret.
   */
  apiKeySecret?: string;

  /**
   * The CDP Wallet Secret.
   */
  walletSecret?: string;
}
/**
 * Configuration options for the CDP Providers.
 */
export interface CdpV2WalletProviderConfig extends CdpV2ProviderConfig {
  /**
   * The address of the wallet.
   */
  address?: Address;

  /**
   * The idempotency key of the wallet. Only used when creating a new account.
   */
  idempotencyKey?: string;

  /**
   * The network of the wallet.
   */
  networkId?: string;

  /**
 * Configuration for gas multipliers.
 */
  gas?: {
    /**
     * An internal multiplier on gas limit estimation.
     */
    gasLimitMultiplier?: number;

    /**
     * An internal multiplier on fee per gas estimation.
     */
    feePerGasMultiplier?: number;
  };
}

interface ConfigureCdpV2WalletProviderWithWalletOptions {
  /**
   * The CDP client of the wallet.
   */
  cdpClient: CdpClient;

  /**
   * The server account of the wallet.
   */
  serverAccount: EvmServerAccount;

  /**
   * The public client of the wallet.
   */
  publicClient: PublicClient;

  /**
   * The network of the wallet.
   */
  network: Network;

    /**
   * Configuration for gas multipliers.
   */
    gas?: {
      /**
       * An internal multiplier on gas limit estimation.
       */
      gasLimitMultiplier?: number;
  
      /**
       * An internal multiplier on fee per gas estimation.
       */
      feePerGasMultiplier?: number;
    };
}

/**
 * A wallet provider that uses the Coinbase SDK.
 */
export class CdpV2WalletProvider extends EvmWalletProvider {
  #publicClient: PublicClient;
  #serverAccount: EvmServerAccount;
  #cdpClient: CdpClient;
  #network: Network;
  #feePerGasMultiplier: number;
  #gasLimitMultiplier: number;

  /**
   * Constructs a new CdpWalletProvider.
   *
   * @param config - The configuration options for the CdpWalletProvider.
   */
  private constructor(config: ConfigureCdpV2WalletProviderWithWalletOptions) {
    super();

    this.#serverAccount = config.serverAccount;
    this.#cdpClient = config.cdpClient;
    this.#publicClient = config.publicClient;
    this.#network = config.network;
    this.#feePerGasMultiplier = config.gas?.feePerGasMultiplier || 1;
    this.#gasLimitMultiplier = config.gas?.gasLimitMultiplier || 1;
  }

  /**
   * Configures a new CdpWalletProvider with a wallet.
   *
   * @param config - Optional configuration parameters
   * @returns A Promise that resolves to a new CdpWalletProvider instance
   * @throws Error if required environment variables are missing or wallet initialization fails
   */
  public static async configureWithWallet(
    config: CdpV2WalletProviderConfig = {},
  ): Promise<CdpV2WalletProvider> {
    const apiKeyId = config.apiKeyId || process.env.CDP_API_KEY_ID;
    const apiKeySecret = config.apiKeySecret || process.env.CDP_API_KEY_SECRET;
    const walletSecret = config.walletSecret || process.env.CDP_WALLET_SECRET;
    const idempotencyKey = config.idempotencyKey || process.env.IDEMPOTENCY_KEY;

    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error("Missing required environment variables. CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET are required.");
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
    })

    const serverAccount = await (config.address ? cdpClient.evm.getAccount({ address: config.address }) : cdpClient.evm.createAccount({idempotencyKey}))

    const publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
      transport: http(),
    });

    return new CdpV2WalletProvider({
      publicClient,
      cdpClient,
      serverAccount,
      network,
      gas: config.gas,
    })
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string): Promise<Hex> {
    return this.#serverAccount.signMessage({ message });
  }

  /**
   * Signs a typed data object.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<Hex> {
    return this.#serverAccount.signTypedData(typedData);
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<Hex> {
    const serializedTx = serializeTransaction(transaction as TransactionSerializable);
    const signedTx = await this.#cdpClient.evm.signTransaction({
      address: this.#serverAccount.address,
      transaction: serializedTx,
    })

    return signedTx.signature;
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    const viemAccount = toAccount({
      address: this.#serverAccount.address,
      signMessage: async ({ message }) => {
        throw new Error("Not implemented")
      },
      signTransaction: async (transaction) => {
        const result = await this.#cdpClient.evm.signTransaction({
          address: this.#serverAccount.address,
          transaction: serializeTransaction(transaction as TransactionSerializable),
        });
        return result.signature as Hex;
      },
      signTypedData: async (typedData) => {
        throw new Error("Not implemented")
      },
    })

    return await createWalletClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[this.#network.networkId!],
      transport: http()
    }).sendTransaction({
      account: viemAccount,
      to: transaction.to as Address,
      value: transaction.value as bigint,
      data: transaction.data as Hex,
    })
  }


  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    return this.#serverAccount.address;
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
    return "cdp_v2_wallet_provider";
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    return await this.#publicClient!.getBalance({ address: this.#serverAccount.address });
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(txHash: Hex): Promise<any> {
    return await this.#publicClient!.waitForTransactionReceipt({ hash: txHash });
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
    return this.#publicClient!.readContract<abi, functionName, args>(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: Address, value: string): Promise<Hex> {
    return this.sendTransaction({
      to: to,
      value: BigInt(value),
      data: "0x",
    });
  }

  /**
 * Prepares a transaction.
 *
 * @param to - The address to send the transaction to.
 * @param value - The value of the transaction.
 * @param data - The data of the transaction.
 * @returns The prepared transaction.
 */
  async #prepareTransaction(
    to: Address,
    value: bigint,
    data: Hex,
  ): Promise<TransactionSerializable> {
    const nonce = await this.#publicClient!.getTransactionCount({
      address: this.#serverAccount.address,
      blockTag: "pending",
    });

    const feeData = await this.#publicClient.estimateFeesPerGas();
    const maxFeePerGas = applyGasMultiplier(feeData.maxFeePerGas, this.#feePerGasMultiplier);
    const maxPriorityFeePerGas = applyGasMultiplier(
      feeData.maxPriorityFeePerGas,
      this.#feePerGasMultiplier,
    );

    const gasLimit = await this.#publicClient.estimateGas({
      account: this.#serverAccount.address,
      to,
      value,
      data,
    });
    const gas = BigInt(Math.round(Number(gasLimit) * this.#gasLimitMultiplier));

    const chainId = parseInt(this.#network.chainId!);

    return {
      to,
      value,
      data,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gas,
      chainId,
      type: "eip1559",
    };
  }

  /**
   * Adds signature to a transaction and serializes it for broadcast.
   *
   * @param transaction - The transaction to sign.
   * @param signature - The signature to add to the transaction.
   * @returns A serialized transaction.
   */
  async #addSignatureAndSerialize(
    transaction: TransactionSerializable,
    signature: Hex,
  ): Promise<string> {
    // Decode the signature into its components
    const r = `0x${signature.slice(2, 66)}`; // First 32 bytes
    const s = `0x${signature.slice(66, 130)}`; // Next 32 bytes
    const v = BigInt(parseInt(signature.slice(130, 132), 16)); // Last byte

    return serializeTransaction(transaction, { r, s, v } as Signature);
  }
}
