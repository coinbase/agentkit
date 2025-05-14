import { z } from "zod";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { isWalletProviderWithClient } from "../../wallet-providers/cdpV2Shared";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { RequestFaucetFundsV2Schema } from "./schemas";

/**
 * CdpApiActionProvider is an action provider for CDP API.
 *
 * This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
 */
export class CdpApiV2ActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the CdpApiActionProvider class.
   */
  constructor() {
    super("cdp_api_v2", []);
  }

  /**
   * Requests test tokens from the faucet for the default address in the wallet.
   *
   * @param walletProvider - The wallet provider to request funds from.
   * @param args - The input arguments for the action.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "request_faucet_funds",
    description: `This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia', user can only provide asset ID 'eth', 'usdc', 'eurc' or 'cbbtc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol' or 'usdc', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.`,
    schema: RequestFaucetFundsV2Schema,
  })
  async faucet(
    walletProvider: WalletProvider,
    args: z.infer<typeof RequestFaucetFundsV2Schema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;

    if (isWalletProviderWithClient(walletProvider)) {
      if (network.protocolFamily === "evm") {
        if (networkId !== "base-sepolia" && networkId !== "ethereum-sepolia") {
          throw new Error(
            "Faucet is only supported on 'base-sepolia' or 'ethereum-sepolia' evm networks.",
          );
        }

        const faucetTx = await walletProvider.getClient().evm.requestFaucet({
          address: walletProvider.getAddress(),
          token: (args.assetId || "eth") as "eth" | "usdc" | "eurc" | "cbbtc",
          network: networkId,
        });

        return `Received ${
          args.assetId || "ETH"
        } from the faucet. Transaction hash: ${faucetTx.transactionHash}`;
      } else if (network.protocolFamily === "svm") {
        if (networkId !== "solana-devnet") {
          throw new Error("Faucet is only supported on 'solana-devnet' solana networks.");
        }

        const faucetTx = await walletProvider.getClient().solana.requestFaucet({
          address: walletProvider.getAddress(),
          token: (args.assetId || "sol") as "sol" | "usdc",
        });

        return `Received ${
          args.assetId || "SOL"
        } from the faucet. Transaction signature hash: ${faucetTx.signature}`;
      } else {
        throw new Error("Faucet is only supported on Ethereum and Solana protocol families.");
      }
    } else {
      throw new Error("Wallet provider is not a CDP Wallet Provider.");
    }
  }

  /**
   * Checks if the Cdp action provider supports the given network.
   *
   * NOTE: Network scoping is done at the action implementation level
   *
   * @param _ - The network to check.
   * @returns True if the Cdp action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network) => true;
}

export const cdpApiV2ActionProvider = () => new CdpApiV2ActionProvider();
