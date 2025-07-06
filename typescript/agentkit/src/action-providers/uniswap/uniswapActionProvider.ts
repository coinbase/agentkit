import { z } from "zod";
import { encodeFunctionData, parseUnits, formatUnits, getAddress } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { SwapSchema, QuoteSchema } from "./schemas";
import {
  UNISWAP_ADDRESSES,
  UNISWAP_QUOTER_ABI,
  UNISWAP_ROUTER_ABI,
  ERC20_ABI,
} from "./constants";

/**
 * Uniswap V3 Action Provider for Base network
 * Enables token swaps and quotes on Uniswap V3 DEX
 */
export class UniswapActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the UniswapActionProvider.
   */
  constructor() {
    super("uniswap", []);
  }

  /**
   * Get a quote for a token swap on Uniswap V3.
   *
   * @param walletProvider - The wallet provider to use for contract calls.
   * @param args - The input arguments for getting a quote.
   * @returns A message containing the quote details.
   */
  @CreateAction({
    name: "get_quote",
    description: `
    Get a quote for swapping tokens on Uniswap V3. This will show you how many tokens you would receive
    for a given input amount without executing the swap.
    
    Supports all ERC20 tokens available on Uniswap V3 pools on Base network.
    `,
    schema: QuoteSchema,
  })
  async getQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof QuoteSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const addresses = UNISWAP_ADDRESSES[network.networkId!];
      
      if (!addresses) {
        return `Error: Uniswap not supported on network ${network.networkId}`;
      }

      // Get token decimals for proper amount conversion
      const [tokenInDecimals, tokenOutDecimals, tokenInSymbol, tokenOutSymbol] = await Promise.all([
        walletProvider.readContract({
          address: getAddress(args.tokenIn),
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenOut),
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenIn),
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenOut),
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        }),
      ]);

      // Convert amount to wei using token decimals
      const amountIn = parseUnits(args.amount, tokenInDecimals as number);

      // Get quote from Uniswap
      const quoteResult = await walletProvider.readContract({
        address: getAddress(addresses.Quoter),
        abi: UNISWAP_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: getAddress(args.tokenIn),
            tokenOut: getAddress(args.tokenOut),
            amountIn,
            fee: args.fee,
            sqrtPriceLimitX96: 0,
          },
        ],
      });

      const amountOut = (quoteResult as any)[0] as bigint;
      const formattedAmountOut = formatUnits(amountOut, tokenOutDecimals as number);

      return `Quote: ${args.amount} ${tokenInSymbol} → ${formattedAmountOut} ${tokenOutSymbol} (Fee: ${args.fee / 10000}%)`;
    } catch (error) {
      return `Error getting quote: ${error}`;
    }
  }

  /**
   * Swap tokens on Uniswap V3.
   *
   * @param walletProvider - The wallet provider to execute the swap.
   * @param args - The input arguments for the swap.
   * @returns A message containing the swap transaction details.
   */
  @CreateAction({
    name: "swap",
    description: `
    Swap tokens on Uniswap V3. This will execute a token swap on Base network.
    
    Important notes:
    - Ensure you have sufficient balance of the input token
    - The swap will automatically handle token approvals if needed
    - Uses exact input swap (you specify exact amount in, get variable amount out)
    - Supports slippage protection
    
    For ETH swaps, use the WETH token address: 0x4200000000000000000000000000000000000006
    `,
    schema: SwapSchema,
  })
  async swap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const addresses = UNISWAP_ADDRESSES[network.networkId!];
      
      if (!addresses) {
        return `Error: Uniswap not supported on network ${network.networkId}`;
      }

      const walletAddress = walletProvider.getAddress();

      // Get token metadata
      const [tokenInDecimals, tokenOutDecimals, tokenInSymbol, tokenOutSymbol] = await Promise.all([
        walletProvider.readContract({
          address: getAddress(args.tokenIn),
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenOut),
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenIn),
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        }),
        walletProvider.readContract({
          address: getAddress(args.tokenOut),
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        }),
      ]);

      const amountIn = parseUnits(args.amount, tokenInDecimals as number);

      // Check if approval is needed (skip for ETH/WETH)
      const isWETH = getAddress(args.tokenIn).toLowerCase() === addresses.WETH.toLowerCase();
      
      if (!isWETH) {
        const allowance = await walletProvider.readContract({
          address: getAddress(args.tokenIn),
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [walletAddress, getAddress(addresses.SwapRouter02)],
        }) as bigint;

        if (allowance < amountIn) {
          // Approve router to spend tokens
          const approveHash = await walletProvider.sendTransaction({
            to: getAddress(args.tokenIn),
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [getAddress(addresses.SwapRouter02), amountIn],
            }),
          });
          
          await walletProvider.waitForTransactionReceipt(approveHash);
        }
      }

      // Get quote for minimum amount out calculation
      const quoteResult = await walletProvider.readContract({
        address: getAddress(addresses.Quoter),
        abi: UNISWAP_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: getAddress(args.tokenIn),
            tokenOut: getAddress(args.tokenOut),
            amountIn,
            fee: args.fee,
            sqrtPriceLimitX96: 0,
          },
        ],
      });

      const expectedAmountOut = (quoteResult as any)[0] as bigint;
      const slippageBps = Math.floor(args.slippageTolerance * 100); // Convert % to basis points
      const amountOutMinimum = (expectedAmountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

      // Execute the swap
      const swapHash = await walletProvider.sendTransaction({
        to: getAddress(addresses.SwapRouter02),
        data: encodeFunctionData({
          abi: UNISWAP_ROUTER_ABI,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: getAddress(args.tokenIn),
              tokenOut: getAddress(args.tokenOut),
              fee: args.fee,
              recipient: walletAddress,
              amountIn,
              amountOutMinimum,
              sqrtPriceLimitX96: 0,
            },
          ],
        }),
        value: isWETH ? amountIn : 0n,
      });

      await walletProvider.waitForTransactionReceipt(swapHash);

      const expectedAmountOutFormatted = formatUnits(expectedAmountOut, tokenOutDecimals as number);
      const minAmountOutFormatted = formatUnits(amountOutMinimum, tokenOutDecimals as number);

      return `Successfully swapped ${args.amount} ${tokenInSymbol} for ~${expectedAmountOutFormatted} ${tokenOutSymbol}\n` +
             `Minimum received: ${minAmountOutFormatted} ${tokenOutSymbol} (${args.slippageTolerance}% slippage)\n` +
             `Transaction hash: ${swapHash}`;

    } catch (error) {
      return `Error executing swap: ${error}`;
    }
  }

  /**
   * Checks if the Uniswap action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet or sepolia, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const uniswapActionProvider = () => new UniswapActionProvider(); 