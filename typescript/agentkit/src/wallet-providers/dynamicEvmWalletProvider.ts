import { ViemWalletProvider } from "./viemWalletProvider";
import { createWalletClient, http, type WalletClient } from "viem";
import { getChain } from "../network/network";
import {
  type DynamicWalletConfig,
  type DynamicWalletExport,
  createDynamicWallet,
} from "./dynamicShared";
import type { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";
/**
 * Configuration options for the Dynamic wallet provider.
 *
 * @interface
 */
export interface DynamicEvmWalletConfig extends DynamicWalletConfig {
  /** Optional chain ID to connect to */
  chainId?: string;
}

/**
 * A wallet provider that uses Dynamic's wallet API.
 * This provider extends the ViemWalletProvider to provide Dynamic-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class DynamicEvmWalletProvider extends ViemWalletProvider {
  #accountAddress: string;
  #dynamicClient: DynamicEvmWalletClient;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param walletClient - The Viem wallet client instance
   * @param config - The configuration options for the Dynamic wallet
   */
  private constructor(
    walletClient: WalletClient,
    config: DynamicWalletConfig & { accountAddress: string },
    dynamicClient: DynamicEvmWalletClient,
  ) {
    super(walletClient);
    this.#accountAddress = config.accountAddress;
    this.#dynamicClient = dynamicClient;
  }

  /**
   * Creates and configures a new DynamicWalletProvider instance.
   *
   * @param config - The configuration options for the Dynamic wallet
   * @returns A configured DynamicWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await DynamicWalletProvider.configureWithWallet({
   *   authToken: "your-auth-token",
   *   environmentId: "your-environment-id",
   *   baseApiUrl: "https://app.dynamicauth.com",
   *   baseMPCRelayApiUrl: "relay.dynamicauth.com",
   *   chainType: "ethereum",
   *   chainId: "84532",
   *   thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO
   * });
   * ```
   */
  public static async configureWithWallet(
    config: DynamicEvmWalletConfig,
  ): Promise<DynamicEvmWalletProvider> {
    const { wallet, dynamic } = await createDynamicWallet({
      ...config,
      chainType: "ethereum",
    });

    const chainId = config.chainId || "84532";
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    const publicClient = (dynamic as DynamicEvmWalletClient).createViemPublicClient({
      chain,
    });

    const walletClient = createWalletClient({
      account: {
        address: wallet.accountAddress as `0x${string}`,
        type: "json-rpc",
      },
      chain,
      transport: http(),
    });

    return new DynamicEvmWalletProvider(walletClient, {
      ...config,
      accountAddress: wallet.accountAddress,
    }, dynamic as DynamicEvmWalletClient);
  }

  /**
   * Signs a message using the wallet's private key.
   *
   * @param message - The message to sign
   * @returns The signature as a hex string with 0x prefix
   */
  public async signMessage(message: string): Promise<`0x${string}`> {
    const signature = await this.#dynamicClient.signMessage({
      message,
      accountAddress: this.#accountAddress,
    });
    return signature as `0x${string}`;
  }

  /**
   * Exports the private key for the wallet.
   *
   * @param password - Optional password for encrypted backup shares
   * @returns The private key
   */
  public async exportPrivateKey(password?: string): Promise<string> {
    const result = await this.#dynamicClient.exportPrivateKey({
      accountAddress: this.getAddress(),
      password,
    });
    return result.derivedPrivateKey || "";
  }

  /**
   * Imports a private key.
   *
   * @param privateKey - The private key to import
   * @param password - Optional password for encrypted backup shares
   * @returns The account address and public key
   */
  public async importPrivateKey(privateKey: string, password?: string): Promise<{
    accountAddress: string;
    publicKeyHex: string;
  }> {
    const result = await this.#dynamicClient.importPrivateKey({
      privateKey,
      chainName: "EVM",
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      password,
    });
    return {
      accountAddress: result.accountAddress,
      publicKeyHex: result.publicKeyHex,
    };
  }

  /**
   * Exports the wallet information.
   *
   * @returns The wallet information
   */
  public async exportWallet(): Promise<DynamicWalletExport> {
    return {
      walletId: this.#accountAddress,
      chainId: this.getNetwork().chainId,
      networkId: this.getNetwork().networkId,
    };
  }

  /**
   * Gets the name of the provider.
   *
   * @returns The provider name
   */
  public getName(): string {
    return "dynamic_evm_wallet_provider";
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The wallet address
   */
  public getAddress(): string {
    return this.#accountAddress;
  }
} 