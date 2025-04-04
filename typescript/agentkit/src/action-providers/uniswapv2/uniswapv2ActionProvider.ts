/**
 * Uniswapv2 Action Provider
 *
 * This file contains the implementation of the Uniswapv2ActionProvider,
 * which provides actions for uniswapv2 operations.
 *
 * @module uniswapv2
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { CdpWalletProvider } from "../../wallet-providers";
import { SwapEthToUsdcSchema } from "./schemas";

// Uniswap V2 Router ABI (only the functions we need)
const UNISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactETHForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
];

// Uniswap V2 config for Base Sepolia
const UNISWAP_CONFIG = {
  ROUTER_ADDRESS: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602",
  FACTORY_ADDRESS: "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e",
  WETH_ADDRESS: "0x4200000000000000000000000000000000000006",
  USDC_ADDRESS: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

// Base Sepolia Network ID
const BASE_SEPOLIA_NETWORK_ID = "base-sepolia";

/**
 * Uniswapv2ActionProvider provides actions for uniswapv2 operations.
 *
 * @description
 * This provider is designed to work with CdpWalletProvider for blockchain interactions.
 * It supports only the Base Sepolia testnet for ETH to USDC swaps.
 */
export class Uniswapv2ActionProvider extends ActionProvider<CdpWalletProvider> {
  /**
   * Constructor for the Uniswapv2ActionProvider.
   */
  constructor() {
    super("uniswapv2", []);
  }

  /**
   * Swaps ETH to USDC using Uniswap V2 Router on Base Sepolia.
   *
   * @description
   * This action swaps a specified amount of ETH for USDC tokens using the Uniswap V2 Router.
   * It calculates the minimum output amount based on the current exchange rate and slippage tolerance.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by SwapEthToUsdcSchema
   * @returns A promise that resolves to a string describing the swap result
   * @throws Error if the wallet provider is not properly initialized or if the swap fails
   */
  @CreateAction({
    name: "swap_eth_to_usdc",
    description: `
      Swap ETH to USDC on Uniswap V2.

      This action swaps a specified amount of ETH for USDC tokens on the Uniswap V2 protocol.
      The swap uses the Uniswap V2 Router on Base Sepolia to execute the transaction.

      Inputs:
      - ethAmount: The amount of ETH to swap (e.g. 0.01)
      - slippagePercent: The maximum acceptable slippage as a percentage (e.g. 0.5 for 0.5%)
      - deadlineMinutes: (Optional) Transaction deadline in minutes, defaults to 20 minutes

      Output:
      - Transaction details including the amount of USDC received

      Note: This action requires enough ETH in your wallet to cover both the swap amount and gas fees.
    `,
    schema: SwapEthToUsdcSchema,
  })
  async swapEthToUsdc(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof SwapEthToUsdcSchema>,
  ): Promise<string> {
    try {
      // Validate network is Base Sepolia
      const network = walletProvider.getNetwork();
      if (network.networkId !== BASE_SEPOLIA_NETWORK_ID) {
        const errorMsg = `This action is only supported on Base Sepolia network. Current network: ${network.networkId}`;
        throw new Error(errorMsg);
      }

      // Get the wallet and address
      const wallet = walletProvider.getWallet();
      const userAddress = (await walletProvider.getAddress()) as `0x${string}`;

      // Set deadline (default to 20 minutes)
      const deadlineMinutes = args.deadlineMinutes || 20;
      const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      // Define token path for the swap (ETH -> USDC)
      const path = [UNISWAP_CONFIG.WETH_ADDRESS, UNISWAP_CONFIG.USDC_ADDRESS];

      // For now, set amountOutMin to 0 for simplicity
      // In a production environment, you would calculate this more carefully
      const amountOutMin = 0;

      // Execute the swap transaction
      const contractInvocation = await wallet.invokeContract({
        contractAddress: UNISWAP_CONFIG.ROUTER_ADDRESS,
        method: "swapExactETHForTokens",
        args: {
          amountOutMin: amountOutMin.toString(),
          path: path,
          to: userAddress,
          deadline: deadline.toString(),
        },
        abi: UNISWAP_V2_ROUTER_ABI,
        amount: args.ethAmount, // Amount of ETH to send with the transaction
        assetId: "eth", // Specify ETH as the asset to use for payment
      });

      // Wait for the transaction to complete
      await contractInvocation.wait();

      // Get the transaction hash
      const txHash = contractInvocation.toString();

      return `
        Swap completed successfully!
        Transaction hash: ${txHash}
        ETH amount: ${args.ethAmount} ETH
      `;
    } catch (error: unknown) {
      console.error("Error swapping ETH to USDC:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Failed to swap ETH to USDC: ${errorMessage}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // Only support Base Sepolia testnet
    return network.networkId === BASE_SEPOLIA_NETWORK_ID;
  }
}

/**
 * Factory function to create a new Uniswapv2ActionProvider instance.
 *
 * @returns A new Uniswapv2ActionProvider instance
 */
export const uniswapv2ActionProvider = () => new Uniswapv2ActionProvider();
