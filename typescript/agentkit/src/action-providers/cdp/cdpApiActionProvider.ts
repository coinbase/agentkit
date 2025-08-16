import { z } from "zod";
import { Network } from "../../network";
import { CdpSmartWalletProvider, EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { isWalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { RequestFaucetFundsV2Schema, SwapSchema } from "./schemas";
import { getTokenDetails } from "./utils";
import { Hex, formatUnits, parseUnits, maxUint256, encodeFunctionData, erc20Abi } from "viem";

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
   * Gets a price quote for swapping tokens using the CDP Swap API.
   *
   * @param walletProvider - The wallet provider to get the quote for.
   * @param args - The input arguments for the swap price action.
   * @returns A JSON string with detailed swap price quote information.
   */
  @CreateAction({
    name: "get_swap_price",
    description: `
This tool fetches a price quote for swapping (trading) between two tokens using the CDP Swap API but does not execute a swap.
It takes the following inputs:
- fromToken: The contract address of the token to sell
- toToken: The contract address of the token to buy
- fromAmount: The amount of fromToken to swap in whole units (e.g. 1 ETH or 10.5 USDC)
- slippageBps: (Optional) Maximum allowed slippage in basis points (100 = 1%)
Important notes:
- The contract address for native ETH is "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
- Use fromAmount units exactly as provided, do not convert to wei or any other units.
`,
    schema: SwapSchema,
  })
  async getSwapPrice(
    walletProvider: WalletProvider,
    args: z.infer<typeof SwapSchema>,
  ): Promise<string> {
    // Get CDP SDK network
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;
    const cdpNetwork = this.#getCdpSdkNetwork(networkId);

    // Sanity checks
    if (!isWalletProviderWithClient(walletProvider))
      return JSON.stringify({
        success: false,
        error: "Wallet provider is not a CDP Wallet Provider.",
      });

    if (network.protocolFamily !== "evm")
      return JSON.stringify({
        success: false,
        error: "CDP Swap API is currently only supported on EVM networks.",
      });

    if (networkId !== "base-mainnet" && networkId !== "ethereum-mainnet")
      return JSON.stringify({
        success: false,
        error: "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'.",
      });

    try {
      // Get token details
      const { fromTokenDecimals, toTokenDecimals, fromTokenName, toTokenName } =
        await getTokenDetails(
          walletProvider as unknown as EvmWalletProvider,
          args.fromToken,
          args.toToken,
        );

      // Get swap price quote
      const swapPrice = (await walletProvider.getClient().evm.getSwapPrice({
        fromToken: args.fromToken as Hex,
        toToken: args.toToken as Hex,
        fromAmount: parseUnits(args.fromAmount, fromTokenDecimals),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network: cdpNetwork as any,
        taker: walletProvider.getAddress() as Hex,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any;

      const formattedResponse = {
        success: true,
        fromAmount: args.fromAmount,
        fromTokenName: fromTokenName,
        fromToken: args.fromToken,
        toAmount: formatUnits(swapPrice.toAmount, toTokenDecimals),
        minToAmount: formatUnits(swapPrice.minToAmount, toTokenDecimals),
        toTokenName: toTokenName,
        toToken: args.toToken,
        slippageBps: args.slippageBps,
        liquidityAvailable: swapPrice.liquidityAvailable,
        balanceEnough: swapPrice.issues.balance === undefined,
        priceOfBuyTokenInSellToken: (
          Number(args.fromAmount) / Number(formatUnits(swapPrice.toAmount, toTokenDecimals))
        ).toString(),
        priceOfSellTokenInBuyToken: (
          Number(formatUnits(swapPrice.toAmount, toTokenDecimals)) / Number(args.fromAmount)
        ).toString(),
      };

      return JSON.stringify(formattedResponse);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error fetching swap price: ${error}`,
      });
    }
  }

  /**
   * Swaps tokens using the CDP client.
   *
   * @param walletProvider - The wallet provider to perform the swap with.
   * @param args - The input arguments for the swap action.
   * @returns A JSON string with detailed swap execution information.
   */
  @CreateAction({
    name: "swap",
    description: `
This tool executes a token swap (trade) using the CDP Swap API.
It takes the following inputs:
- fromToken: The contract address of the token to sell
- toToken: The contract address of the token to buy
- fromAmount: The amount of fromToken to swap in whole units (e.g. 1 ETH or 10.5 USDC)
- slippageBps: (Optional) Maximum allowed slippage in basis points (100 = 1%)
Important notes:
- The contract address for native ETH is "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
- If needed, it will automatically approve the permit2 contract to spend the fromToken
- Use fromAmount units exactly as provided, do not convert to wei or any other units.
`,
    schema: SwapSchema,
  })
  async swap(walletProvider: EvmWalletProvider, args: z.infer<typeof SwapSchema>): Promise<string> {
    // Get CDP SDK network
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;
    const cdpNetwork = this.#getCdpSdkNetwork(networkId);

    // Sanity checks
    if (!isWalletProviderWithClient(walletProvider))
      return JSON.stringify({
        success: false,
        error: "Wallet provider is not a CDP Wallet Provider.",
      });

    if (network.protocolFamily !== "evm")
      return JSON.stringify({
        success: false,
        error: "CDP Swap API is currently only supported on EVM networks.",
      });

    if (networkId !== "base-mainnet" && networkId !== "ethereum-mainnet")
      return JSON.stringify({
        success: false,
        error: "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'.",
      });

    try {
      // Get token details
      const { fromTokenDecimals, fromTokenName, toTokenName, toTokenDecimals } =
        await getTokenDetails(
          walletProvider as unknown as EvmWalletProvider,
          args.fromToken,
          args.toToken,
        );

      // Get the account for the wallet address
      const isSmartWallet = walletProvider instanceof CdpSmartWalletProvider;
      const account = isSmartWallet
        ? walletProvider.smartAccount
        : await walletProvider.getClient().evm.getAccount({
            address: walletProvider.getAddress() as Hex,
          });

      // Estimate swap price first to check liquidity, token balance and permit2 approval status
      const swapPrice = await walletProvider.getClient().evm.getSwapPrice({
        fromToken: args.fromToken as Hex,
        toToken: args.toToken as Hex,
        fromAmount: parseUnits(args.fromAmount, fromTokenDecimals),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network: cdpNetwork as any,
        taker: account.address as Hex,
      });

      // Check if liquidity is available
      if (!swapPrice.liquidityAvailable) {
        return JSON.stringify({
          success: false,
          error: `No liquidity available to swap ${args.fromAmount} ${fromTokenName} (${args.fromToken}) to ${toTokenName} (${args.toToken})`,
        });
      }

      // Check if balance is enough
      if (swapPrice.issues.balance) {
        return JSON.stringify({
          success: false,
          error: `Balance is not enough to perform swap. Required: ${args.fromAmount} ${fromTokenName}, but only have ${formatUnits(
            swapPrice.issues.balance.currentBalance,
            fromTokenDecimals,
          )} ${fromTokenName} (${args.fromToken})`,
        });
      }

      // Check if allowance is enough
      let approvalTxHash: Hex | null = null;
      if (swapPrice.issues.allowance) {
        try {
          // Permit2 contract address
          const spender = swapPrice.issues.allowance.spender as Hex;

          approvalTxHash = await walletProvider.sendTransaction({
            to: args.fromToken as Hex,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [spender, maxUint256],
            }),
          });

          await walletProvider.waitForTransactionReceipt(approvalTxHash);
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: `Error approving token: ${error}`,
          });
        }
      }

      // Execute swap using the all-in-one pattern
      const swapResult = (await account.swap({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network: cdpNetwork as any,
        fromToken: args.fromToken as Hex,
        toToken: args.toToken as Hex,
        fromAmount: parseUnits(args.fromAmount, fromTokenDecimals),
        slippageBps: args.slippageBps,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paymasterUrl: isSmartWallet ? walletProvider.getPaymasterUrl() : undefined,
        signerAddress: isSmartWallet
          ? (walletProvider.smartAccount.owners[0].address as Hex)
          : (account.address as Hex),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any;

      // Format the successful response
      const formattedResponse = {
        success: true,
        ...(approvalTxHash ? { approvalTxHash } : {}),
        transactionHash: swapResult,
        fromAmount: args.fromAmount,
        fromTokenName: fromTokenName,
        fromToken: args.fromToken,
        toAmount: formatUnits(swapPrice.toAmount, toTokenDecimals),
        minToAmount: formatUnits(swapPrice.minToAmount, toTokenDecimals),
        toTokenName: toTokenName,
        toToken: args.toToken,
        slippageBps: args.slippageBps,
        network: networkId,
      };

      return JSON.stringify(formattedResponse);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Swap failed: ${error}`,
      });
    }
  }

  /**
   * Checks if the CDP action provider supports the given network.
   *
   * NOTE: Network scoping is done at the action implementation level
   *
   * @param _ - The network to check.
   * @returns True if the CDP action provider supports the network, false otherwise.
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
