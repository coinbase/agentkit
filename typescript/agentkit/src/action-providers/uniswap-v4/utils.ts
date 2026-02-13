import { formatUnits, keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import {
  NATIVE_ETH,
  NATIVE_ETH_ALIASES,
  DEFAULT_FEE,
  FEE_TIER_MAP,
  ERC20_ABI,
  V4_ACTIONS,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "./constants";
import type { EvmWalletProvider } from "../../wallet-providers";

/** Represents a Uniswap V4 PoolKey */
export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

/** Token info resolved from on-chain */
export interface TokenInfo {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  isNative: boolean;
}

/**
 * Resolve a token input string to the canonical address.
 * Handles "native", "eth", and "0x0000...0000" → native ETH address.
 *
 * @param input - The token input string.
 * @returns The canonical token address.
 */
export function resolveTokenAddress(input: string): `0x${string}` {
  if (NATIVE_ETH_ALIASES.includes(input.toLowerCase())) {
    return NATIVE_ETH;
  }
  return input as `0x${string}`;
}

/**
 * Check if a token address represents native ETH.
 *
 * @param address - The address to check.
 * @returns True if the address represents native ETH.
 */
export function isNativeToken(address: string): boolean {
  return NATIVE_ETH_ALIASES.includes(address.toLowerCase());
}

/**
 * Fetch token info (decimals, symbol) from the contract.
 * For native ETH, returns hardcoded values.
 *
 * @param walletProvider - The EVM wallet provider instance.
 * @param tokenAddress - The token address or "native" for ETH.
 * @returns The token info including address, decimals, symbol, and isNative flag.
 */
export async function getTokenInfo(
  walletProvider: EvmWalletProvider,
  tokenAddress: string,
): Promise<TokenInfo> {
  const resolved = resolveTokenAddress(tokenAddress);

  if (isNativeToken(tokenAddress)) {
    return {
      address: NATIVE_ETH,
      decimals: 18,
      symbol: "ETH",
      isNative: true,
    };
  }

  const [decimals, symbol] = await Promise.all([
    walletProvider.readContract({
      address: resolved,
      abi: ERC20_ABI,
      functionName: "decimals",
    }) as Promise<number>,
    walletProvider.readContract({
      address: resolved,
      abi: ERC20_ABI,
      functionName: "symbol",
    }) as Promise<string>,
  ]);

  return { address: resolved, decimals, symbol, isNative: false };
}

/**
 * Construct a PoolKey with properly sorted tokens.
 * In V4, currency0 MUST be numerically less than currency1.
 *
 * @param tokenA - The first token address.
 * @param tokenB - The second token address.
 * @param fee - The fee tier (default: DEFAULT_FEE).
 * @param hooks - The hooks contract address (default: address(0)).
 * @returns The constructed PoolKey.
 */
export function buildPoolKey(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number = DEFAULT_FEE,
  hooks: `0x${string}` = NATIVE_ETH, // address(0) = no hooks
): PoolKey {
  const tickSpacing = FEE_TIER_MAP[fee];
  if (tickSpacing === undefined) {
    throw new Error(
      `Invalid fee tier: ${fee}. Valid tiers: ${Object.keys(FEE_TIER_MAP).join(", ")}`,
    );
  }

  // Sort tokens — currency0 < currency1 by address value
  const [currency0, currency1] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

  return { currency0, currency1, fee, tickSpacing, hooks };
}

/**
 * Compute the PoolId from a PoolKey (keccak256 hash).
 *
 * @param poolKey - The PoolKey to compute ID for.
 * @returns The computed pool ID as a 0x-prefixed hex string.
 */
export function computePoolId(poolKey: PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, address, uint24, int24, address"), [
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
    ]),
  );
}

/**
 * Determine swap direction (zeroForOne) based on which token is being sold.
 *
 * @param tokenIn - The input token address.
 * @param poolKey - The pool key containing currency0 and currency1.
 * @returns True if selling currency0 for currency1, false otherwise.
 */
export function getSwapDirection(tokenIn: `0x${string}`, poolKey: PoolKey): boolean {
  // zeroForOne = true means selling currency0 for currency1
  return tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
}

/**
 * Calculate minimum output amount with slippage tolerance.
 *
 * @param amount - The base amount.
 * @param slippagePercent - The slippage tolerance percentage.
 * @param isMinimum - Whether to calculate minimum (true) or maximum (false).
 * @returns The slippage-adjusted amount.
 */
