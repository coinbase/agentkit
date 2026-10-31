import { Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { ERC20_ABI } from "./constants";

/**
 * Get token information (decimals and symbol)
 *
 * @param wallet - The EVM wallet provider
 * @param tokenAddress - The token address
 * @returns Object containing token decimals and symbol
 */
export async function getTokenInfo(
  wallet: EvmWalletProvider,
  tokenAddress: Hex,
): Promise<{ decimals: number; symbol: string }> {
  const [decimals, symbol] = await Promise.all([
    wallet.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
    wallet.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "symbol" }),
  ]);
  return { decimals, symbol };
}

/**
 * Format transaction results consistently
 *
 * @param action - The action performed (e.g., "created veAERO lock")
 * @param details - Details of the action
 * @param txHash - Transaction hash
 * @param receipt - Transaction receipt
 * @param receipt.gasUsed - Amount of gas used for the transaction
 * @returns Formatted transaction result string
 */
export function formatTransactionResult(
  action: string,
  details: string,
  txHash: Hex,
  receipt: { gasUsed?: bigint | string },
): string {
  return `Successfully ${action}. ${details}\nTransaction: ${txHash}. Gas used: ${receipt.gasUsed}`;
}

/**
 * Handle common transaction errors
 *
 * @param action - The action that failed (e.g., "creating veAERO lock")
 * @param error - The error that occurred
 * @returns User-friendly error message
 */
export function handleTransactionError(action: string, error: unknown): string {
  console.error(`[Aerodrome Provider] Error ${action}:`, error);

  // Check for common error patterns
  if (error instanceof Error) {
    const errorMsg = error.message;
    if (errorMsg.includes("NotApprovedOrOwner")) {
      return `Error ${action}: You don't own or are not approved for the specified token.`;
    }
    if (errorMsg.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
      return `Error ${action}: Insufficient output amount. The slippage tolerance may be too strict for current market conditions.`;
    }
    if (errorMsg.includes("INSUFFICIENT_LIQUIDITY")) {
      return `Error ${action}: Insufficient liquidity for this trade.`;
    }
    if (errorMsg.includes("Expired") || errorMsg.includes("deadline")) {
      return `Error ${action}: Transaction deadline passed during execution.`;
    }
    // Add more specific error patterns as needed
    return `Error ${action}: ${errorMsg}`;
  }

  return `Error ${action}: ${String(error)}`;
}

/**
 * Format durations in a human-readable way
 *
 * @param seconds - Duration in seconds
 * @returns Human-readable duration string
 */
export function formatDuration(seconds: number): string {
  const weeks = Math.floor(seconds / 604800);
  const days = Math.floor((seconds % 604800) / 86400);

  if (weeks === 0) {
    return `${days} days`;
  } else if (days === 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else {
    return `${weeks} week${weeks !== 1 ? "s" : ""} and ${days} day${days !== 1 ? "s" : ""}`;
  }
}

/**
 * Get the start timestamp for the current voting epoch
 *
 * @param secondsInWeek - Duration of a week in seconds
 * @returns The timestamp (seconds since epoch) of the current epoch start
 */
export function getCurrentEpochStart(secondsInWeek: bigint): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now - (now % secondsInWeek);
}
