import { PrivyClient, Wallet } from "@privy-io/server-auth";

/**
 * Configuration options for the Privy wallet provider.
 *
 * @interface
 */
export interface PrivyWalletConfig {
  /** The Privy application ID */
  appId: string;
  /** The Privy application secret */
  appSecret: string;
  /** The ID of the wallet to use, if not provided a new wallet will be created */
  walletId?: string;
  /** Optional authorization key for the wallet API */
  authorizationPrivateKey?: string;
  /** Optional authorization key ID for creating new wallets */
  authorizationKeyId?: string;
  /** The chain type to create the wallet on */
  chainType?: "ethereum" | "solana";
}

export type PrivyWalletExport = {
  walletId: string;
  authorizationPrivateKey: string | undefined;
  chainId: string | undefined;
  networkId: string | undefined;
};

type CreatePrivyWalletReturnType = {
  wallet: Wallet & { id: string };
  privy: PrivyClient;
};

/**
 * Create a Privy wallet
 *
 * @param config - The configuration options for the Privy wallet
 * @returns The created Privy wallet
 */
export async function createPrivyWallet(
  config: PrivyWalletConfig,
): Promise<CreatePrivyWalletReturnType> {
  const privy = new PrivyClient(config.appId, config.appSecret, {
    walletApi: config.authorizationPrivateKey
      ? {
          authorizationPrivateKey: config.authorizationPrivateKey,
        }
      : undefined,
  });

  if (config.walletId) {
    const wallet = await privy.walletApi.getWallet({ id: config.walletId });
    if (!wallet) {
      throw new Error(`Wallet with ID ${config.walletId} not found`);
    }
    return { wallet, privy };
  }

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
      chainType: config.chainType,
      authorizationKeyIds: config.authorizationKeyId ? [config.authorizationKeyId] : undefined,
    });
    return { wallet, privy };
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
}
