import { z } from "zod";
import { isExtractorSupportedChainId, nativeAddress } from "sushi/config";
import { ViemWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { SushiQuoteSchema, SushiSwapSchema } from "./sushiRouterSchemas";
import { Network } from "../../network";
import { getSwap, SwapResponse } from "sushi";
import { RouteStatus } from "sushi/router";
import {
  Address,
  decodeEventLog,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseUnits,
  TransactionReceipt,
} from "viem";
import { EvmChain } from "sushi/chain";
import { routeProcessor5Abi_Route } from "./constants";
import { Native } from "sushi/currency";

/**
 * SushiRouterActionProvider is an action provider for Sushi.
 *
 * This provider is used for any action that uses the Sushi Router API.
 */
export class SushiRouterActionProvider extends ActionProvider<ViemWalletProvider> {
  /**
   * Constructor for the SushiRouterActionProvider class.
   */
  constructor() {
    super("sushi-router", []);
  }

  /**
   * Swaps a specified amount of a from token to a to token for the wallet.
   *
   * @param walletProvider - The wallet provider to swap the tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap details.
   */
  @CreateAction({
    name: "swap",
    description: `This tool will swap a specified amount of a 'from token' (erc20) to a 'to token' (erc20) for the wallet.
It takes the following inputs:
- The human-readable amount of the 'from token' to swap
- The from token address to trade
- The token address to receive from the swap
- The maximum slippage allowed for the swap, where 0 is 0% and 1 is 100%, the default is 0.005 (0.05%)

Important notes:
- The native asset (ie 'eth' on 'ethereum-mainnet') is represented by ${nativeAddress} (not the wrapped native asset!)
- Fetch a quote first before the swap action. Stop, ask the user if they want to proceed. If the user answers affirmatively, then swap
- If you are not absolutely sure about token addresses, either use an action to fetch the token address or ask the user
`,
    schema: SushiSwapSchema,
  })
  async swap(
    walletProvider: ViemWalletProvider,
    args: z.infer<typeof SushiSwapSchema>,
  ): Promise<string> {
    try {
      // Compatible chainId is expected since it should be pre-checked in supportsNetwork
      const chainId = Number((await walletProvider.getNetwork()).chainId);
      const chain = EvmChain.from(chainId)!;

      const decimalsIn = await fetchDecimals({ walletProvider, token: args.fromAssetAddress });

      if (!decimalsIn.success) {
        return decimalsIn.message;
      }

      const amountIn = parseUnits(args.amount, decimalsIn.decimals);

      // First fetch to see if the swap is even possible
      const firstSwap = await handleGetSwap({
        amount: amountIn,
        chainId,
        tokenIn: args.fromAssetAddress,
        tokenOut: args.toAssetAddress,
        maxSlippage: args.maxSlippage,
        recipient: walletProvider.getAddress() as Address,
      });

      if (firstSwap.swap.status !== RouteStatus.Success) {
        return firstSwap.message;
      }

      // Check if the wallet has enough balance to perform the swap
      const balance = await handleBalance({
        walletProvider,
        token: firstSwap.swap.tokenFrom,
        minAmount: amountIn,
      });

      if (!balance.success) {
        return balance.message;
      }

      const approval = await handleApproval({
        walletProvider,
        token: args.fromAssetAddress,
        to: firstSwap.swap.tx.to,
        amount: amountIn,
      });

      if (!approval.success) {
        return approval.message;
      }

      // Refetch in case the route changed during approval
      const secondSwap = await handleGetSwap({
        amount: amountIn,
        chainId,
        tokenIn: args.fromAssetAddress,
        tokenOut: args.toAssetAddress,
        maxSlippage: args.maxSlippage,
        recipient: walletProvider.getAddress() as Address,
      });

      if (secondSwap.swap.status !== RouteStatus.Success) {
        return secondSwap.message;
      }

      const swapHash = await walletProvider.sendTransaction(secondSwap.swap.tx);
      const swapReceipt: TransactionReceipt =
        await walletProvider.waitForTransactionReceipt(swapHash);

      if (swapReceipt.status === "reverted") {
        return `Swap failed: Transaction Reverted.\n - Transaction hash: ${swapHash}\n - Transaction link: ${chain.getTxUrl(swapHash)}`;
      }

      // Find the Route event log, which includes the actual amountOut
      const [routeLog] = swapReceipt.logs
        .filter(
          log =>
            encodeEventTopics({
              abi: routeProcessor5Abi_Route,
              eventName: "Route",
            })[0] === log.topics[0],
        )
        .map(log =>
          decodeEventLog({
            abi: routeProcessor5Abi_Route,
            data: log.data,
            topics: log.topics,
          }),
        );

      return `Swapped ${formatUnits(routeLog.args.amountIn, secondSwap.swap.tokenFrom.decimals)} of ${secondSwap.swap.tokenFrom.symbol} (${args.fromAssetAddress}) for ${formatUnits(routeLog.args.amountOut, secondSwap.swap.tokenTo.decimals)} of ${secondSwap.swap.tokenTo.symbol} (${args.toAssetAddress}) on ${chain.shortName}
 - Transaction hash: ${swapHash}
 - Transaction link: ${chain.getTxUrl(swapHash)}`;
    } catch (error) {
      return `Error swapping tokens: ${error}`;
    }
  }

  /**
   * Gets a quote for a specified amount of a from token to a to token
   *
   * @param walletProvider - The wallet provider to swap the tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the quote details.
   */
  @CreateAction({
    name: "quote",
    description: `This tool will fetch a quote for a specified amount of a 'from token' (erc20) to a 'to token' (erc20).
It takes the following inputs:
- The human-readable amount of the 'from token' to fetch a quote for
- The from token address to fetch a quote for
- The token address to receive from the quoted swap

Important notes:
- The native asset (ie 'eth' on 'ethereum-mainnet') is represented by ${nativeAddress} (not the wrapped native asset!)
- This action does not require any on-chain transactions or gas
- If you are not 100% certain about token addresses, use an action to fetch the token address first or ask the user
- NEVER assume that tokens have the same address on across networks (ie the address of 'usdc' on 'ethereum-mainnet' is different from 'usdc' on 'base-mainnet')
`,
    schema: SushiQuoteSchema,
  })
  async quote(
    walletProvider: ViemWalletProvider,
    args: z.infer<typeof SushiQuoteSchema>,
  ): Promise<string> {
    try {
      // Compatible chainId is expected since it should be pre-checked in supportsNetwork
      const chainId = Number((await walletProvider.getNetwork()).chainId);

      const decimalsIn = await fetchDecimals({ walletProvider, token: args.fromAssetAddress });

      if (!decimalsIn.success) {
        return decimalsIn.message;
      }

      const amountIn = parseUnits(args.amount, decimalsIn.decimals);

      const swap = await handleGetSwap({
        amount: amountIn,
        chainId,
        tokenIn: args.fromAssetAddress,
        tokenOut: args.toAssetAddress,
        maxSlippage: 0.999, // ~100%
        recipient: walletProvider.getAddress() as Address,
      });

      return swap.message;
    } catch (error) {
      return `Error quoting for tokens: ${error}`;
    }
  }

  /**
   * Custom action providers are supported on all networks
   *
   * @param network - The network to checkpointSaver
   * @returns True if the network is supported, false otherwise
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm" || !network.chainId) {
      return false;
    }

    return isExtractorSupportedChainId(Number(network.chainId));
  }
}

/**
 * Fetches the number of decimals for the token
 *
 * @param root0 - The input arguments for the action
 * @param root0.walletProvider - The wallet provider to fetch the decimals from
 * @param root0.token - The token address to fetch the decimals for
 *
 * @returns The number of decimals for the token
 */
async function fetchDecimals({
  walletProvider,
  token,
}: {
  walletProvider: ViemWalletProvider;
  token: Address;
}): Promise<{ success: true; decimals: number } | { success: false; message: string }> {
  const chainId = Number((await walletProvider.getNetwork()).chainId);
  if (!isExtractorSupportedChainId(chainId)) {
    return {
      success: false,
      message: `Unsupported chainId: ${chainId}`,
    };
  }

  if (token === nativeAddress) {
    return { success: true, decimals: Native.onChain(chainId).decimals };
  }

  const decimals = (await walletProvider.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
  } as const)) as number;

  return { success: true, decimals };
}

