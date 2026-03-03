import type { Address } from "viem";

/** Deployed Agora402Escrow contract addresses on Base. */
export const ESCROW_ADDRESSES: Record<number, Address> = {
  8453: "0xDcA5E5Dd1E969A4b824adDE41569a5d80A965aDe",
  84532: "0x9Ea8c817bFDfb15FA50a30b08A186Cb213F11BCC",
};

/** Deployed Agora402Reputation contract addresses on Base. */
export const REPUTATION_ADDRESSES: Record<number, Address> = {
  8453: "0x9Ea8c817bFDfb15FA50a30b08A186Cb213F11BCC",
  84532: "0x2A216a829574e88dD632e7C95660d43bCE627CDf",
};

/** Circle USDC addresses on Base. */
export const USDC_ADDRESSES: Record<number, Address> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

export const USDC_DECIMALS = 6;

/** Human-readable escrow state names. */
export const STATE_NAMES: Record<number, string> = {
  0: "Created",
  1: "Funded",
  2: "Released",
  3: "Disputed",
  4: "Resolved",
  5: "Expired",
  6: "Refunded",
};

/** Minimal ABIs — only the functions we call. */
export const ESCROW_ABI = [
  {
    type: "function",
    name: "createAndFund",
    inputs: [
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "timelockDuration", type: "uint256" },
      { name: "serviceHash", type: "bytes32" },
    ],
    outputs: [{ name: "escrowId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "release",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dispute",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEscrow",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "serviceHash", type: "bytes32" },
    ],
    stateMutability: "view",
  },
] as const;

export const REPUTATION_ABI = [
  {
    type: "function",
    name: "getReputation",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "totalCompleted", type: "uint64" },
      { name: "totalDisputed", type: "uint64" },
      { name: "totalRefunded", type: "uint64" },
      { name: "totalAsProvider", type: "uint64" },
      { name: "totalAsClient", type: "uint64" },
      { name: "totalVolume", type: "uint256" },
      { name: "firstSeen", type: "uint256" },
      { name: "lastSeen", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getScore",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "score", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
