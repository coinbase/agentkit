import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { ViemWalletProvider } from "./viemWalletProvider";
import { createWalletClient, http, WalletClient } from "viem";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";

interface PrivyWalletConfig {
  appId: string;
  appSecret: string;
  walletId: string;
  networkId?: string;
  authorizationKey?: string;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 */
export class PrivyWalletProvider extends ViemWalletProvider {
  private constructor(walletClient: WalletClient) {
    super(walletClient);
  }

  public static async configureWithWallet(config: PrivyWalletConfig): Promise<PrivyWalletProvider> {
    const privy = new PrivyClient(config.appId, config.appSecret, {
      walletApi: config.authorizationKey
        ? {
            authorizationPrivateKey: config.authorizationKey,
          }
        : undefined,
    });

    // Get wallet details to get the address
    const wallet = await privy.walletApi.getWallet({ id: config.walletId });

    const account = await createViemAccount({
      walletId: config.walletId,
      address: wallet.address as `0x${string}`,
      privy,
    });

    const network = {
      protocolFamily: "evm" as const,
      networkId: config.networkId || "84532",
      chainId: "84532",
    };

    const chain = NETWORK_ID_TO_VIEM_CHAIN[network.networkId!];
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
    return new PrivyWalletProvider(walletClient);
  }

  getName(): string {
    return "privy_wallet_provider";
  }
}
