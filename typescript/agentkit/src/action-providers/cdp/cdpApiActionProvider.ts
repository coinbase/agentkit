import { z } from "zod";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { isWalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { RequestFaucetFundsV2Schema, SwapSchema } from "./schemas";

/**
 * CdpApiActionProvider is an action provider for CDP API.
 *
 * This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
 */
export class CdpApiActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the CdpApiActionProvider class.
   */
  constructor() {
    super("cdp_api", []);
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
   * Swaps tokens using the CDP client.
   *
   * @param walletProvider - The wallet provider to perform the swap with.
   * @param args - The input arguments for the swap action.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "swap",
    description: `This tool swaps tokens using the CDP API. It takes the wallet, from asset ID, to asset ID, and amount as input.
Swaps are currently supported on EVM networks like Base and Ethereum.
Example usage:
- Swap 0.1 ETH to USDC: { fromAssetId: "eth", toAssetId: "usdc", amount: "0.1" }
- Swap 100 USDC to ETH: { fromAssetId: "usdc", toAssetId: "eth", amount: "100" }`,
    schema: SwapSchema,
  })
  async swap(walletProvider: WalletProvider, args: z.infer<typeof SwapSchema>): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;

    if (isWalletProviderWithClient(walletProvider)) {
      if (network.protocolFamily === "evm") {
        try {
          const cdpNetwork = this.#getCdpSdkNetwork(networkId);

          // Get the account for the wallet address
          const account = await walletProvider.getClient().evm.getAccount({
            address: walletProvider.getAddress() as `0x${string}`,
          });

          // Execute swap using the all-in-one pattern
          const swapResult = await account.swap({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            network: cdpNetwork as any,
            from: args.fromAssetId,
            to: args.toAssetId,
            amount: args.amount,
            slippageBps: 100, // 1% slippage tolerance
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          return `Successfully swapped ${args.amount} ${args.fromAssetId.toUpperCase()} to ${args.toAssetId.toUpperCase()}. Transaction hash: ${swapResult.transactionHash}`;
        } catch (error) {
          throw new Error(`Swap failed: ${error}`);
        }
      } else {
        throw new Error("Swap is currently only supported on EVM networks.");
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

  /**
   * Converts the internal network ID to the format expected by the CDP SDK.
   *
   * @param networkId - The network ID to convert
   * @returns The network ID in CDP SDK format
   * @throws Error if the network is not supported
   */
  #getCdpSdkNetwork(networkId: string): string {
    switch (networkId) {
      case "base-sepolia":
        return "base-sepolia";
      case "base-mainnet":
        return "base";
      case "ethereum-sepolia":
        return "ethereum-sepolia";
      case "ethereum-mainnet":
        return "ethereum";
      default:
        return networkId; // For other networks, use as-is
    }
  }
}

export const cdpApiActionProvider = () => new CdpApiActionProvider();
