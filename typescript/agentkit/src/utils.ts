import { encodeFunctionData } from "viem";
import { EvmWalletProvider } from "./wallet-providers";
import { erc20Abi } from "viem";
/**
 * Approves a spender to spend tokens on behalf of the owner
 *
 * @param wallet - The wallet provider
 * @param tokenAddress - The address of the token contract
 * @param spenderAddress - The address of the spender
 * @param amount - The amount to approve in atomic units (wei)
 * @returns A success message or error message
 */
export async function approve(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
): Promise<string> {
  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress as `0x${string}`, amount],
    });

    const txHash = await wallet.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data,
    });

    await wallet.waitForTransactionReceipt(txHash);

    return `Successfully approved ${spenderAddress} to spend ${amount} tokens`;
  } catch (error) {
    return `Error approving tokens: ${error}`;
  }
}

/**
 * Scales a gas estimate by a given multiplier.
 *
 * This function converts the gas estimate to a number, applies the multiplier,
 * rounds the result to the nearest integer, and returns it as a bigint.
 *
 * @param gas - The original gas estimate (bigint).
 * @param multiplier - The factor by which to scale the estimate.
 * @returns The adjusted gas estimate as a bigint.
 */
export function applyGasMultiplier(gas: bigint, multiplier: number): bigint {
  return BigInt(Math.round(Number(gas) * multiplier));
}

/**
 * Utility function to sleep for a given number of milliseconds
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 *
 * @param fn - The function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds for retries (default: 1000)
 * @param initialDelay - Initial delay before the first attempt in milliseconds (default: 0)
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  initialDelay: number = 0,
): Promise<T> {
  let lastError: Error;

  // Wait before the first attempt if initialDelay is specified
  if (initialDelay > 0) {
    await sleep(initialDelay);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait after failed attempt with exponential backoff
      // Calculate delay with exponential backoff: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError!;
}
