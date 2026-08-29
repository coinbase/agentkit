import { Address } from "viem";

// Aerodrome contract addresses on Base Mainnet
export const AERODROME_ROUTER_ADDRESS: Address = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
export const AERODROME_VOTER_ADDRESS: Address = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
export const AERODROME_VOTING_ESCROW_ADDRESS: Address =
  "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4";
export const AERODROME_POOL_FACTORY_ADDRESS: Address =
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
export const AERO_TOKEN_ADDRESS: Address = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";

// Default swap deadline: 10 minutes from now
export const DEFAULT_DEADLINE_SECONDS = 600;

// Default slippage: 1%
export const DEFAULT_SLIPPAGE_BPS = 100;

// Max lock duration: 4 years in seconds (matches VotingEscrow MAXTIME)
export const MAX_LOCK_DURATION = 4 * 365 * 24 * 60 * 60;

// Min lock duration: 1 week in seconds
export const MIN_LOCK_DURATION = 7 * 24 * 60 * 60;

// Epoch duration: 1 week in seconds (Thursday to Thursday)
export const EPOCH_DURATION = 7 * 24 * 60 * 60;

export const AERODROME_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "bool", name: "stable", type: "bool" },
          { internalType: "address", name: "factory", type: "address" },
        ],
        internalType: "struct IRouter.Route[]",
        name: "routes",
        type: "tuple[]",
      },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "bool", name: "stable", type: "bool" },
          { internalType: "address", name: "factory", type: "address" },
        ],
        internalType: "struct IRouter.Route[]",
        name: "routes",
        type: "tuple[]",
      },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "bool", name: "stable", type: "bool" },
      { internalType: "uint256", name: "amountADesired", type: "uint256" },
      { internalType: "uint256", name: "amountBDesired", type: "uint256" },
      { internalType: "uint256", name: "amountAMin", type: "uint256" },
      { internalType: "uint256", name: "amountBMin", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { internalType: "uint256", name: "amountA", type: "uint256" },
      { internalType: "uint256", name: "amountB", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "bool", name: "stable", type: "bool" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
      { internalType: "uint256", name: "amountAMin", type: "uint256" },
      { internalType: "uint256", name: "amountBMin", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "removeLiquidity",
    outputs: [
      { internalType: "uint256", name: "amountA", type: "uint256" },
      { internalType: "uint256", name: "amountB", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "bool", name: "stable", type: "bool" },
      { internalType: "address", name: "_factory", type: "address" },
    ],
    name: "poolFor",
    outputs: [{ internalType: "address", name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // BUG-2 fix: quoteAddLiquidity for proper slippage calculation
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "bool", name: "stable", type: "bool" },
      { internalType: "address", name: "_factory", type: "address" },
      { internalType: "uint256", name: "amountADesired", type: "uint256" },
      { internalType: "uint256", name: "amountBDesired", type: "uint256" },
    ],
    name: "quoteAddLiquidity",
    outputs: [
      { internalType: "uint256", name: "amountA", type: "uint256" },
      { internalType: "uint256", name: "amountB", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // C-3 fix: quoteRemoveLiquidity for safe LP removal with slippage
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "bool", name: "stable", type: "bool" },
      { internalType: "address", name: "_factory", type: "address" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    name: "quoteRemoveLiquidity",
    outputs: [
      { internalType: "uint256", name: "amountA", type: "uint256" },
      { internalType: "uint256", name: "amountB", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const AERODROME_VOTING_ESCROW_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_value", type: "uint256" },
      { internalType: "uint256", name: "_lockDuration", type: "uint256" },
    ],
    name: "createLock",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_value", type: "uint256" },
    ],
    name: "increaseAmount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_lockDuration", type: "uint256" },
    ],
    name: "increaseUnlockTime",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "balanceOfNFT",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "locked",
    outputs: [
      { internalType: "int128", name: "amount", type: "int128" },
      { internalType: "uint256", name: "end", type: "uint256" },
      { internalType: "bool", name: "isPermanent", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // C-2 fix: Correct Deposit event ABI — depositType is indexed and at position 3
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "provider", type: "address" },
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      {
        indexed: true,
        internalType: "enum IVotingEscrow.DepositType",
        name: "depositType",
        type: "uint8",
      },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "locktime", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "ts", type: "uint256" },
    ],
    name: "Deposit",
    type: "event",
  },
] as const;

export const AERODROME_VOTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "address[]", name: "_poolVote", type: "address[]" },
      { internalType: "uint256[]", name: "_weights", type: "uint256[]" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "pool", type: "address" }],
    name: "gauges",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "lastVoted",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "_bribes", type: "address[]" },
      { internalType: "address[][]", name: "_tokens", type: "address[][]" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "claimBribes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "_fees", type: "address[]" },
      { internalType: "address[][]", name: "_tokens", type: "address[][]" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
    ],
    name: "claimFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address[]", name: "_gauges", type: "address[]" }],
    name: "claimRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "gauge", type: "address" }],
    name: "gaugeToBribe",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "gauge", type: "address" }],
    name: "gaugeToFees",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
