import { parseAbi } from "viem";

/**
 * Uniswap V4 contract addresses by network.
 * Source: https://docs.uniswap.org/contracts/v4/deployments
 */
export const UNISWAP_V4_ADDRESSES: Record<
  string,
  {
    poolManager: `0x${string}`;
    universalRouter: `0x${string}`;
    quoter: `0x${string}`;
    positionManager: `0x${string}`;
  }
> = {
  base: {
    poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    quoter: "0x52f00940fcc88e426b4613f4e6e0f1a24dca9f0b",
    positionManager: "0x7c5f5a0c7f8b8e3e3e3e3e3e3e3e3e3e3e3e3e3",
  },
  "base-sepolia": {
    poolManager: "0xfd3f01f3a3e00d30f84f7a64f27d59b752a4e303",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    quoter: "0x52f00940fcc88e426b4613f4e6e0f1a24dca9f0b",
    positionManager: "0x7c5f5a0c7f8b8e3e3e3e3e3e3e3e3e3e3e3e3e3",
  },
};

/** Supported network IDs for this provider */
export const SUPPORTED_NETWORK_IDS = Object.keys(UNISWAP_V4_ADDRESSES);

/** Common token addresses by network */
export const COMMON_TOKENS: Record<string, Record<string, `0x${string}`>> = {
  base: {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  },
  "base-sepolia": {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

/** Native ETH as a Currency (address(0)) */
export const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/** Aliases that resolve to native ETH */
export const NATIVE_ETH_ALIASES = ["native", "eth", NATIVE_ETH.toLowerCase()];

/** Default values */
export const DEFAULT_SLIPPAGE_TOLERANCE = 0.5; // 0.5%
export const DEFAULT_FEE = 3000; // 0.3%
export const DEFAULT_DEADLINE_SECONDS = 1800; // 30 minutes

/** Standard fee tiers and corresponding tick spacings */
export const FEE_TIER_MAP: Record<number, number> = {
  100: 1, // 0.01%
  500: 10, // 0.05%
  3000: 60, // 0.3%
  10000: 200, // 1.0%
};

/** ERC20 ABI for token operations */
export const ERC20_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
] as const);

/** Universal Router ABI */
export const UNIVERSAL_ROUTER_ABI = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
] as const);

/** PoolManager ABI for view functions */
export const POOL_MANAGER_ABI = parseAbi([
  "function getSlot0(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 id) view returns (uint128)",
] as const);

/** Quoter ABI */
export const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96)) external returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
] as const);

/** Universal Router command bytes */
export const COMMANDS = {
  V4_SWAP: 0x10,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
} as const;

/** V4 swap sub-action types */
export const V4_ACTIONS = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SWAP_EXACT_OUT: 0x09,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
} as const;
