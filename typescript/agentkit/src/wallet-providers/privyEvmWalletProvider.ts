import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { ViemWalletProvider } from "./viemWalletProvider";
import { createWalletClient, http, WalletClient } from "viem";
import { getChain } from "../network/network";
import { PrivyWalletConfig, PrivyWalletExport } from "./privyShared";

/**
 * Configuration options for the Privy wallet provider.
 *
 * @interface
 */
export interface PrivyEvmWalletConfig extends PrivyWalletConfig {
  /** Optional chain ID to connect to */
  chainId?: string;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 * This provider extends the ViemWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivyEvmWalletProvider extends ViemWalletProvider {
  #walletId: string;
  #authorizationPrivateKey: string | undefined;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param walletClient - The Viem wallet client instance
   * @param config - The configuration options for the Privy wallet
   */
  private constructor(
    walletClient: WalletClient,
    config: PrivyWalletConfig & { walletId: string }, // Require walletId in constructor
  ) {
    super(walletClient);
    this.#walletId = config.walletId; // Now guaranteed to exist
    this.#authorizationPrivateKey = config.authorizationPrivateKey;
  }

  /**
   * Creates and configures a new PrivyWalletProvider instance.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured PrivyWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   walletId: "wallet-id",
   *   chainId: "84532"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: PrivyEvmWalletConfig,
  ): Promise<PrivyEvmWalletProvider> {
    const privy = new PrivyClient(config.appId, config.appSecret, {
      walletApi: config.authorizationPrivateKey
        ? {
            authorizationPrivateKey: config.authorizationPrivateKey,
          }
        : undefined,
    });

    let walletId: string;
    let address: `0x${string}`;

    if (!config.walletId) {
      if (config.authorizationPrivateKey && !config.authorizationKeyId) {
        throw new Error(
          "authorizationKeyId is required when creating a new wallet with an authorization key, this can be found in your Privy Dashboard",
        );
      }

      if (config.authorizationKeyId && !config.authorizationPrivateKey) {
        throw new Error(
          "authorizationPrivateKey is required when creating a new wallet with an authorizationKeyId. " +
            "If you don't have it, you can create a new one in your Privy Dashboard, or delete the authorization key.",
        );
      }

      try {
        const wallet = await privy.walletApi.create({
          chainType: "ethereum",
          authorizationKeyIds: config.authorizationKeyId ? [config.authorizationKeyId] : undefined,
        });
        walletId = wallet.id;
        address = wallet.address as `0x${string}`;
      } catch (error) {
        console.error(error);
        if (
          error instanceof Error &&
          error.message.includes("Missing `privy-authorization-signature` header")
        ) {
          // Providing a more informative error message, see context: https://github.com/coinbase/agentkit/pull/242#discussion_r1956428617
          throw new Error(
            "Privy error: you have an authorization key on your account which can create and modify wallets, please delete this key or pass it to the PrivyWalletProvider to create a new wallet",
          );
        }
        throw new Error("Failed to create wallet");
      }
    } else {
      walletId = config.walletId;
      const wallet = await privy.walletApi.getWallet({ id: walletId });
      if (!wallet) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }
      address = wallet.address as `0x${string}`;
    }

    const account = await createViemAccount({
      walletId,
      address,
      privy,
    });

    const chainId = config.chainId || "84532";

    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
    return new PrivyEvmWalletProvider(walletClient, { ...config, walletId });
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The string identifier for this wallet provider
   */
  getName(): string {
    return "privy_evm_wallet_provider";
  }

  /**
   * Exports the wallet data.
   *
   * @returns The wallet data
   */
  exportWallet(): PrivyWalletExport {
    return {
      walletId: this.#walletId,
      authorizationPrivateKey: this.#authorizationPrivateKey,
      chainId: this.getNetwork().chainId,
      networkId: this.getNetwork().networkId,
    };
  }
}