export function applySlippage(amount: bigint, slippagePercent: number, isMinimum: boolean): bigint {
  // Prevent overflow by limiting acceptable input amounts
  // Max reasonable amount: 2^128 - 1 (3.4e38) which covers all practical token amounts
  const MAX_ACCEPTABLE_AMOUNT = BigInt("340282366920938463463374607431768211455");
  if (amount > MAX_ACCEPTABLE_AMOUNT) {
    throw new Error("Amount exceeds maximum safe value for slippage calculation");
  }

  const slippageBps = BigInt(Math.floor(slippagePercent * 100)); // 0.5% → 50 bps
  const bpsBase = 10000n;

  if (isMinimum) {
    // Minimum output: amount * (1 - slippage)
    return (amount * (bpsBase - slippageBps)) / bpsBase;
  } else {
    // Maximum input: amount * (1 + slippage)
    return (amount * (bpsBase + slippageBps)) / bpsBase;
  }
}

/**
 * Check if the Universal Router has sufficient ERC20 allowance.
 * If not, send an approve transaction.
 * Returns the approval transaction hash or null if no approval needed.
 *
 * @param walletProvider - The EVM wallet provider instance.
 * @param tokenAddress - The token contract address.
 * @param spender - The spender address to approve.
 * @param amount - The amount to approve.
 * @returns The approval transaction hash, or null if approval was not needed.
 */
export async function ensureApproval(
  walletProvider: EvmWalletProvider,
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
): Promise<`0x${string}` | null> {
  // Native ETH doesn't need approval
  if (isNativeToken(tokenAddress)) {
    return null;
  }

  const ownerAddress = walletProvider.getAddress();

  // Check current allowance
  const currentAllowance = (await walletProvider.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, spender],
  })) as bigint;

  if (currentAllowance >= amount) {
    return null; // Sufficient allowance
  }

  // Send approve transaction using viem's encodeFunctionData pattern
  const approvalHash = await walletProvider.sendTransaction({
    to: tokenAddress,
    data: encodeApprovalData(spender, amount),
  });

  await walletProvider.waitForTransactionReceipt(approvalHash);
  return approvalHash;
}

/**
 * Encode ERC20 approve function data.
 *
 * @param spender - The address to approve as spender.
 * @param amount - The amount to approve.
 * @returns The encoded approval data as a 0x-prefixed hex string.
 */
function encodeApprovalData(spender: `0x${string}`, amount: bigint): `0x${string}` {
  // ERC20 approve selector: 0x095ea7b3
  const selector = "0x095ea7b3";
  const paddedSpender = spender.toLowerCase().slice(2).padStart(64, "0");
  const paddedAmount = amount.toString(16).padStart(64, "0");
  return (selector + paddedSpender + paddedAmount) as `0x${string}`;
}

/**
 * Format a token amount for display (e.g., 1234567890 with 6 decimals → "1,234.567890").
 *
 * @param amount - The amount as a bigint.
 * @param decimals - The number of decimal places.
 * @param maxDecimals - The maximum fraction digits to display.
 * @returns The formatted amount string.
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxDecimals: number = 6,
): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Encode V4 swap sub-action parameters for SWAP_EXACT_IN_SINGLE.
 *
 * @param poolKey - The pool key.
 * @param zeroForOne - Whether swapping currency0 for currency1.
 * @param amountIn - The exact input amount.
 * @param amountOutMinimum - The minimum output amount.
 * @returns The encoded swap parameters.
 */
export function encodeSwapExactInSingle(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
): `0x${string}` {
  // Set sqrtPriceLimitX96 based on swap direction to allow max price movement
  const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n;

  return encodeAbiParameters(
    parseAbiParameters(
      "(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), bool, uint128, uint128, uint160, bytes",
    ),
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96,
      "0x", // hookData = empty
    ],
  );
}

/**
 * Encode V4 swap sub-action parameters for SWAP_EXACT_OUT_SINGLE.
 *
 * @param poolKey - The pool key.
 * @param zeroForOne - Whether swapping currency0 for currency1.
 * @param amountOut - The exact output amount.
 * @param amountInMaximum - The maximum input amount.
 * @returns The encoded swap parameters.
 */
export function encodeSwapExactOutSingle(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountOut: bigint,
  amountInMaximum: bigint,
): `0x${string}` {
  // Set sqrtPriceLimitX96 based on swap direction to allow max price movement
  const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n;

  return encodeAbiParameters(
    parseAbiParameters(
      "(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), bool, uint128, uint128, uint160, bytes",
    ),
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountOut,
      amountInMaximum,
      sqrtPriceLimitX96,
      "0x", // hookData = empty
    ],
  );
}

/**
 * Encode SETTLE_ALL sub-action parameters.
 *
 * @param currency - The currency to settle.
 * @param maxAmount - The maximum amount to settle.
 * @returns The encoded settle parameters.
 */
