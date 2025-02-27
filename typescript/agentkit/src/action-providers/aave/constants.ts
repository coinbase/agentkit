import { type Address } from "viem";
import { AaveV3Base } from "@bgd-labs/aave-address-book";

// Supported networks for Aave
export const SUPPORTED_NETWORKS = ["base-mainnet"] as const;
export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const AAVE_V3_ADDRESSES: Record<
  SupportedNetwork,
  {
    POOL: Address;
    WETH_GATEWAY: Address;
    ASSETS: Record<string, Address>;
  }
> = {
  "base-mainnet": {
    POOL: AaveV3Base.POOL as Address,
    WETH_GATEWAY: AaveV3Base.WETH_GATEWAY as Address,
    ASSETS: {
      WETH: AaveV3Base.ASSETS.WETH.UNDERLYING as Address,
      USDC: AaveV3Base.ASSETS.USDC.UNDERLYING as Address,
    },
  },
};

export const SUPPORTED_ASSETS = {
  ETH: {
    symbol: "ETH",
    decimals: 18,
  },
  WETH: {
    symbol: "WETH",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
  },
  // Add other supported assets
};
