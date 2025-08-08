import { Hex, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

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
  // Determine from token details
  let fromTokenDecimals = 18;
  let fromTokenName = "ETH";
  if (!isNativeEth(fromToken)) {
    try {
      const [decimals, name] = await Promise.all([
        walletProvider.readContract({
          address: fromToken as Hex,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: fromToken as Hex,
          abi: erc20Abi,
          functionName: "name",
          args: [],
        }),
      ]);
      fromTokenDecimals = decimals as number;
      fromTokenName = name as string;
    } catch (error) {
      throw new Error(
        `Failed to read details for fromToken ${fromToken}. This address may not be a valid ERC20 contract. Error: ${error}`,
      );
    }
  }

  // Determine to token details
  let toTokenDecimals = 18;
  let toTokenName = "ETH";
  if (!isNativeEth(toToken)) {
    try {
      const [decimals, name] = await Promise.all([
        walletProvider.readContract({
          address: toToken as Hex,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        }),
        walletProvider.readContract({
          address: toToken as Hex,
          abi: erc20Abi,
          functionName: "name",
          args: [],
        }),
      ]);
      toTokenDecimals = decimals as number;
      toTokenName = name as string;
    } catch (error) {
      throw new Error(
        `Failed to read details for toToken ${toToken}. This address may not be a valid ERC20 contract. Error: ${error}`,
      );
    }
  }

  return { fromTokenDecimals, toTokenDecimals, fromTokenName, toTokenName };
}
