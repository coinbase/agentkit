import { EvmWalletProvider } from "../../wallet-providers";
import { WOW_ABI } from "./constants";
import { getHasGraduated, getUniswapQuote } from "./uniswap/utils";

/**
 * Gets the current supply of a token.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - Address of the token contract
 * @returns The current token supply
 */
export async function getCurrentSupply(
  wallet: EvmWalletProvider,
  tokenAddress: string,
): Promise<string> {
  const supply = await wallet.readContract({
    address: tokenAddress as `0x${string}`,
    abi: WOW_ABI,
    functionName: "totalSupply",
    args: [],
  });

  return supply as string;
}

/**
 * Gets quote for buying tokens.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - Address of the token contract
 * @param amountEthInWei - Amount of ETH to buy (in wei)
 * @returns The buy quote amount
 */
export async function getBuyQuote(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  amountEthInWei: string,
): Promise<string> {
  const hasGraduated = await getHasGraduated(wallet, tokenAddress);

  const tokenQuote = (
    hasGraduated
      ? (await getUniswapQuote(wallet, tokenAddress, Number(amountEthInWei), "buy")).amountOut
      : await wallet.readContract({
          address: tokenAddress as `0x${string}`,
          abi: WOW_ABI,
          functionName: "getEthBuyQuote",
          args: [amountEthInWei],
        })
  ) as string | number;

  return tokenQuote.toString();
}

/**
 * Gets quote for selling tokens.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - Address of the token contract
 * @param amountTokensInWei - Amount of tokens to sell (in wei)
 * @returns The sell quote amount
 */
export async function getSellQuote(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  amountTokensInWei: string,
): Promise<string> {
  const hasGraduated = await getHasGraduated(wallet, tokenAddress);

  const tokenQuote = (
    hasGraduated
      ? (await getUniswapQuote(wallet, tokenAddress, Number(amountTokensInWei), "sell")).amountOut
      : await wallet.readContract({
          address: tokenAddress as `0x${string}`,
          abi: WOW_ABI,
          functionName: "getTokenSellQuote",
          args: [amountTokensInWei],
        })
  ) as string | number;

  return tokenQuote.toString();
}
