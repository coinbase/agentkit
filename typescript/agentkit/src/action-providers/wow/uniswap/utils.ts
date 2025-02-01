import { formatEther, getAddress } from "viem";
import { EvmWalletProvider } from "../../../wallet-providers";
import { ADDRESSES, WOW_ABI } from "../constants";
import { UNISWAP_QUOTER_ABI, UNISWAP_V3_ABI } from "./constants";

export interface PriceInfo {
  eth: string;
  usd: number;
}

export interface Balance {
  erc20z: string;
  weth: string;
}

export interface Price {
  perToken: PriceInfo;
  total: PriceInfo;
}

export interface Quote {
  amountIn: number;
  amountOut: number;
  balance: Balance | null;
  fee: number | null;
  error: string | null;
}

export interface PoolInfo {
  token0: string;
  balance0: number;
  token1: string;
  balance1: number;
  fee: number;
  liquidity: number;
  sqrtPriceX96: number;
}

/**
 * Creates a PriceInfo object from wei amount and ETH price.
 *
 * @param weiAmount - Amount in wei
 * @param ethPriceInUsd - Current ETH price in USD
 * @returns A PriceInfo object containing the amount in ETH and USD
 */
export function createPriceInfo(weiAmount: string, ethPriceInUsd: number): PriceInfo {
  const amountInEth = formatEther(BigInt(weiAmount));
  const usd = Number(amountInEth) * ethPriceInUsd;
  return {
    eth: weiAmount,
    usd,
  };
}

/**
 * Gets pool info for a given uniswap v3 pool address.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param poolAddress - Uniswap v3 pool address
 * @returns A PoolInfo object containing pool details
 */
export async function getPoolInfo(
  wallet: EvmWalletProvider,
  poolAddress: string,
): Promise<PoolInfo> {
  try {
    const results = await Promise.all([
      wallet.readContract({
        address: poolAddress as `0x${string}`,
        functionName: "token0",
        args: [],
        abi: UNISWAP_V3_ABI,
      }),
      wallet.readContract({
        address: poolAddress as `0x${string}`,
        functionName: "token1",
        args: [],
        abi: UNISWAP_V3_ABI,
      }),
      wallet.readContract({
        address: poolAddress as `0x${string}`,
        functionName: "fee",
        args: [],
        abi: UNISWAP_V3_ABI,
      }),
      wallet.readContract({
        address: poolAddress as `0x${string}`,
        functionName: "liquidity",
        args: [],
        abi: UNISWAP_V3_ABI,
      }),
      wallet.readContract({
        address: poolAddress as `0x${string}`,
        functionName: "slot0",
        args: [],
        abi: UNISWAP_V3_ABI,
      }),
    ]);

    const [token0Result, token1Result, fee, liquidity, slot0] = results;

    const [balance0, balance1] = await Promise.all([
      wallet.readContract({
        address: token0Result as `0x${string}`,
        functionName: "balanceOf",
        args: [poolAddress],
        abi: WOW_ABI,
      }),
      wallet.readContract({
        address: token1Result as `0x${string}`,
        functionName: "balanceOf",
        args: [poolAddress],
        abi: WOW_ABI,
      }),
    ]);

    return {
      token0: token0Result as string,
      balance0: Number(balance0),
      token1: token1Result as string,
      balance1: Number(balance1),
      fee: Number(fee),
      liquidity: Number(liquidity),
      sqrtPriceX96: Number((slot0 as unknown[])[0]),
    };
  } catch (error) {
    throw new Error(`Failed to fetch pool information: ${error}`);
  }
}

/**
 * Gets exact input quote from Uniswap.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenIn - Token address to swap from
 * @param tokenOut - Token address to swap to
 * @param amountIn - Amount of tokens to swap (in Wei)
 * @param fee - Fee for the swap
 * @returns Amount of tokens to receive (in Wei)
 */
export async function exactInputSingle(
  wallet: EvmWalletProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  fee: string,
): Promise<number> {
  try {
    const networkId = wallet.getNetwork().networkId!;
    const amount = await wallet.readContract({
      address: ADDRESSES[networkId].UniswapQuoter as `0x${string}`,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: getAddress(tokenIn),
          tokenOut: getAddress(tokenOut),
          fee,
          amountIn,
          sqrtPriceLimitX96: 0,
        },
      ],
      abi: UNISWAP_QUOTER_ABI,
    });

    return Number(amount);
  } catch (error) {
    console.error("Quoter error:", error);
    return 0;
  }
}

