/**
 * Configuration options for the Dynamic wallet provider.
 *
 * @interface
 */
export interface DynamicWalletConfig {
  /** The Dynamic authentication token */
  authToken: string;
  /** The Dynamic environment ID */
  environmentId: string;
  /** The account address of the wallet to use, if not provided a new wallet will be created */
  accountAddress?: string;
  /** The network ID to use for the wallet */
  networkId: string;
  /** The threshold signature scheme to use for wallet creation */
  thresholdSignatureScheme?: string;
  /** Optional password for encrypted backup shares */
  password?: string;
}

export type DynamicWalletExport = {
  accountAddress: string;
  networkId: string | undefined;
};

export type DynamicWalletClient = Awaited<ReturnType<typeof createDynamicClient>>;

type CreateDynamicWalletReturnType = {
  wallet: {
    accountAddress: string;
    publicKeyHex?: string; // Only for EVM
    rawPublicKey: Uint8Array;
    externalServerKeyShares: unknown[]; // Specify a more appropriate type if known
  };
  dynamic: DynamicWalletClient;
};

/**
 * Converts a string threshold signature scheme to the enum value
 *
 * @param scheme - The string representation of the threshold signature scheme
 * @returns The corresponding ThresholdSignatureScheme enum value
 */
const convertThresholdSignatureScheme = async (scheme?: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { ThresholdSignatureScheme } = (await import("@dynamic-labs-wallet/node")) as any;
  if (scheme === "TWO_OF_THREE") return ThresholdSignatureScheme.TWO_OF_THREE;
  if (scheme === "THREE_OF_FIVE") return ThresholdSignatureScheme.THREE_OF_FIVE;
  return ThresholdSignatureScheme.TWO_OF_TWO;
};
/**
 * Create a Dynamic client based on the chain type
 *
 * @param config - The configuration options for the Dynamic client
 * @param chainType - The type of chain to create the client for
 * @returns The created Dynamic client
 */
export const createDynamicClient = async (
  config: DynamicWalletConfig,
  chainType: "ethereum" | "solana",
) => {
  const clientConfig = {
    authToken: config.authToken,
    environmentId: config.environmentId,
  };

  try {
    let client;

    if (chainType === "ethereum") {
      // Dynamic import for ESM compatibility - only load EVM package when needed
      // Using type assertion due to dual-format package export issues with Node16 module resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evmModule = (await import("@dynamic-labs-wallet/node-evm")) as any;
      const { DynamicEvmWalletClient } = evmModule;
      client = new DynamicEvmWalletClient(clientConfig);
    } else {
      // Dynamic import for ESM compatibility - only load SVM package when needed
      // Using type assertion due to dual-format package export issues with Node16 module resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svmModule = (await import("@dynamic-labs-wallet/node-svm")) as any;
      const { DynamicSvmWalletClient } = svmModule;
      client = new DynamicSvmWalletClient(clientConfig);
    }

    await client.authenticateApiToken(config.authToken);
    const evmWallets = await client.getWallets();
    console.log("wallets:", evmWallets);

    return client;
  } catch (error) {
    console.error("[createDynamicClient] Error creating client:", error);
    throw error;
  }
};

/**
 * Create a Dynamic wallet
 *
 * @param config - The configuration options for the Dynamic wallet
 * @param chainType - The type of chain to create the wallet for
 * @returns The created Dynamic wallet and client
 */
export const createDynamicWallet = async (
  config: DynamicWalletConfig,
  chainType: "ethereum" | "solana",
): Promise<CreateDynamicWalletReturnType> => {
  const client = await createDynamicClient(config, chainType);
  console.log("[createDynamicWallet] Dynamic client created");

  let wallet: CreateDynamicWalletReturnType["wallet"];
  const wallets =
    chainType === "solana" ? await client.getSvmWallets() : await client.getEvmWallets();
  const existingWallet = wallets.find(wallet => wallet.accountAddress === config.accountAddress);
  if (existingWallet) {
    console.log(
      "[createDynamicWallet] Found existing wallet with address:",
      existingWallet.accountAddress,
    );
    wallet = existingWallet;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ThresholdSignatureScheme } = (await import("@dynamic-labs-wallet/node")) as any;
    console.log("[createDynamicWallet] Creating new wallet");
    console.log("[createDynamicWallet] createWalletAccount params:", {
      thresholdSignatureScheme:
        config.thresholdSignatureScheme || ThresholdSignatureScheme.TWO_OF_TWO,
      password: config.password ? "***" : undefined,
      networkId: config.networkId,
      chainType: chainType,
    });

    const thresholdSignatureScheme = await convertThresholdSignatureScheme(
      config.thresholdSignatureScheme,
    );
    try {
      const result = await client.createWalletAccount({
        thresholdSignatureScheme,
        password: config.password,
        backUpToClientShareService: true,
      });
      wallet = {
        accountAddress: result.accountAddress,
        rawPublicKey: result.rawPublicKey,
        externalServerKeyShares: result.externalServerKeyShares,
      };
    } catch (error) {
      throw new Error("Failed to create wallet: " + error);
    }
  }

  console.log("[createDynamicWallet] Wallet created/retrieved:", {
    accountAddress: wallet.accountAddress,
  });

  return { wallet, dynamic: client };
};