export function encodeSettleAll(currency: `0x${string}`, maxAmount: bigint): `0x${string}` {
  return encodeAbiParameters(parseAbiParameters("address, uint128"), [currency, maxAmount]);
}

/**
 * Encode TAKE_ALL sub-action parameters.
 *
 * @param currency - The currency to take.
 * @param minAmount - The minimum amount to take.
 * @param recipient - The recipient address (defaults to the swap executor if not provided).
 * @returns The encoded take parameters.
 */
export function encodeTakeAll(
  currency: `0x${string}`,
  minAmount: bigint,
  recipient?: `0x${string}`,
): `0x${string}` {
  if (recipient) {
    return encodeAbiParameters(parseAbiParameters("address, uint128, address"), [
      currency,
      minAmount,
      recipient,
    ]);
  }
  return encodeAbiParameters(parseAbiParameters("address, uint128"), [currency, minAmount]);
}

/**
 * Assemble the complete V4_SWAP input with multiple sub-actions.
 *
 * @param actions - Array of action type bytes.
 * @param params - Array of encoded parameters for each action.
 * @returns The encoded V4 swap input.
 */
export function encodeV4SwapInput(actions: number[], params: `0x${string}`[]): `0x${string}` {
  // Pack actions into hex string
  const packedActions: `0x${string}` = `0x${actions.map(a => a.toString(16).padStart(2, "0")).join("")}`;

  return encodeAbiParameters(parseAbiParameters("bytes, bytes[]"), [packedActions, params]);
}

/**
 * Build complete Universal Router execute() input for exact input swap.
 *
 * @param poolKey - The pool key defining the token pair.
 * @param zeroForOne - Whether swapping currency0 for currency1.
 * @param amountIn - The exact input amount.
 * @param amountOutMinimum - The minimum output amount.
 * @param deadline - The transaction deadline as a bigint.
 * @param recipient - The recipient address (defaults to swap executor if not provided).
 * @returns The swap data containing commands, inputs, and deadline.
 */
export function buildExactInputSwapData(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  deadline: bigint,
  recipient?: `0x${string}`,
): { commands: `0x${string}`; inputs: `0x${string}`[]; deadline: bigint } {
  // Encode sub-actions
  const swapParams = encodeSwapExactInSingle(poolKey, zeroForOne, amountIn, amountOutMinimum);
  const settleParams = encodeSettleAll(
    zeroForOne ? poolKey.currency0 : poolKey.currency1,
    amountIn,
  );
  const takeParams = encodeTakeAll(
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    amountOutMinimum,
    recipient,
  );

  // V4_SWAP = 0x10
  const commands = "0x10" as `0x${string}`;

  // Encode the V4_SWAP input
  const v4SwapInput = encodeV4SwapInput(
    [V4_ACTIONS.SWAP_EXACT_IN_SINGLE, V4_ACTIONS.SETTLE_ALL, V4_ACTIONS.TAKE_ALL],
    [swapParams, settleParams, takeParams],
  );

  return {
    commands,
    inputs: [v4SwapInput],
    deadline,
  };
}

/**
 * Build complete Universal Router execute() input for exact output swap.
 *
 * @param poolKey - The pool key defining the token pair.
 * @param zeroForOne - Whether swapping currency0 for currency1.
 * @param amountOut - The exact output amount.
 * @param amountInMaximum - The maximum input amount.
 * @param deadline - The transaction deadline as a bigint.
 * @param recipient - The recipient address (defaults to swap executor if not provided).
 * @returns The swap data containing commands, inputs, and deadline.
 */
export function buildExactOutputSwapData(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountOut: bigint,
  amountInMaximum: bigint,
  deadline: bigint,
  recipient?: `0x${string}`,
): { commands: `0x${string}`; inputs: `0x${string}`[]; deadline: bigint } {
  // Encode sub-actions for exact output
  const swapParams = encodeSwapExactOutSingle(poolKey, zeroForOne, amountOut, amountInMaximum);
  const settleParams = encodeSettleAll(
    zeroForOne ? poolKey.currency0 : poolKey.currency1,
    amountInMaximum,
  );
  const takeParams = encodeTakeAll(
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    amountOut,
    recipient,
  );

  // V4_SWAP = 0x10
  const commands = "0x10" as `0x${string}`;

  // Encode the V4_SWAP input
  const v4SwapInput = encodeV4SwapInput(
    [V4_ACTIONS.SWAP_EXACT_OUT_SINGLE, V4_ACTIONS.SETTLE_ALL, V4_ACTIONS.TAKE_ALL],
    [swapParams, settleParams, takeParams],
  );

  return {
    commands,
    inputs: [v4SwapInput],
    deadline,
  };
}