/**
 * Checks if the wallet has enough balance to perform the swap
 *
 * @param root0 - The input arguments for the action
 * @param root0.walletProvider - The wallet provider to fetch the balance from
 * @param root0.token - The token address to fetch the balance for
 * @param root0.token.address - The token address to fetch the balance for
 * @param root0.token.symbol - The token symbol to fetch the balance for
 * @param root0.token.decimals - The token decimals to fetch the balance for
 * @param root0.minAmount - The minimum amount to check for
 *
 * @returns The balance of the wallet
 */
async function handleBalance({
  walletProvider,
  token,
  minAmount,
}: {
  walletProvider: ViemWalletProvider;
  token: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  minAmount: bigint;
}): Promise<{ success: true } | { success: false; message: string }> {
  let balance: bigint;

  if (token.address.toLowerCase() === nativeAddress) {
    balance = await walletProvider.getBalance();
  } else {
    balance = (await walletProvider.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletProvider.getAddress() as Address],
    } as const)) as bigint;
  }

  if (balance < minAmount) {
    return {
      success: false,
      message: `Swap failed: Insufficient balance for ${token.symbol} (${token.address})
 - Balance: ${formatUnits(balance, token.decimals)}
 - Required: ${formatUnits(minAmount, token.decimals)}`,
    };
  }

  return {
    success: true,
  };
}

