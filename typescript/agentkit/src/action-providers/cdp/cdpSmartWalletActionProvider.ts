import { SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { z } from "zod";
import { CdpSmartWalletProvider } from "../../wallet-providers/cdpSmartWalletProvider";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { UseSpendPermissionSchema, ListSpendPermissionsSchema, SwapSchema } from "./schemas";
import { listSpendPermissionsForSpender, findLatestSpendPermission } from "./spendPermissionUtils";
import { getTokenDetails, PERMIT2_ADDRESS, retryWithExponentialBackoff } from "./swapUtils";
import { Hex, formatUnits, parseUnits, maxUint256, encodeFunctionData, erc20Abi } from "viem";

import type { Network } from "../../network";
import type { Address } from "viem";

/**
 * CdpSmartWalletActionProvider is an action provider for CDP Smart Wallet specific actions.
 *
 * This provider is scoped specifically to CdpSmartWalletProvider and provides actions
 * that are optimized for smart wallet functionality.
 */
export class CdpSmartWalletActionProvider extends ActionProvider<CdpSmartWalletProvider> {
  /**
   * Constructor for the CdpSmartWalletActionProvider class.
   */
  constructor() {
    super("cdp_smart_wallet", []);
  }

  /**
   * Lists spend permissions for a smart account.
   *
   * @param walletProvider - The smart wallet provider to use for listing permissions.
   * @param args - The input arguments for listing spend permissions.
   * @returns A list of spend permissions available to the current wallet.
   */
  @CreateAction({
    name: "list_spend_permissions",
    description: `This tool lists spend permissions that have been granted to the current smart wallet by another smart account.
It takes a smart account address and returns spend permissions where the current smart wallet is the spender.
This is useful to see what spending allowances have been granted before using them.
This action is specifically designed for smart wallets.`,
    schema: ListSpendPermissionsSchema,
  })
  async listSpendPermissions(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof ListSpendPermissionsSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();

    if (network.protocolFamily === "evm") {
      const spenderAddress = walletProvider.getAddress();
      return await listSpendPermissionsForSpender(
        walletProvider.getClient(),
        args.smartAccountAddress as Address,
        spenderAddress as Address,
      );
    } else {
      return "Spend permissions are currently only supported on EVM networks.";
    }
  }

  /**
   * Uses a spend permission to transfer tokens from a smart account to the current smart wallet.
   *
   * @param walletProvider - The smart wallet provider to use for the spend operation.
   * @param args - The input arguments for using the spend permission.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "use_spend_permission",
    description: `This tool uses a spend permission to spend tokens on behalf of a smart account that the current smart wallet has permission to spend.
It automatically finds the latest valid spend permission granted by the smart account to the current smart wallet and uses it to spend the specified amount.
The smart account must have previously granted a spend permission to the current smart wallet using createSpendPermission.
This action is specifically designed for smart wallets and uses the smart account directly for optimal performance.`,
    schema: UseSpendPermissionSchema,
  })
  async useSpendPermission(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof UseSpendPermissionSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const cdpNetwork = walletProvider.getCdpSdkNetwork();

    if (network.protocolFamily === "evm") {
      try {
        const permission = await findLatestSpendPermission(
          walletProvider.getClient(),
          args.smartAccountAddress as Address,
          walletProvider.getAddress() as Address,
        );

        const spendResult = await walletProvider.smartAccount.useSpendPermission({
          spendPermission: permission,
          value: BigInt(args.value),
          network: cdpNetwork as SpendPermissionNetwork,
        });

        return `Successfully spent ${args.value} tokens using spend permission. Status: ${spendResult.status}`;
      } catch (error) {
        throw new Error(`Failed to use spend permission: ${error}`);
      }
    } else {
      throw new Error("Spend permissions are currently only supported on EVM networks.");
    }
  }

  /**
   * Gets a price quote for swapping tokens using the CDP Swap API.
   *
   * @param walletProvider - The smart wallet provider to get the quote for.
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
- Use fromAmount units exactly as provided, do not convert to wei or any other units
- Never assume token or address, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool if available to get the token address first
`,
    schema: SwapSchema,
  })
  async getSwapPrice(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof SwapSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;

    // Check if the network is supported
    if (networkId !== "base-mainnet" && networkId !== "base-sepolia") {
      return JSON.stringify({
        success: false,
        error: "CDP Swap API for smart wallets is currently only supported on Base networks.",
      });
    }

    try {
      const cdpNetwork = walletProvider.getCdpSdkNetwork();
      // Get token details
      const { fromTokenDecimals, toTokenDecimals, fromTokenName, toTokenName } =
        await getTokenDetails(walletProvider, args.fromToken, args.toToken);

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
   * @param walletProvider - The smart wallet provider to perform the swap with.
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
- Use fromAmount units exactly as provided, do not convert to wei or any other units
- Never assume token or address, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool if available to get the token address first
`,
    schema: SwapSchema,
  })
  async swap(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof SwapSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;

    // Check if the network is supported
    if (networkId !== "base-mainnet" && networkId !== "base-sepolia") {
      return JSON.stringify({
        success: false,
        error: "CDP Swap API for smart wallets is currently only supported on Base networks.",
      });
    }

    // Check if the owner account is a CDP server account
    if (walletProvider.ownerAccount.type === "local") {
      throw new Error("Smart wallet owner account is not a CDP server account.");
    }

    try {
      const cdpNetwork = walletProvider.getCdpSdkNetwork();

      // Get token details
      const { fromTokenDecimals, fromTokenName, toTokenName, toTokenDecimals } =
        await getTokenDetails(walletProvider, args.fromToken, args.toToken);

      // Estimate swap price first to check liquidity, token balance and permit2 approval status
      const swapPrice = await walletProvider.getClient().evm.getSwapPrice({
        fromToken: args.fromToken as Hex,
        toToken: args.toToken as Hex,
        fromAmount: parseUnits(args.fromAmount, fromTokenDecimals),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network: cdpNetwork as any,
        taker: walletProvider.smartAccount.address as Hex,
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
          approvalTxHash = await walletProvider.sendTransaction({
            to: args.fromToken as Hex,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [PERMIT2_ADDRESS, maxUint256],
            }),
          });

          const receipt = await walletProvider.waitForTransactionReceipt(approvalTxHash);
          if (receipt.status !== "complete") {
            return JSON.stringify({
              success: false,
              error: `Approval transaction failed`,
            });
          }
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: `Error approving token: ${error}`,
          });
        }
      }

      // Execute swap using the all-in-one pattern with retry logic
      const swapResult = await retryWithExponentialBackoff(
        async () => {
          return (await walletProvider.smartAccount.swap({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            network: cdpNetwork as any,
            fromToken: args.fromToken as Hex,
            toToken: args.toToken as Hex,
            fromAmount: parseUnits(args.fromAmount, fromTokenDecimals),
            slippageBps: args.slippageBps,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paymasterUrl: walletProvider.getPaymasterUrl(),
            signerAddress: walletProvider.ownerAccount.address as Hex,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          })) as any;
        },
        3,
        5000,
      ); // Max 3 retries with 5s base delay

      // Check if swap was successful
      const swapReceipt = await walletProvider.waitForTransactionReceipt(swapResult.userOpHash);
      if (swapReceipt.status !== "complete") {
        return JSON.stringify({
          success: false,
          error: `Swap transaction failed`,
        });
      }

      // Format the successful response
      const formattedResponse = {
        success: true,
        ...(approvalTxHash ? { approvalTxHash } : {}),
        transactionHash: swapResult.userOpHash,
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
   * Checks if the smart wallet action provider supports the given network.
   *
   * @param _  - The network to check.
   * @returns True if the smart wallet action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network): boolean => {
    return true;
  };
}

export const cdpSmartWalletActionProvider = () => new CdpSmartWalletActionProvider();
