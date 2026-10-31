import type { Abi } from "abitype";

export const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * MCV2 Bond contract ABI - minimal functions needed for Mint Club V2 interactions.
 */
export const MCV2_BOND_ABI: Abi = [
  {
    type: "function",
    name: "tokenBond",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [
      { name: "creator", type: "address", internalType: "address" },
      { name: "mintRoyalty", type: "uint16", internalType: "uint16" },
      { name: "burnRoyalty", type: "uint16", internalType: "uint16" },
      { name: "createdAt", type: "uint40", internalType: "uint40" },
      { name: "reserveToken", type: "address", internalType: "address" },
      { name: "reserveBalance", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReserveForToken",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokensToMint", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "reserveAmount", type: "uint256", internalType: "uint256" },
      { name: "royalty", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRefundForTokens",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokensToBurn", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "refundAmount", type: "uint256", internalType: "uint256" },
      { name: "royalty", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokensToMint", type: "uint256", internalType: "uint256" },
      { name: "maxReserveAmount", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "burn",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokensToBurn", type: "uint256", internalType: "uint256" },
      { name: "minRefund", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createToken",
    inputs: [
      {
        name: "tp",
        type: "tuple",
        internalType: "struct MCV2_Bond.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
        ],
      },
      {
        name: "bp",
        type: "tuple",
        internalType: "struct MCV2_Bond.BondParams",
        components: [
          { name: "mintRoyalty", type: "uint16", internalType: "uint16" },
          { name: "burnRoyalty", type: "uint16", internalType: "uint16" },
          { name: "reserveToken", type: "address", internalType: "address" },
          { name: "maxSupply", type: "uint128", internalType: "uint128" },
          { name: "stepRanges", type: "uint128[]", internalType: "uint128[]" },
          { name: "stepPrices", type: "uint128[]", internalType: "uint128[]" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "creationFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * ERC20 token ABI - standard functions needed for token interactions.
 */
export const ERC20_ABI: Abi = [
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * 1inch Spot Price Aggregator ABI for USD pricing.
 */
export const SPOT_PRICE_AGGREGATOR_ABI: Abi = [
  {
    type: "function",
    name: "getRate",
    inputs: [
      { name: "srcToken", type: "address", internalType: "contract IERC20" },
      { name: "dstToken", type: "address", internalType: "contract IERC20" },
      { name: "useWrappers", type: "bool", internalType: "bool" },
    ],
    outputs: [{ name: "weightedRate", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * Contract addresses on Base mainnet.
 */
export const MINTCLUB_CONTRACT_ADDRESSES = {
  "base-mainnet": {
    MCV2_Bond: "0xc5a076cad94176c2996B32d8466Be1cE757FAa27",
    SpotPriceAggregator: "0x00000000000D6FFc74A8feb35aF5827bf57f6786",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const;

/**
 * Gets the MCV2 Bond contract address for the specified network.
 *
 * @param network - The network ID to get the contract address for.
 * @returns The contract address for the specified network.
 * @throws Error if the specified network is not supported.
 */
export function getBondAddress(network: string): string {
  const addresses =
    MINTCLUB_CONTRACT_ADDRESSES[
      network.toLowerCase() as keyof typeof MINTCLUB_CONTRACT_ADDRESSES
    ];
  if (!addresses) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(MINTCLUB_CONTRACT_ADDRESSES).join(", ")}`,
    );
  }
  return addresses.MCV2_Bond;
}

/**
 * Gets the Spot Price Aggregator contract address for the specified network.
 *
 * @param network - The network ID to get the contract address for.
 * @returns The contract address for the specified network.
 * @throws Error if the specified network is not supported.
 */
export function getSpotPriceAggregatorAddress(network: string): string {
  const addresses =
    MINTCLUB_CONTRACT_ADDRESSES[
      network.toLowerCase() as keyof typeof MINTCLUB_CONTRACT_ADDRESSES
    ];
  if (!addresses) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(MINTCLUB_CONTRACT_ADDRESSES).join(", ")}`,
    );
  }
  return addresses.SpotPriceAggregator;
}

/**
 * Gets the USDC contract address for the specified network.
 *
 * @param network - The network ID to get the contract address for.
 * @returns The contract address for the specified network.
 * @throws Error if the specified network is not supported.
 */
export function getUsdcAddress(network: string): string {
  const addresses =
    MINTCLUB_CONTRACT_ADDRESSES[
      network.toLowerCase() as keyof typeof MINTCLUB_CONTRACT_ADDRESSES
    ];
  if (!addresses) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(MINTCLUB_CONTRACT_ADDRESSES).join(", ")}`,
    );
  }
  return addresses.USDC;
}
