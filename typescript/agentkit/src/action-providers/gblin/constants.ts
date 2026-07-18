export const GBLIN_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0";

/**
 * Minimal ABI for the GBLIN V6 index (Global Balanced Liquidity Index) on Base.
 * Verified on Basescan: https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0#code
 */
export const GBLIN_ABI = [
  {
    type: "function",
    name: "buyGBLIN",
    stateMutability: "payable",
    inputs: [{ name: "minGblinOut", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sellGBLINForEth",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gblinAmount", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "quoteBuyGBLIN",
    stateMutability: "view",
    inputs: [{ name: "ethAmount", type: "uint256" }],
    outputs: [
      { name: "gblinOut", type: "uint256" },
      { name: "founderFee", type: "uint256" },
      { name: "stabilityFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteSellGBLIN",
    stateMutability: "view",
    inputs: [{ name: "gblinAmount", type: "uint256" }],
    outputs: [{ name: "ethOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
