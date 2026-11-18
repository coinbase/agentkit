import { type Address } from "viem";

export const SUPPORTED_NETWORKS = ["base-mainnet"];

export const LENDING_MATCHER_ADDRESSES: Record<string, Address> = {
  "base-mainnet": "0x17946cD3e180f82e632805e5549EC913330Bb175",
};

export const FACILITATOR_ADDRESSES: Record<string, Address> = {
  "base-mainnet": "0x58EDdE022FFDAD3Fb0Fb0E7D51eb05AaF66a31f1",
};

export const FACILITATOR_API = "https://credit-api.floelabs.xyz";

export const TOKEN_ADDRESSES: Record<string, Record<string, Address>> = {
  "base-mainnet": {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    weth: "0x4200000000000000000000000000000000000006",
    cbbtc: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  },
};

export const USDC_DECIMALS = 6;

export const LENDING_MATCHER_ABI = [
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "borrowLimit", type: "uint256" },
      { name: "maxRateBps", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "onBehalfOfRestriction", type: "address" },
    ],
    name: "setOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agent", type: "address" },
      { name: "operator", type: "address" },
    ],
    name: "getOperatorPermission",
    outputs: [
      { name: "approved", type: "bool" },
      { name: "borrowLimit", type: "uint256" },
      { name: "borrowed", type: "uint256" },
      { name: "maxRateBps", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "onBehalfOfRestriction", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