/**
 * Gets Uniswap quote for buying or selling tokens.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - Token address
 * @param amount - Amount of tokens (in Wei)
 * @param quoteType - 'buy' or 'sell'
 * @returns A Quote object containing quote details
 */
export async function getUniswapQuote(
  wallet: EvmWalletProvider,
  tokenAddress: string,
  amount: number,
  quoteType: "buy" | "sell",
): Promise<Quote> {
  let pool: PoolInfo | null = null;
  let tokens: [string, string] | null = null;
  let balances: [number, number] | null = null;
  let quoteResult: number | null = null;
  const utilization = 0;
  const networkId = wallet.getNetwork().networkId!;

  const poolAddress = await getPoolAddress(wallet, tokenAddress);
  const invalidPoolError = !poolAddress ? "Invalid pool address" : null;

  try {
    pool = await getPoolInfo(wallet, poolAddress);
    const { token0, token1, balance0, balance1, fee } = pool;
    tokens = [token0, token1];
    balances = [balance0, balance1];

    const isToken0Weth = token0.toLowerCase() === ADDRESSES[networkId].WETH.toLowerCase();
    const tokenIn =
      (quoteType === "buy" && isToken0Weth) || (quoteType === "sell" && !isToken0Weth)
        ? token0
        : token1;

    const [tokenOut, balanceOut] = tokenIn === token0 ? [token1, balance1] : [token0, balance0];
    const isInsufficientLiquidity = quoteType === "buy" && amount > balanceOut;

    if (!isInsufficientLiquidity) {
      quoteResult = await exactInputSingle(wallet, tokenIn, tokenOut, String(amount), String(fee));
    }
  } catch (error) {
    console.error("Error fetching quote:", error);
  }

  const insufficientLiquidity = (quoteType === "sell" && pool && !quoteResult) || false;

  let errorMsg: string | null = null;
  if (!pool) {
    errorMsg = "Failed fetching pool";
  } else if (insufficientLiquidity) {
    errorMsg = "Insufficient liquidity";
  } else if (!quoteResult && utilization >= 0.9) {
    errorMsg = "Price impact too high";
  } else if (!quoteResult) {
    errorMsg = "Failed fetching quote";
  }

  const balanceResult =
    tokens && balances
      ? {
          erc20z: String(
            balances[tokens[0].toLowerCase() === ADDRESSES[networkId].WETH.toLowerCase() ? 1 : 0],
          ),
          weth: String(
            balances[tokens[0].toLowerCase() === ADDRESSES[networkId].WETH.toLowerCase() ? 0 : 1],
          ),
        }
      : null;

  return {
    amountIn: Number(amount),
    amountOut: quoteResult || 0,
    balance: balanceResult,
    fee: pool?.fee ? pool.fee / 1000000 : null,
    error: invalidPoolError || errorMsg,
  };
}

/**
 * Checks if a token has graduated from the Zora Wow protocol.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - Token address
 * @returns True if the token has graduated, false otherwise
 */
export async function getHasGraduated(
  wallet: EvmWalletProvider,
  tokenAddress: string,
): Promise<boolean> {
  const marketType = await wallet.readContract({
    address: tokenAddress as `0x${string}`,
    functionName: "marketType",
    args: [],
    abi: WOW_ABI,
  });
  return marketType === 1;
}

/**
 * Fetches the uniswap v3 pool address for a given token.
 *
 * @param wallet - The wallet provider to use for contract calls
 * @param tokenAddress - The address of the token contract
 * @returns The uniswap v3 pool address associated with the token
 */
export async function getPoolAddress(
  wallet: EvmWalletProvider,
  tokenAddress: string,
): Promise<string> {
  const poolAddress = await wallet.readContract({
    address: tokenAddress as `0x${string}`,
    functionName: "poolAddress",
    args: [],
    abi: WOW_ABI,
  });
  return poolAddress as string;
}
