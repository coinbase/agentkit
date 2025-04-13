import { Abi } from "viem";

export const AERO_ADDRESS = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
export const VOTING_ESCROW_ADDRESS = "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4";
export const VOTER_ADDRESS = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
export const ROUTER_ADDRESS = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

// --- ABIs ---

export const AERO_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export const VOTING_ESCROW_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_value", type: "uint256" },
      { internalType: "uint256", name: "_lockDuration", type: "uint256" },
    ],
    name: "create_lock",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_value", type: "uint256" },
    ],
    name: "increase_amount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_lockDuration", type: "uint256" },
    ],
    name: "increase_unlock_time",
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
    name: "locked",
    outputs: [
      {
        components: [
          { internalType: "int128", name: "amount", type: "int128" },
          { internalType: "uint256", name: "end", type: "uint256" },
          { internalType: "bool", name: "isPermanent", type: "bool" },
        ],
        internalType: "struct IVotingEscrow.LockedBalance",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
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
    inputs: [{ internalType: "address", name: "_owner", type: "address" }],
    name: "balanceOf",
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
] as const satisfies Abi;

export const VOTER_ABI = [
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
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "lastVoted",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_pool", type: "address" }],
    name: "gauges",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pools",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "arg0", type: "uint256" }],
    name: "poolVote",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "arg0", type: "uint256" },
      { internalType: "address", name: "arg1", type: "address" },
    ],
    name: "votes",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export const ROUTER_ABI = [
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
] as const satisfies Abi;

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;