/**
 *
 * Wraps the getSwap function, providing messages for possible states
 *
 * @param root0 - The input arguments for the action
 * @param root0.amount - The amount to swap
 * @param root0.chainId - The chainId to swap on
 * @param root0.tokenIn - The input token address
 * @param root0.tokenOut - The output token address
 * @param root0.maxSlippage - The maximum slippage allowed
 * @param root0.recipient - The recipient of the swap
 *
 * @returns The result of the swap and a message
 */
async function handleGetSwap({
  amount,
  chainId,
  tokenIn,
  tokenOut,
  maxSlippage,
  recipient,
}: {
  amount: bigint;
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  maxSlippage: number;
  recipient: Address;
}): Promise<{ swap: SwapResponse<true>; message: string }> {
  if (!isExtractorSupportedChainId(chainId)) {
    return {
      swap: { status: RouteStatus.NoWay },
      message: `Unsupported chainId: ${chainId}`,
    };
  }

  const swap = await getSwap({
    amount,
    chainId,
    tokenIn,
    tokenOut,
    maxSlippage,
    includeTransaction: true,
    to: recipient,
  });

  const chain = EvmChain.from(chainId)!;

  if (swap.status === RouteStatus.NoWay) {
    return {
      swap,
      message: `No route found to swap ${amount} of ${tokenIn} for ${tokenOut} on ${chain.shortName}`,
    };
  }

  if (swap.status === RouteStatus.Partial) {
    return {
      swap,
      message: `Found a partial quote for ${swap.tokenFrom.symbol} -> ${swap.tokenTo.symbol}. Swapping the full amount is not possible.
 - AmountIn: ${formatUnits(BigInt(swap.amountIn), swap.tokenFrom.decimals)}
 - AmountOut: ${formatUnits(BigInt(swap.assumedAmountOut), swap.tokenTo.decimals)}`,
    };
  }

  return {
    swap,
    message: `Found a quote for ${swap.tokenFrom.symbol} (${swap.tokenFrom.address}) -> ${swap.tokenTo.symbol} (${swap.tokenTo.address})
 - AmountIn: ${formatUnits(BigInt(swap.amountIn), swap.tokenFrom.decimals)} ${swap.tokenFrom.symbol}
 - AmountOut: ${formatUnits(BigInt(swap.assumedAmountOut), swap.tokenTo.decimals)} ${swap.tokenTo.symbol}`,
  };
}

/**
 *
 * Handles the approval for the token
 *
 * @param root0 - The input arguments for the action
 * @param root0.walletProvider - The wallet provider to handle the approval with
 * @param root0.token - The token address to approve
 * @param root0.to - The address to approve the token to
 * @param root0.amount - The amount to approve
 *
 * @returns Either success: true on success or success: false with a message containing the reason for failure
 */
async function handleApproval({
  walletProvider,
  token,
  to,
  amount,
}: {
  walletProvider: ViemWalletProvider;
  token: Address;
  to: Address;
  amount: bigint;
}): Promise<{ success: true } | { success: false; message: string }> {
  // No need to approve if the token is the native token
  if (token.toLowerCase() === nativeAddress) {
    return { success: true };
  }

  // Check if the wallet already has enough allowance
  const allowance = (await walletProvider.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [walletProvider.getAddress() as Address, to],
  } as const)) as bigint;

  if (allowance >= amount) {
    return { success: true };
  }

  // Exact approval
  const approvalHash = await walletProvider.sendTransaction({
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [to, BigInt(amount)],
    }),
  });
  const approvalReceipt: TransactionReceipt =
    await walletProvider.waitForTransactionReceipt(approvalHash);

  const chain = EvmChain.from(Number((await walletProvider.getNetwork()).chainId))!;

  if (approvalReceipt.status === "reverted") {
    return {
      success: false,
      message: `Swap failed: Approval Reverted.
 - Transaction hash: ${approvalHash}
 - Transaction link: ${chain.getTxUrl(approvalHash)}`,
    };
  }

  return { success: true };
}

export const sushiRouterActionProvider = () => new SushiRouterActionProvider();
