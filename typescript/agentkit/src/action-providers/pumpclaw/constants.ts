import type { Abi } from "abitype";

export const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * PumpClaw Factory contract ABI - minimal functions needed for PumpClaw interactions.
 */
export const PUMPCLAW_FACTORY_ABI: Abi = [
  {
    type: "function",
    name: "createToken",
    inputs: [
      { name: "name", type: "string", internalType: "string" },
      { name: "symbol", type: "string", internalType: "string" },
      { name: "imageUrl", type: "string", internalType: "string" },
      { name: "totalSupply", type: "uint256", internalType: "uint256" },
      { name: "initialFdv", type: "uint256", internalType: "uint256" },
      { name: "creator", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getTokenInfo",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [
      { name: "name", type: "string", internalType: "string" },
      { name: "symbol", type: "string", internalType: "string" },
      { name: "imageUrl", type: "string", internalType: "string" },
      { name: "totalSupply", type: "uint256", internalType: "uint256" },
      { name: "creator", type: "address", internalType: "address" },
      { name: "pool", type: "address", internalType: "address" },
      { name: "createdAt", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokenCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokens",
    inputs: [
      { name: "offset", type: "uint256", internalType: "uint256" },
      { name: "limit", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setImageUrl",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "imageUrl", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * PumpClaw SwapRouter contract ABI - minimal functions needed for swap interactions.
 */
export const PUMPCLAW_SWAPROUTER_ABI: Abi = [
  {
    type: "function",
    name: "buyTokens",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "minTokensOut", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sellTokens",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokensIn", type: "uint256", internalType: "uint256" },
      { name: "minEthOut", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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
 * Contract addresses on Base mainnet.
 */
export const PUMPCLAW_CONTRACT_ADDRESSES = {
  "base-mainnet": {
    Factory: "0xe5bCa0eDe9208f7Ee7FCAFa0415Ca3DC03e16a90",
    SwapRouter: "0x3A9c65f4510de85F1843145d637ae895a2Fe04BE",
  },
} as const;

/**
 * Gets the PumpClaw Factory contract address for the specified network.
 *
 * @param network - The network ID to get the contract address for.
 * @returns The contract address for the specified network.
 * @throws Error if the specified network is not supported.
 */
export function getFactoryAddress(network: string): string {
  const addresses =
    PUMPCLAW_CONTRACT_ADDRESSES[
      network.toLowerCase() as keyof typeof PUMPCLAW_CONTRACT_ADDRESSES
    ];
  if (!addresses) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(PUMPCLAW_CONTRACT_ADDRESSES).join(", ")}`,
    );
  }
  return addresses.Factory;
}

/**
 * Gets the PumpClaw SwapRouter contract address for the specified network.
 *
 * @param network - The network ID to get the contract address for.
 * @returns The contract address for the specified network.
 * @throws Error if the specified network is not supported.
 */
export function getSwapRouterAddress(network: string): string {
  const addresses =
    PUMPCLAW_CONTRACT_ADDRESSES[
      network.toLowerCase() as keyof typeof PUMPCLAW_CONTRACT_ADDRESSES
    ];
  if (!addresses) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(PUMPCLAW_CONTRACT_ADDRESSES).join(", ")}`,
    );
  }
  return addresses.SwapRouter;
}
