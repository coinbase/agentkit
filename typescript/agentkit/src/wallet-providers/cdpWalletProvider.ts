import { version } from "../../package.json";
import { Decimal } from "decimal.js";
import {
  createPublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  serializeTransaction,
  TransactionRequest,
  TransactionSerializable,
  http,
  keccak256,
  Signature,
  PublicClient,
  Abi,
  ContractFunctionName,
  ContractFunctionArgs,
  Address,
  Hex,
  hashMessage,
} from "viem";
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import {
  Coinbase,
  CreateERC20Options,
  CreateTradeOptions,
  ExternalAddress,
  SmartContract,
  Trade,
  Wallet,
  WalletData,
  hashTypedDataMessage,
} from "@coinbase/coinbase-sdk";
import { NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";
import { applyGasMultiplier } from "../utils";

/**
 * Configuration options for the CDP Providers.
 */
export interface CdpProviderConfig {
  /**
   * The CDP API Key Name.
   */
  apiKeyId?: string;

  /**
   * The CDP API Key Private Key.
   */
  apiKeySecret?: string;
}

/**
 * Configuration options for the CdpActionProvider.
 */
export interface CdpWalletProviderConfig extends CdpProviderConfig {
  /**
   * The CDP Wallet.
   */
  wallet?: Wallet;

  /**
   * The address of the wallet.
   */
  address?: string;

  /**
   * The network of the wallet.
   */
  network?: Network;

  /**
   * The network ID of the wallet.
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

/**
 * Configuration options for the CDP Agentkit with a Wallet.
 */
interface ConfigureCdpAgentkitWithWalletOptions extends CdpWalletProviderConfig {
  /**
   * The data of the CDP Wallet as a JSON string.
   */
  cdpWalletData?: string;

  /**
   * The mnemonic phrase of the wallet.
   */
  mnemonicPhrase?: string;
}

/**
 * A wallet provider that uses the Coinbase SDK.
 */
export class CdpWalletProvider extends EvmWalletProvider {
  #cdpWallet?: Wallet;
  #address?: string;
  #network?: Network;
  #publicClient: PublicClient;
  #gasLimitMultiplier: number;
  #feePerGasMultiplier: number;
  #transactionQueue: Promise<void> | undefined;

  /**
   * Constructs a new CdpWalletProvider.
   *
   * @param config - The configuration options for the CdpWalletProvider.
   */
  private constructor(config: CdpWalletProviderConfig) {
    super();

    this.#cdpWallet = config.wallet;
    this.#address = config.address;
    this.#network = config.network;
    this.#publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[config.network!.networkId!],
      transport: http(),
    });
    this.#gasLimitMultiplier = Math.max(config.gas?.gasLimitMultiplier ?? 1.2, 1);
    this.#feePerGasMultiplier = Math.max(config.gas?.feePerGasMultiplier ?? 1, 1);
  }

  /**
   * Configures a new CdpWalletProvider with a wallet.
   *
   * @param config - Optional configuration parameters
   * @returns A Promise that resolves to a new CdpWalletProvider instance
   * @throws Error if required environment variables are missing or wallet initialization fails
   */
  public static async configureWithWallet(
    config: ConfigureCdpAgentkitWithWalletOptions = {},
  ): Promise<CdpWalletProvider> {
    if (config.apiKeyId && config.apiKeySecret) {
      Coinbase.configure({
        apiKeyName: config.apiKeyId,
        privateKey: config.apiKeySecret?.replace(/\\n/g, "\n"),
        source: "agentkit",
        sourceVersion: version,
      });
    } else {
      Coinbase.configureFromJson({ source: "agentkit", sourceVersion: version });
    }

    let wallet: Wallet;

    const mnemonicPhrase = config.mnemonicPhrase || process.env.MNEMONIC_PHRASE;
    let networkId = config.networkId || process.env.NETWORK_ID || Coinbase.networks.BaseSepolia;

    try {
      if (config.wallet) {
        wallet = config.wallet;
      } else if (config.cdpWalletData) {
        const walletData = JSON.parse(config.cdpWalletData) as WalletData;
        wallet = await Wallet.import(walletData);
        networkId = wallet.getNetworkId();
      } else if (mnemonicPhrase) {
        wallet = await Wallet.import({ mnemonicPhrase: mnemonicPhrase }, networkId);
      } else {
        wallet = await Wallet.create({ networkId: networkId });
      }
    } catch (error) {
      throw new Error(`Failed to initialize wallet: ${error}`);
    }

    const address = (await wallet.getDefaultAddress())?.getId();

    const network = {
      protocolFamily: "evm" as const,
      chainId: NETWORK_ID_TO_CHAIN_ID[networkId],
      networkId: networkId,
    };

    const cdpWalletProvider = new CdpWalletProvider({
      wallet,
      address,
      network,
      gas: config.gas,
    });

    return cdpWalletProvider;
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const messageHash = hashMessage(message);
    const payload = await this.#cdpWallet.createPayloadSignature(messageHash);

    if (payload.getStatus() === "pending" && payload?.wait) {
      await payload.wait(); // needed for Server-Signers
    }

    return payload.getSignature() as `0x${string}`;
  }

  /**
   * Signs a typed data object.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const messageHash = hashTypedDataMessage(
      typedData.domain!,
      typedData.types!,
      typedData.message!,
    );

    const payload = await this.#cdpWallet.createPayloadSignature(messageHash);

    if (payload.getStatus() === "pending" && payload?.wait) {
      await payload.wait(); // needed for Server-Signers
    }

    return payload.getSignature() as `0x${string}`;
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const serializedTx = serializeTransaction(transaction as TransactionSerializable);
    const transactionHash = keccak256(serializedTx);

    const payload = await this.#cdpWallet.createPayloadSignature(transactionHash);

    if (payload.getStatus() === "pending" && payload?.wait) {
      await payload.wait(); // needed for Server-Signers
    }

    return payload.getSignature() as `0x${string}`;
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const sendPromise = (async () => {
      if (this.#transactionQueue) await this.#transactionQueue;

      const preparedTransaction = await this.prepareTransaction(
        transaction.to!,
        transaction.value!,
        transaction.data!,
      );

      const signature = await this.signTransaction({
        ...preparedTransaction,
      } as TransactionRequest);

      const signedPayload = await this.addSignatureAndSerialize(preparedTransaction, signature);

      const externalAddress = new ExternalAddress(this.#cdpWallet!.getNetworkId(), this.#address!);

      const tx = await externalAddress.broadcastExternalTransaction(signedPayload.slice(2));

      return tx.transactionHash as `0x${string}`;
    })();
    this.#transactionQueue = sendPromise
      .then(txHash => this.waitForTransactionReceipt(txHash))
      .catch(() => {});
    return await sendPromise;
  }

  /**
   * Prepares a transaction.
   *
   * @param to - The address to send the transaction to.
   * @param value - The value of the transaction.
   * @param data - The data of the transaction.
   * @returns The prepared transaction.
   */
  async prepareTransaction(
    to: `0x${string}`,
    value: bigint,
    data: `0x${string}`,
  ): Promise<TransactionSerializable> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const nonce = await this.#publicClient!.getTransactionCount({
      address: this.#address! as `0x${string}`,
      blockTag: "pending",
    });

    const feeData = await this.#publicClient.estimateFeesPerGas();
    const maxFeePerGas = applyGasMultiplier(feeData.maxFeePerGas, this.#feePerGasMultiplier);
    const maxPriorityFeePerGas = applyGasMultiplier(
      feeData.maxPriorityFeePerGas,
      this.#feePerGasMultiplier,
    );

    const gasLimit = await this.#publicClient.estimateGas({
      account: this.#address! as `0x${string}`,
      to,
      value,
      data,
    });
    const gas = BigInt(Math.round(Number(gasLimit) * this.#gasLimitMultiplier));

    const chainId = parseInt(this.#network!.chainId!, 10);

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
  async addSignatureAndSerialize(
    transaction: TransactionSerializable,
    signature: `0x${string}`,
  ): Promise<string> {
    // Decode the signature into its components
    const r = `0x${signature.slice(2, 66)}`; // First 32 bytes
    const s = `0x${signature.slice(66, 130)}`; // Next 32 bytes
    const v = BigInt(parseInt(signature.slice(130, 132), 16)); // Last byte

    return serializeTransaction(transaction, { r, s, v } as Signature);
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    if (!this.#address) {
      throw new Error("Address not initialized");
    }

    return this.#address;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    if (!this.#network) {
      throw new Error("Network not initialized");
    }

    return this.#network;
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  getName(): string {
    return "cdp_wallet_provider";
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const balance = await this.#cdpWallet.getBalance("eth");
    return BigInt(balance.mul(10 ** 18).toString());
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
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
   * Creates a trade.
   *
   * @param options - The options for the trade.
   * @returns The trade.
   */
  async createTrade(options: CreateTradeOptions): Promise<Trade> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    return this.#cdpWallet.createTrade(options);
  }

  /**
   * Deploys a token.
   *
   * @param options - The options for the token deployment.
   * @returns The deployed token.
   */
  async deployToken(options: CreateERC20Options): Promise<SmartContract> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    return this.#cdpWallet.deployToken(options);
  }

  /**
   * Deploys a contract.
   *
   * @param options - The options for contract deployment
   * @param options.solidityVersion - The version of the Solidity compiler to use (e.g. "0.8.0+commit.c7dfd78e")
   * @param options.solidityInputJson - The JSON input for the Solidity compiler containing contract source and settings
   * @param options.contractName - The name of the contract to deploy
   * @param options.constructorArgs - Key-value map of constructor args
   *
   * @returns A Promise that resolves to the deployed contract instance
   * @throws Error if wallet is not initialized
   */
  async deployContract(options: {
    solidityVersion: string;
    solidityInputJson: string;
    contractName: string;
    constructorArgs: Record<string, unknown>;
  }): Promise<SmartContract> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    return this.#cdpWallet.deployContract(options);
  }

  /**
   * Deploys a new NFT (ERC-721) smart contract.
   *
   * @param options - Configuration options for the NFT contract deployment
   * @param options.name - The name of the collection
   * @param options.symbol - The token symbol for the collection
   * @param options.baseURI - The base URI for token metadata.
   *
   * @returns A Promise that resolves to the deployed SmartContract instance
   * @throws Error if the wallet is not properly initialized
   * @throws Error if the deployment fails for any reason (network issues, insufficient funds, etc.)
   */
  async deployNFT(options: {
    name: string;
    symbol: string;
    baseURI: string;
  }): Promise<SmartContract> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    return this.#cdpWallet.deployNFT(options);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }
    const transferResult = await this.#cdpWallet.createTransfer({
      amount: new Decimal(value),
      assetId: Coinbase.assets.Eth,
      destination: to,
      gasless: false,
    });

    const result = await transferResult.wait();

    if (!result.getTransactionHash()) {
      throw new Error("Transaction hash not found");
    }

    return result.getTransactionHash() as `0x${string}`;
  }

  /**
   * Exports the wallet.
   *
   * @returns The wallet's data.
   */
  async exportWallet(): Promise<WalletData> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    return this.#cdpWallet.export();
  }

  /**
   * Gets the wallet.
   *
   * @returns The wallet.
   */
  getWallet(): Wallet {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }
    return this.#cdpWallet;
  }

  /**
   * ERC20 transfer method
   *
   * @param assetId - The asset ID to transfer. Either USDC, CBBTC or EURC
   * @param destination - The destination address
   * @param amount - The amount to transfer
   * @returns The transaction hash
   */
  async gaslessERC20Transfer(
    assetId:
      | typeof Coinbase.assets.Usdc
      | typeof Coinbase.assets.Cbbtc
      | typeof Coinbase.assets.Eurc,
    destination: Address,
    amount: bigint,
  ): Promise<Hex> {
    if (!this.#cdpWallet) {
      throw new Error("Wallet not initialized");
    }

    const transferResult = await this.#cdpWallet.createTransfer({
      amount,
      assetId,
      destination,
      gasless: true,
    });

    const result = await transferResult.wait();

    if (!result.getTransactionHash()) {
      throw new Error("Transaction hash not found");
    }

    return result.getTransactionHash() as Hex;
  }
}
