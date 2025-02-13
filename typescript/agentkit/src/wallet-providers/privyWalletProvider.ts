import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { ViemWalletProvider } from "./viemWalletProvider";
import { createWalletClient, http, WalletClient } from "viem";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";

/**
 * Configuration options for the Privy wallet provider.
 *
 * @interface
 */
interface PrivyWalletConfig {
  /** The Privy application ID */
  appId: string;
  /** The Privy application secret */
  appSecret: string;
  /** The ID of the wallet to use */
  walletId?: string;
  /** Optional network ID to connect to */
  networkId?: string;
  /** Optional authorization key for the wallet API */
  authorizationKey?: string;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 * This provider extends the ViemWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivyWalletProvider extends ViemWalletProvider {
  #walletId: string;
  #authorizationKey: string | undefined;

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
    this.#authorizationKey = config.authorizationKey;
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
   *   networkId: "base-sepolia"
   * });
   * ```
   */
  public static async configureWithWallet(config: PrivyWalletConfig): Promise<PrivyWalletProvider> {
    const privy = new PrivyClient(config.appId, config.appSecret, {
      walletApi: config.authorizationKey
        ? {
            authorizationPrivateKey: config.authorizationKey,
          }
        : undefined,
    });

    // Get wallet details to get the address
    const walletId =
      config.walletId ??
      (
        await privy.walletApi.create({
          chaintype: "ethereum",
          authorizationKeyIds: config.authorizationKey ? [config.authorizationKey] : undefined,
        })
      ).id;

    const wallet = await privy.walletApi.getWallet({ id: walletId });

    const account = await createViemAccount({
      walletId,
      address: wallet.address as `0x${string}`,
      privy,
    });

    const network = {
      protocolFamily: "evm" as const,
      networkId: config.networkId || "base-sepolia",
    };

    const chain = NETWORK_ID_TO_VIEM_CHAIN[network.networkId!];
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
    return new PrivyWalletProvider(walletClient, { ...config, walletId });
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The string identifier for this wallet provider
   */
  getName(): string {
    return "privy_wallet_provider";
  }

  /**
   * Exports the wallet data.
   *
   * @returns The wallet data
   */
  exportWallet(): {
    walletId: string;
    authorizationKey: string | undefined;
    networkId?: string;
  } {
    return {
      walletId: this.#walletId,
      authorizationKey: this.#authorizationKey,
      networkId: this.getNetwork().networkId,
    };
  }
}
