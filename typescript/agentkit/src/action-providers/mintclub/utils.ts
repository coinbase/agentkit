import { EvmWalletProvider } from "../../wallet-providers";
import {
  MCV2_BOND_ABI,
  ERC20_ABI,
  SPOT_PRICE_AGGREGATOR_ABI,
  getBondAddress,
  getSpotPriceAggregatorAddress,
  getUsdcAddress,
} from "./constants";
import { formatUnits } from "viem";

/**
 * Gets detailed information about a token bond.
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param tokenAddress - Address of the token contract.
 * @returns Token bond information or null if not a Mint Club token.
 */
export async function getTokenBond(
  wallet: EvmWalletProvider,
  tokenAddress: string,
): Promise<{
  creator: string;
  mintRoyalty: number;
  burnRoyalty: number;
  createdAt: number;
  reserveToken: string;
  reserveBalance: string;
} | null> {
  try {
    const bondAddress = getBondAddress(wallet.getNetwork().networkId!);

    const bondInfo = (await wallet.readContract({
      address: bondAddress as `0x${string}`,
      abi: MCV2_BOND_ABI,
      functionName: "tokenBond",
      args: [tokenAddress as `0x${string}`],
    })) as [string, number, number, number, string, bigint];

    // createdAt == 0 means the token is not registered on Mint Club
    if (bondInfo[3] === 0) {
      return null;
    }

    return {
      creator: bondInfo[0],
      mintRoyalty: bondInfo[1],
      burnRoyalty: bondInfo[2],
      createdAt: bondInfo[3],
      reserveToken: bondInfo[4],
      reserveBalance: bondInfo[5].toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Gets basic token information (symbol, decimals, total supply).
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param tokenAddress - Address of the token contract.
 * @returns Token information or null if the contract call fails.
 */
export async function getTokenInfo(
  wallet: EvmWalletProvider,
  tokenAddress: string,
): Promise<{
  symbol: string;
  decimals: number;
  totalSupply: string;
  formattedSupply: string;
} | null> {
  try {
    const [symbol, decimals, totalSupply] = await Promise.all([
      wallet.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "symbol",
        args: [],
      }) as Promise<string>,
      wallet.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }) as Promise<number>,
      wallet.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "totalSupply",
        args: [],
      }) as Promise<bigint>,
    ]);

    return {
      symbol,
      decimals,
      totalSupply: totalSupply.toString(),
      formattedSupply: formatUnits(totalSupply, decimals),
    };
  } catch {
    return null;
  }
}

/**
 * Gets quote for buying tokens from the bonding curve.
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param tokenAddress - Address of the token contract.
 * @param tokensToMint - Amount of tokens to mint (in wei).
 * @returns The quote containing reserve amount and royalty, or null on failure.
 */
export async function getBuyQuote(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  tokensToMint: string,
): Promise<{
  reserveAmount: string;
  royalty: string;
} | null> {
  try {
    const bondAddress = getBondAddress(wallet.getNetwork().networkId!);

    const quote = (await wallet.readContract({
      address: bondAddress as `0x${string}`,
      abi: MCV2_BOND_ABI,
      functionName: "getReserveForToken",
      args: [tokenAddress as `0x${string}`, BigInt(tokensToMint)],
    })) as [bigint, bigint];

    return {
      reserveAmount: quote[0].toString(),
      royalty: quote[1].toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Gets quote for selling tokens to the bonding curve.
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param tokenAddress - Address of the token contract.
 * @param tokensToBurn - Amount of tokens to burn (in wei).
 * @returns The quote containing refund amount and royalty, or null on failure.
 */
export async function getSellQuote(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  tokensToBurn: string,
): Promise<{
  refundAmount: string;
  royalty: string;
} | null> {
  try {
    const bondAddress = getBondAddress(wallet.getNetwork().networkId!);

    const quote = (await wallet.readContract({
      address: bondAddress as `0x${string}`,
      abi: MCV2_BOND_ABI,
      functionName: "getRefundForTokens",
      args: [tokenAddress as `0x${string}`, BigInt(tokensToBurn)],
    })) as [bigint, bigint];

    return {
      refundAmount: quote[0].toString(),
      royalty: quote[1].toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Gets the USD price of a reserve token using 1inch Spot Price Aggregator.
 * Returns the rate as USD per one full unit of the reserve token.
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param reserveTokenAddress - Address of the reserve token.
 * @returns USD price per token or null if unable to fetch.
 */
export async function getUsdRate(
  wallet: EvmWalletProvider,
  reserveTokenAddress: string,
): Promise<number | null> {
  try {
    const aggregatorAddress = getSpotPriceAggregatorAddress(
      wallet.getNetwork().networkId!,
    );
    const usdcAddress = getUsdcAddress(wallet.getNetwork().networkId!);

    // getRate returns USDC-denominated rate per 1 full unit of srcToken
    // The returned value has the same decimals as dstToken (USDC = 6)
    const rate = (await wallet.readContract({
      address: aggregatorAddress as `0x${string}`,
      abi: SPOT_PRICE_AGGREGATOR_ABI,
      functionName: "getRate",
      args: [
        reserveTokenAddress as `0x${string}`,
        usdcAddress as `0x${string}`,
        false,
      ],
    })) as bigint;

    // Rate is in USDC units (6 decimals)
    return Number(rate) / 1e6;
  } catch {
    return null;
  }
}

/**
 * Checks if approval is needed for the Bond contract to spend tokens.
 *
 * @param wallet - The wallet provider to use for contract calls.
 * @param tokenAddress - Address of the token to check allowance for.
 * @param ownerAddress - Address of the token owner.
 * @param amountNeeded - Amount that needs to be approved (in wei).
 * @returns True if approval is needed, false otherwise.
 */
export async function needsApproval(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  ownerAddress: string,
  amountNeeded: string,
): Promise<boolean> {
  try {
    const bondAddress = getBondAddress(wallet.getNetwork().networkId!);

    const allowance = (await wallet.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [ownerAddress as `0x${string}`, bondAddress as `0x${string}`],
    })) as bigint;

    return allowance < BigInt(amountNeeded);
  } catch {
    return true;
  }
}
