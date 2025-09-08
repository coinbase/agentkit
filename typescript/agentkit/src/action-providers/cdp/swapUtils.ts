import { Hex, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

// Permit2 contract address is the same across all networks
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Checks if a token is native ETH.
 *
 * @param token - The token address to check.
 * @returns True if the token is native ETH, false otherwise.
 */
export function isNativeEth(token: string): boolean {
  return token.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}

/**
 * Gets the details (decimals and name) for both fromToken and toToken
 *
 * @param walletProvider - The EVM wallet provider to read contracts
 * @param fromToken - The contract address of the from token
 * @param toToken - The contract address of the to token
 * @returns Promise<{fromTokenDecimals: number, toTokenDecimals: number, fromTokenName: string, toTokenName: string}>
 */
export async function getTokenDetails(
  walletProvider: EvmWalletProvider,
  fromToken: string,
  toToken: string,
): Promise<{
  fromTokenDecimals: number;
  toTokenDecimals: number;
  fromTokenName: string;
  toTokenName: string;
}> {
  // Initialize default values for native ETH
  let fromTokenDecimals = 18;
  let fromTokenName = "ETH";
  let toTokenDecimals = 18;
  let toTokenName = "ETH";

  // Prepare multicall contracts array
  const contracts: {
    address: Hex;
    abi: typeof erc20Abi;
    functionName: "decimals" | "name";
  }[] = [];
  const contractIndexMap = {
    fromDecimals: -1,
    fromName: -1,
    toDecimals: -1,
    toName: -1,
  };

  // Add from token contracts if not native ETH
  if (!isNativeEth(fromToken)) {
    contractIndexMap.fromDecimals = contracts.length;
    contracts.push({
      address: fromToken as Hex,
      abi: erc20Abi,
      functionName: "decimals",
    });

    contractIndexMap.fromName = contracts.length;
    contracts.push({
      address: fromToken as Hex,
      abi: erc20Abi,
      functionName: "name",
    });
  }

  // Add to token contracts if not native ETH
  if (!isNativeEth(toToken)) {
    contractIndexMap.toDecimals = contracts.length;
    contracts.push({
      address: toToken as Hex,
      abi: erc20Abi,
      functionName: "decimals",
    });

    contractIndexMap.toName = contracts.length;
    contracts.push({
      address: toToken as Hex,
      abi: erc20Abi,
      functionName: "name",
    });
  }

  // Execute multicall if there are contracts to call
  if (contracts.length > 0) {
    try {
      const results = await walletProvider.getPublicClient().multicall({
        contracts,
      });

      // Extract from token details
      if (contractIndexMap.fromDecimals !== -1) {
        const decimalsResult = results[contractIndexMap.fromDecimals];
        const nameResult = results[contractIndexMap.fromName];

        if (decimalsResult.status === "success" && nameResult.status === "success") {
          fromTokenDecimals = decimalsResult.result as number;
          fromTokenName = nameResult.result as string;
        } else {
          throw new Error(
            `Failed to read details for fromToken ${fromToken}. This address may not be a valid ERC20 contract.`,
          );
        }
      }

      // Extract to token details
      if (contractIndexMap.toDecimals !== -1) {
        const decimalsResult = results[contractIndexMap.toDecimals];
        const nameResult = results[contractIndexMap.toName];

        if (decimalsResult.status === "success" && nameResult.status === "success") {
          toTokenDecimals = decimalsResult.result as number;
          toTokenName = nameResult.result as string;
        } else {
          throw new Error(
            `Failed to read details for toToken ${toToken}. This address may not be a valid ERC20 contract.`,
          );
        }
      }
    } catch (error) {
      throw new Error(`Failed to read token details via multicall. Error: ${error}`);
    }
  }

  return { fromTokenDecimals, toTokenDecimals, fromTokenName, toTokenName };
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
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Wait before each attempt
    // Calculate delay with exponential backoff: baseDelay * 2^attempt
    const delay = baseDelay * Math.pow(2, attempt);
    await sleep(delay);

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError!;
}
