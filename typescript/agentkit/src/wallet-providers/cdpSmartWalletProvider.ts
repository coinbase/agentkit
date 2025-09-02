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
} from "viem";
import { Network, NETWORK_ID_TO_CHAIN_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network";
import { EvmWalletProvider } from "./evmWalletProvider";
import { WalletProviderWithClient, CdpSmartWalletProviderConfig } from "./cdpShared";

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

    // Smart wallets are currently only supported on Base networks
    if (!networkId.startsWith("base-")) {
      throw new Error(`Smart wallets are only supported on Base networks. Got: ${networkId}`);
    }

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
   * Signs a message using the owner account.
   *
   * @param _message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(_message: string): Promise<Hex> {
    throw new Error(
      "Direct message signing not supported for smart wallets. Use sendTransaction instead.",
    );
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
      network: this.#getCdpSdkNetwork(),
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
      network: this.#getCdpSdkNetwork(),
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
    // This is a simplified implementation - in practice you might want to poll
    // the CDP API for user operation status
    return this.#cdp.evm.waitForUserOperation({
      smartAccountAddress: this.smartAccount.address,
      userOpHash,
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
   * Transfer the native asset of the network using smart wallet.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
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
  #getCdpSdkNetwork(): CdpSmartWalletNetwork {
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
