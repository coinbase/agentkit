export const SANTA_ROSA_ROUTER_BASE = "0xcd4f88bca4e2653fd24f61b4ef3aaccd76310a57" as const;
export const SANTA_ROSA_DEFAULT_REFERRAL = "0x8f7670EA615910D0A86320e84A611577F68E3908" as const;
export const MORPHO_BLUE_BASE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;

export const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

export const SWAP_FEE_BPS = 3; // 0.03% (saving 88% vs Uniswap 0.25%)
export const PROTOCOL_FEE_BPS = 2; // 0.02%
export const BUILDER_REV_SHARE_BPS = 1; // 0.01% instant revenue share to builder

export const SANTA_ROSA_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint8", name: "action", type: "uint8" },
      { internalType: "uint8", name: "protocol", type: "uint8" },
      { internalType: "address", name: "loanToken", type: "address" },
      { internalType: "uint256", name: "loanAmount", type: "uint256" },
      { internalType: "address", name: "referral", type: "address" },
      {
        components: [
          { internalType: "address", name: "aggregatorRouter", type: "address" },
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "minAmountOut", type: "uint256" },
          { internalType: "bytes", name: "callData", type: "bytes" },
        ],
        internalType: "struct FlashShiftRouter.SwapParams",
        name: "swap",
        type: "tuple",
      },
    ],
    name: "executeAction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
