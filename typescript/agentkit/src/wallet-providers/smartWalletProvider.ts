import {
  CHAIN_ID_TO_NETWORK_ID,
  Coinbase,
  createSmartWallet,
  toSmartWallet,
  NetworkScopedSmartWallet,
  SmartWallet,
  SupportedChainId,
  waitForUserOperation,
} from "@coinbase/coinbase-sdk";
import {
  createPublicClient,
  Hex,
  http,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
  PublicClient as ViemPublicClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Network, NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network";
import { EvmWalletProvider } from "./evmWalletProvider";

export interface ConfigureCdpAgentkitWithWalletOptions {
  cdpApiKeyName?: string;
  cdpApiKeyPrivateKey?: string;
  networkId?: string;
  chainId?: string;
  privateKey?: Hex;
  smartWalletAddress?: Hex;
}

interface SmartWalletProviderConfig
  extends Required<
    Omit<
      ConfigureCdpAgentkitWithWalletOptions,
      "cdpApiKeyName" | "cdpApiKeyPrivateKey" | "networkId" | "smartWalletAddress"
    >
  > {
  smartWallet: NetworkScopedSmartWallet;
  network: Required<Network>;
}

/**
 *
 */
export class SmartWalletProvider extends EvmWalletProvider {
  #smartWallet: NetworkScopedSmartWallet;
  #privateKey: Hex;
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
    this.#privateKey = config.privateKey;
    this.#smartWallet = config.smartWallet;
    this.#publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[config.network.networkId],
      transport: http(),
    });
  }

  /**
   *
   * @param config
   */
  public static async configureWithWallet(
    config: ConfigureCdpAgentkitWithWalletOptions = {},
  ): Promise<SmartWalletProvider> {
    const networkId = config.networkId || process.env.NETWORK_ID || Coinbase.networks.BaseSepolia;
    const network = {
      protocolFamily: "evm" as const,
      chainId: NETWORK_ID_TO_CHAIN_ID[networkId],
      networkId: networkId,
    };

    if (config.chainId) {
      if (network.chainId && network.chainId != config.chainId) {
        throw new Error(`Passed in a invalid combination of networkId and chainId`);
      }
      network.chainId = config.chainId;
    }

    if (!network.chainId) {
      throw new Error(`Unable to determine chainId for network ${networkId}`);
    }

    const supportedChainIds = Object.keys(CHAIN_ID_TO_NETWORK_ID);
    if (!supportedChainIds.includes(network.chainId)) {
      throw new Error(
        `Invalid chain id ${network.chainId}. Chain id must be one of ${supportedChainIds.join(", ")}`,
      );
    }

    const privateKey = (config.privateKey ||
      process.env.PRIVATE_KEY ||
      generatePrivateKey()) as Hex;
    const signer = privateKeyToAccount(privateKey);

    const cdpApiKeyName = config.cdpApiKeyName || process.env.CDP_API_KEY_NAME;
    const cdpApiKeyPrivateKey = (
      config.cdpApiKeyPrivateKey || process.env.CDP_API_KEY_PRIVATE_KEY
    )?.replace(/\\n/g, "\n");

    if (!cdpApiKeyName || !cdpApiKeyPrivateKey) {
      throw new Error(
        `CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY are both required in SmartWalletProvider`,
      );
    }

    Coinbase.configure({
      apiKeyName: cdpApiKeyName as string,
      privateKey: cdpApiKeyPrivateKey as string,
    });

    const smartWallet = config.smartWalletAddress
      ? toSmartWallet({
          signer,
          smartWalletAddress: config.smartWalletAddress,
        })
      : await createSmartWallet({
          signer,
        });

    const networkScopedSmartWallet = smartWallet.useNetwork({
      chainId: Number(network.chainId) as SupportedChainId,
    });

    const smartWalletProvider = new SmartWalletProvider({
      smartWallet: networkScopedSmartWallet,
      privateKey,
      network,
      chainId: network.chainId,
    });

    return smartWalletProvider;
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    throw new Error("Not implemented");
  }

  /**
   * Signs a typed data object.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    throw new Error("Not implemented");
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    throw new Error("Not implemented");
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const { to, value, data } = transaction;

    const sendUserOperationResult = await this.#smartWallet.sendUserOperation({
      calls: [
        {
          to: to as Hex,
          value,
          data,
        },
      ],
    });

    const result = await waitForUserOperation(sendUserOperationResult);

    if (result.status == "complete") {
      return result.transactionHash as `0x${string}`;
    } else {
      throw new Error("Transfer failed");
    }
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
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
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return await this.#publicClient.waitForTransactionReceipt({
      hash: txHash,
    })
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  async readContract(params: ReadContractParameters): Promise<ReadContractReturnType> {
    return this.#publicClient!.readContract(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    const sendUserOperationResult = await this.#smartWallet.sendUserOperation({
      calls: [
        {
          to,
          value: BigInt(value),
        },
      ],
    });

    const result = await waitForUserOperation(sendUserOperationResult);

    if (result.status == "complete") {
      return result.transactionHash as `0x${string}`;
    } else {
      throw new Error("Transfer failed");
    }
  }

  /**
   * Exports the wallet.
   *
   * @returns The wallet's data.
   */
  async exportPrivateKey(): Promise<Hex> {
    return this.#privateKey;
  }
}
