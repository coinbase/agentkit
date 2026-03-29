/**
 * Pendle Finance contract addresses and ABIs for Base chain.
 *
 * Pendle uses a Diamond Proxy (EIP-2535) Router V4 that delegates
 * to multiple facets for swaps, liquidity, and misc actions.
 */

export const PENDLE_ROUTER_V4 = "0x888888888889758F76e7103c6CbF23ABbF58F946";
export const PENDLE_ROUTER_STATIC = "0xB4205a645c7e920BD8504181B1D7f2c5C955C3e7";

export const PENDLE_API_BASE = "https://api-v2.pendle.finance/core";

export const SUPPORTED_CHAIN_IDS: Record<string, number> = {
  "base-mainnet": 8453,
};

/**
 * Minimal Router V4 ABI — only the "Simple" functions that don't require
 * ApproxParams or LimitOrderData, plus redeem for claiming rewards.
 */
export const PENDLE_ROUTER_ABI = [
  // swapExactTokenForPt (full version for calldata from API)
  {
    inputs: [
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "address", name: "market", type: "address" },
      { internalType: "uint256", name: "minPtOut", type: "uint256" },
      {
        components: [
          { internalType: "uint256", name: "guessMin", type: "uint256" },
          { internalType: "uint256", name: "guessMax", type: "uint256" },
          { internalType: "uint256", name: "guessOffchain", type: "uint256" },
          { internalType: "uint256", name: "maxIteration", type: "uint256" },
          { internalType: "uint256", name: "eps", type: "uint256" },
        ],
        internalType: "struct ApproxParams",
        name: "guessPtOut",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "uint256", name: "netTokenIn", type: "uint256" },
          { internalType: "address", name: "tokenMintSy", type: "address" },
          { internalType: "address", name: "pendleSwap", type: "address" },
          {
            components: [
              { internalType: "enum SwapType", name: "swapType", type: "uint8" },
              { internalType: "address", name: "extRouter", type: "address" },
              { internalType: "bytes", name: "extCalldata", type: "bytes" },
              { internalType: "bool", name: "needScale", type: "bool" },
            ],
            internalType: "struct SwapData",
            name: "swapData",
            type: "tuple",
          },
        ],
        internalType: "struct TokenInput",
        name: "input",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "limitRouter", type: "address" },
          { internalType: "uint256", name: "epsSkipMarket", type: "uint256" },
          {
            components: [
              {
                components: [
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  { internalType: "uint256", name: "expiry", type: "uint256" },
                  { internalType: "uint256", name: "nonce", type: "uint256" },
                  { internalType: "enum IPLimitRouter.OrderType", name: "orderType", type: "uint8" },
                  { internalType: "address", name: "token", type: "address" },
                  { internalType: "address", name: "YT", type: "address" },
                  { internalType: "address", name: "maker", type: "address" },
                  { internalType: "address", name: "receiver", type: "address" },
                  { internalType: "uint256", name: "makingAmount", type: "uint256" },
                  { internalType: "uint256", name: "lnImpliedRate", type: "uint256" },
                  { internalType: "uint256", name: "failSafeRate", type: "uint256" },
                  { internalType: "bytes", name: "permit", type: "bytes" },
                ],
                internalType: "struct IPLimitRouter.Order",
                name: "order",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "uint256", name: "makingAmount", type: "uint256" },
            ],
            internalType: "struct IPLimitRouter.FillOrderParams[]",
            name: "normalFills",
            type: "tuple[]",
          },
          {
            components: [
              {
                components: [
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  { internalType: "uint256", name: "expiry", type: "uint256" },
                  { internalType: "uint256", name: "nonce", type: "uint256" },
                  { internalType: "enum IPLimitRouter.OrderType", name: "orderType", type: "uint8" },
                  { internalType: "address", name: "token", type: "address" },
                  { internalType: "address", name: "YT", type: "address" },
                  { internalType: "address", name: "maker", type: "address" },
                  { internalType: "address", name: "receiver", type: "address" },
                  { internalType: "uint256", name: "makingAmount", type: "uint256" },
                  { internalType: "uint256", name: "lnImpliedRate", type: "uint256" },
                  { internalType: "uint256", name: "failSafeRate", type: "uint256" },
                  { internalType: "bytes", name: "permit", type: "bytes" },
                ],
                internalType: "struct IPLimitRouter.Order",
                name: "order",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "uint256", name: "makingAmount", type: "uint256" },
            ],
            internalType: "struct IPLimitRouter.FillOrderParams[]",
            name: "flashFills",
            type: "tuple[]",
          },
          { internalType: "bytes", name: "optData", type: "bytes" },
        ],
        internalType: "struct LimitOrderData",
        name: "limit",
        type: "tuple",
      },
    ],
    name: "swapExactTokenForPt",
    outputs: [
      { internalType: "uint256", name: "netPtOut", type: "uint256" },
      { internalType: "uint256", name: "netSyFee", type: "uint256" },
      { internalType: "uint256", name: "netSyInterm", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  // redeemDueInterestAndRewards
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "address[]", name: "sys", type: "address[]" },
      { internalType: "address[]", name: "yts", type: "address[]" },
      { internalType: "address[]", name: "markets", type: "address[]" },
    ],
    name: "redeemDueInterestAndRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
