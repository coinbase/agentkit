/**
 * GBLIN vault (Global Balanced Liquidity Index) on Base mainnet. The vault is the ERC-20 share token.
 * Verified source: https://basescan.org/address/0xc2181d975c05c8c724b334bcED0764c0b86B1D53#code
 */
export const GBLIN_ADDRESS = "0xc2181d975c05c8c724b334bcED0764c0b86B1D53";

/**
 * GBLIN Lens: read-only quotes and state for the vault.
 */
export const GBLIN_LENS_ADDRESS = "0xfCFea8027019E8551A1f09AD91532471F5D26f61";

/**
 * GBLIN Zap: redeems shares in kind and sells every basket leg for ETH in one transaction.
 */
export const GBLIN_ZAP_ADDRESS = "0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200";

/**
 * Uniswap V3 fee tier (0.05%) used to route every basket leg in the Zap exit.
 */
export const VENUE_FEE_TIER = 500;

export const GBLIN_ABI = [
  {
    type: "function",
    name: "buyGBLIN",
    stateMutability: "payable",
    inputs: [{ name: "minOut", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isNavReliable",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const GBLIN_LENS_ABI = [
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "ethValue", type: "uint256" },
    ],
    outputs: [
      { name: "out", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "stabilityFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "gblinAmount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "basketLength",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const GBLIN_ZAP_ABI = [
  {
    type: "function",
    name: "sellGBLINForEth",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "venueData", type: "bytes[]" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "ethOut", type: "uint256" }],
  },
] as const;
