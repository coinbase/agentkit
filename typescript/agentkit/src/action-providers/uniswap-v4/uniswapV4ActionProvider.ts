import { z } from "zod";
import { encodeFunctionData, parseUnits, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { GetV4QuoteSchema, SwapExactInputSchema, SwapExactOutputSchema } from "./schemas";
import {
  UNISWAP_V4_ADDRESSES,
  SUPPORTED_NETWORK_IDS,
  UNIVERSAL_ROUTER_ABI,
  QUOTER_ABI,
  ERC20_ABI,
  DEFAULT_DEADLINE_SECONDS,
  DEFAULT_FEE,
} from "./constants";
import {
  getTokenInfo,
  buildPoolKey,
  getSwapDirection,
  ensureApproval,
  formatTokenAmount,
  buildExactInputSwapData,
  buildExactOutputSwapData,
  applySlippage,
} from "./utils";

/**
 * Uniswap V4 Action Provider.
 *
 * Provides actions for token swapping on Uniswap V4 using the Universal Router.
 * Supports:
 * - Getting swap quotes (get_v4_quote)
 * - Executing exact input swaps (swap_exact_input)
 * - Executing exact output swaps (swap_exact_output)
 *
 * This provider interacts with the Universal Router for swaps and the Quoter
 * contract for price estimation. ERC20 approvals are handled automatically.
 */
export class UniswapV4ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the UniswapV4ActionProvider.
   */
  constructor() {
    super("uniswap_v4", []);
  }

  /**
   * Gets a swap quote for Uniswap V4.
   *
   * @param walletProvider - The wallet provider instance.
   * @param args - The input arguments for the action.
   * @returns A message containing the quote details.
   */
  @CreateAction({
    name: "get_v4_quote",
    description: `This tool gets a price quote for a token swap on Uniswap V4 without executing any transaction.
It takes the following inputs:
- tokenIn: The contract address of the input token (token to sell). Use 'native' for ETH.
- tokenOut: The contract address of the output token (token to buy).
- amountIn: The amount of input token in human-readable units (e.g., '1.5' for 1.5 tokens).
- slippageTolerance: Optional maximum acceptable slippage percentage (default: 0.5%).

Important notes:
- Always check token addresses before quoting. If unsure, ask the user.
- Common Base tokens: ETH=native, USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, WETH=0x4200000000000000000000000000000000000006.
- This action does not require any on-chain transactions or gas.
`,
    schema: GetV4QuoteSchema,
  })
  async getV4Quote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetV4QuoteSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const addresses = this.getAddresses(network);
      if (!addresses) {
        return this.unsupportedNetworkError(network);
      }

      // Resolve token information
      const tokenIn = await getTokenInfo(walletProvider, args.tokenIn);
      const tokenOut = await getTokenInfo(walletProvider, args.tokenOut);

      // Build the pool key
      const poolKey = buildPoolKey(tokenIn.address, tokenOut.address, DEFAULT_FEE);
      getSwapDirection(tokenIn.address, poolKey);
      const amountIn = parseUnits(args.amountIn, tokenIn.decimals);

      // Calculate slippage-adjusted minimum output
      const slippage = parseFloat(args.slippageTolerance || "0.5");

      try {
        // Call the quoter to get the expected output
        const [amountOut] = (await walletProvider.readContract({
          address: addresses.quoter,
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              fee: DEFAULT_FEE,
              amountIn,
              sqrtPriceLimitX96: 0n,
            },
          ],
        })) as [bigint, bigint, number, bigint];

        const amountOutMin = applySlippage(amountOut, slippage, true);

        return [
          `Quote for Uniswap V4 swap:`,
          `• Input: ${args.amountIn} ${tokenIn.symbol} (${tokenIn.address})`,
          `• Expected output: ${formatTokenAmount(amountOut, tokenOut.decimals)} ${tokenOut.symbol}`,
          `• Minimum output (${slippage}% slippage): ${formatTokenAmount(amountOutMin, tokenOut.decimals)} ${tokenOut.symbol}`,
          `• Fee tier: ${DEFAULT_FEE / 10000}%`,
          `• Network: ${network.networkId}`,
        ].join("\n");
      } catch (quoterError) {
        // Quoter might revert if no pool exists or liquidity is insufficient
        const errorMsg = quoterError instanceof Error ? quoterError.message : String(quoterError);
        if (errorMsg.includes(" revert") || errorMsg.includes("execution reverted")) {
          return [
            `No quote available for this swap pair.`,
            `Possible reasons:`,
            `- No V4 pool exists for ${tokenIn.symbol}/${tokenOut.symbol} with ${DEFAULT_FEE / 10000}% fee`,
            `- Insufficient liquidity in the pool`,
            `- Invalid token addresses`,
            ``,
            `Please verify the token addresses and ensure a pool exists with sufficient liquidity.`,
          ].join("\n");
        }
        throw quoterError;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `Error getting Uniswap V4 quote: ${errorMsg}`;
    }
  }

  /**
   * Executes a swap with exact input amount on Uniswap V4.
   *
   * @param walletProvider - The wallet provider instance.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap result.
   */
  @CreateAction({
    name: "swap_exact_input",
    description: `This tool executes a token swap on Uniswap V4 with an exact input amount.
The output received depends on the market price, protected by slippage tolerance.
It takes the following inputs:
- tokenIn: The contract address of the token to sell. Use 'native' for ETH.
- tokenOut: The contract address of the token to buy.
- amountIn: The exact amount to swap in human-readable units (e.g., '0.1').
- slippageTolerance: Optional maximum slippage percentage (default: 0.5%).
- recipient: Optional recipient address (defaults to wallet address).

Important notes:
- ERC20 approvals are handled automatically.
- Native ETH is supported directly (no WETH wrapping needed).
- Always call get_v4_quote first to show the user expected output.
- Confirm with the user before executing. Do not guess token addresses.
`,
    schema: SwapExactInputSchema,
  })
  async swapExactInput(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapExactInputSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const addresses = this.getAddresses(network);
      if (!addresses) {
        return this.unsupportedNetworkError(network);
      }

      // Resolve tokens
      const tokenIn = await getTokenInfo(walletProvider, args.tokenIn);
      const tokenOut = await getTokenInfo(walletProvider, args.tokenOut);
      const amountIn = parseUnits(args.amountIn, tokenIn.decimals);

      // Ensure sufficient balance
      if (tokenIn.isNative) {
        const balance = await walletProvider.getBalance();
        if (balance < amountIn) {
          const formattedBalance = formatUnits(balance, 18);
          return `Error: Insufficient ETH balance. Have: ${formattedBalance} ETH, Need: ${args.amountIn} ETH`;
        }
      } else {
        const balance = (await walletProvider.readContract({
          address: tokenIn.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletProvider.getAddress() as `0x${string}`],
        })) as bigint;
        if (balance < amountIn) {
          const formattedBalance = formatUnits(balance, tokenIn.decimals);
          return `Error: Insufficient ${tokenIn.symbol} balance. Have: ${formattedBalance} ${tokenIn.symbol}, Need: ${args.amountIn} ${tokenIn.symbol}`;
        }
      }

      // Ensure ERC20 approval for the Universal Router
      if (!tokenIn.isNative) {
        const approvalTx = await ensureApproval(
          walletProvider,
          tokenIn.address,
          addresses.universalRouter,
          amountIn,
        );
        if (approvalTx) {
          // Approval was sent, continue
        }
      }

      // Build pool key and determine direction
      const poolKey = buildPoolKey(tokenIn.address, tokenOut.address, DEFAULT_FEE);
      const zeroForOne = getSwapDirection(tokenIn.address, poolKey);

      // Calculate deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);

      // Get quote for minimum output amount
      let amountOutMin: bigint;
      try {
        const [amountOut] = (await walletProvider.readContract({
          address: addresses.quoter,
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              fee: DEFAULT_FEE,
              amountIn,
              sqrtPriceLimitX96: 0n,
            },
          ],
        })) as [bigint, bigint, number, bigint];
        const slippage = parseFloat(args.slippageTolerance || "0.5");
        amountOutMin = applySlippage(amountOut, slippage, true);
      } catch {
        return `Error: Could not get quote for swap. The pool may not exist or have insufficient liquidity.`;
      }

      // Build the swap transaction data
      const swapData = buildExactInputSwapData(
        poolKey,
        zeroForOne,
        amountIn,
        amountOutMin,
        deadline,
      );

      // Encode the execute() call
      const txData = encodeFunctionData({
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [swapData.commands, swapData.inputs, swapData.deadline],
      });

      // Send the swap transaction
      const hash = await walletProvider.sendTransaction({
        to: addresses.universalRouter,
        data: txData,
        ...(tokenIn.isNative ? { value: amountIn } : {}),
      });

      // Wait for confirmation
      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      if (receipt.status === "reverted") {
        return [
          `Swap failed: Transaction was reverted.`,
          `• Transaction: ${hash}`,
          `• Network: ${network.networkId}`,
        ].join("\n");
      }

      return [
        `Successfully swapped on Uniswap V4!`,
        `• Sold: ${args.amountIn} ${tokenIn.symbol}`,
        `• Minimum received: ${formatTokenAmount(amountOutMin, tokenOut.decimals)} ${tokenOut.symbol}`,
        `• Transaction: ${hash}`,
        `• Network: ${network.networkId}`,
      ].join("\n");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("insufficient funds")) {
        return `Error: Insufficient balance for swap. Check your ${args.tokenIn} balance.`;
      }
      if (msg.includes("Expired")) {
        return `Error: Transaction deadline expired. Try again with a longer deadline.`;
      }
      if (msg.includes("Too little received")) {
        return `Error: Price moved beyond your slippage tolerance. Try increasing the slippage tolerance or try again later.`;
      }
      return `Error executing Uniswap V4 swap: ${msg}`;
    }
  }

  /**
   * Executes a swap with exact output amount on Uniswap V4.
   *
   * @param walletProvider - The wallet provider instance.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap result.
   */
  @CreateAction({
    name: "swap_exact_output",
    description: `This tool executes a token swap on Uniswap V4 to receive an exact output amount.
You specify how much to receive; the input amount required is determined by the market price.
It takes the following inputs:
- tokenIn: The contract address of the token to sell. Use 'native' for ETH.
- tokenOut: The contract address of the token to buy.
- amountOut: The exact amount of output token desired.
- slippageTolerance: Optional maximum slippage percentage (default: 0.5%).
- recipient: Optional recipient address (defaults to wallet address).

Important notes:
- Use when the user says "I want exactly 100 USDC" rather than "sell 0.05 ETH".
- Always get a quote first and confirm with the user.
`,
    schema: SwapExactOutputSchema,
  })
  async swapExactOutput(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapExactOutputSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const addresses = this.getAddresses(network);
      if (!addresses) {
        return this.unsupportedNetworkError(network);
      }

      const tokenIn = await getTokenInfo(walletProvider, args.tokenIn);
      const tokenOut = await getTokenInfo(walletProvider, args.tokenOut);
      const amountOut = parseUnits(args.amountOut, tokenOut.decimals);

      // Build pool key and determine direction
      const poolKey = buildPoolKey(tokenIn.address, tokenOut.address, DEFAULT_FEE);
      const zeroForOne = getSwapDirection(tokenIn.address, poolKey);

      // Calculate deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);

      const slippage = parseFloat(args.slippageTolerance || "0.5");

      // CRITICAL FIX: Get quote for exact output to determine required input amount
      let amountInExpected: bigint;
      try {
        const [amountIn] = (await walletProvider.readContract({
          address: addresses.quoter,
          abi: QUOTER_ABI,
          functionName: "quoteExactOutputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              fee: DEFAULT_FEE,
              amountOut,
              sqrtPriceLimitX96: 0n,
            },
          ],
        })) as [bigint, bigint, number, bigint];
        amountInExpected = amountIn;
      } catch {
        return `Error: Could not get quote for swap. The pool may not exist or have insufficient liquidity.`;
      }

      // Calculate maximum input with slippage tolerance
      const maxInputAmount = applySlippage(amountInExpected, slippage, false);

      // CRITICAL FIX: Check balance before proceeding
      if (tokenIn.isNative) {
        const balance = await walletProvider.getBalance();
        if (balance < maxInputAmount) {
          const formattedBalance = formatUnits(balance, 18);
          const formattedNeeded = formatUnits(maxInputAmount, 18);
          return `Error: Insufficient ETH balance. Have: ${formattedBalance} ETH, Need: ~${formattedNeeded} ETH (including ${slippage}% slippage buffer)`;
        }
      } else {
        const balance = (await walletProvider.readContract({
          address: tokenIn.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletProvider.getAddress() as `0x${string}`],
        })) as bigint;
        if (balance < maxInputAmount) {
          const formattedBalance = formatUnits(balance, tokenIn.decimals);
          const formattedNeeded = formatUnits(maxInputAmount, tokenIn.decimals);
          return `Error: Insufficient ${tokenIn.symbol} balance. Have: ${formattedBalance} ${tokenIn.symbol}, Need: ~${formattedNeeded} ${tokenIn.symbol} (including ${slippage}% slippage buffer)`;
        }
      }

      // CRITICAL FIX: Only approve the maxInputAmount, not a hardcoded 1M tokens
      if (!tokenIn.isNative) {
        const approvalTx = await ensureApproval(
          walletProvider,
          tokenIn.address,
          addresses.universalRouter,
          maxInputAmount,
        );
        if (approvalTx) {
          // Approval was sent, continue
        }
      }

      // Build the swap transaction data with proper maxInputAmount
      const swapData = buildExactOutputSwapData(
        poolKey,
        zeroForOne,
        amountOut,
        maxInputAmount,
        deadline,
      );

      // Encode the execute() call
      const txData = encodeFunctionData({
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [swapData.commands, swapData.inputs, swapData.deadline],
      });

      // Send the swap transaction with proper ETH value
      const hash = await walletProvider.sendTransaction({
        to: addresses.universalRouter,
        data: txData,
        ...(tokenIn.isNative ? { value: maxInputAmount } : {}),
      });

      // Wait for confirmation
      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      if (receipt.status === "reverted") {
        return [
          `Swap failed: Transaction was reverted.`,
          `• Transaction: ${hash}`,
          `• Network: ${network.networkId}`,
        ].join("\n");
      }

      return [
        `Successfully swapped on Uniswap V4!`,
        `• Received: ${args.amountOut} ${tokenOut.symbol} (exact)`,
        `• Maximum spent: ~${formatTokenAmount(maxInputAmount, tokenIn.decimals)} ${tokenIn.symbol}`,
        `• Transaction: ${hash}`,
        `• Network: ${network.networkId}`,
      ].join("\n");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("insufficient funds")) {
        return `Error: Insufficient balance for swap. Check your token balance.`;
      }
      if (msg.includes("Expired")) {
        return `Error: Transaction deadline expired. Try again with a longer deadline.`;
      }
      if (msg.includes("Too much requested")) {
        return `Error: Price moved beyond your slippage tolerance. Try increasing the slippage tolerance or try again later.`;
      }
      return `Error executing Uniswap V4 exact output swap: ${msg}`;
    }
  }

  /**
   * Check if this provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is supported, false otherwise.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    network.networkId != null &&
    SUPPORTED_NETWORK_IDS.includes(network.networkId);

  /**
   * Get contract addresses for the current network, or null if unsupported.
   *
   * @param network - The network to get addresses for.
   * @returns The Uniswap V4 contract addresses or null if unsupported.
   */
  private getAddresses(network: Network) {
    const id = network.networkId;
    return id ? UNISWAP_V4_ADDRESSES[id] ?? null : null;
  }

  /**
   * Standard error message for unsupported networks.
   *
   * @param network - The network that is unsupported.
   * @returns An error message string.
   */
  private unsupportedNetworkError(network: Network): string {
    return `Error: Uniswap V4 is not available on ${network.networkId ?? "unknown"}. Supported networks: ${SUPPORTED_NETWORK_IDS.join(", ")}.`;
  }
}

/**
 * Factory function for creating the Uniswap V4 action provider.
 *
 * @returns A new instance of UniswapV4ActionProvider.
 */
export const uniswapV4ActionProvider = () => new UniswapV4ActionProvider();
