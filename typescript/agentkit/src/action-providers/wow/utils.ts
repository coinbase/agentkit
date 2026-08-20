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

  if (hasGraduated) {
    const quote = await getUniswapQuote(wallet, tokenAddress, Number(amountEthInWei), "buy");
    // Quoter failures used to return amountOut=0, which became minOut=0 on buy().
    if (quote.error || !quote.amountOut || quote.amountOut <= 0) {
      throw new Error(quote.error || "Failed fetching buy quote");
    }
    return quote.amountOut.toString();
  }

  const tokenQuote = (await wallet.readContract({
    address: tokenAddress as `0x${string}`,
    abi: WOW_ABI,
    functionName: "getEthBuyQuote",
    args: [amountEthInWei],
  })) as string | number | bigint;

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

  if (hasGraduated) {
    const quote = await getUniswapQuote(wallet, tokenAddress, Number(amountTokensInWei), "sell");
    // Quoter failures used to return amountOut=0, which became minEth=0 on sell().
    if (quote.error || !quote.amountOut || quote.amountOut <= 0) {
      throw new Error(quote.error || "Failed fetching sell quote");
    }
    return quote.amountOut.toString();
  }

  const tokenQuote = (await wallet.readContract({
    address: tokenAddress as `0x${string}`,
    abi: WOW_ABI,
    functionName: "getTokenSellQuote",
    args: [amountTokensInWei],
  })) as string | number | bigint;

  return tokenQuote.toString();
}
