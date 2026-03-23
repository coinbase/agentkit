import { Hex } from "viem";

/**
 * PayLobster contract addresses on Base Mainnet (Chain ID: 8453)
 */
export const PAYLOBSTER_CONTRACTS = {
  IDENTITY: "0xA174ee274F870631B3c330a85EBCad74120BE662" as Hex,
  REPUTATION: "0x02bb4132a86134684976E2a52E43D59D89E64b29" as Hex,
  CREDIT: "0x4c22B52eacAB9eD2Ce018d032739a93eC68eD27a" as Hex,
  ESCROW_V3: "0x703B528C1b07cd27992af9Ae11DD67bE685E489e" as Hex,
  SPENDING_MANDATE: "0xd146b6279fb434646d0a6D7D7083ecC2648093f0" as Hex,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Hex,
} as const;

export const BASE_CHAIN_ID = 8453;

/**
 * Identity Contract ABI (minimal - only functions we use)
 */
export const IDENTITY_ABI = [
  {
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "name", type: "string" },
      { name: "capabilities", type: "string" },
    ],
    name: "register",
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getAgentInfo",
    outputs: [
      { name: "name", type: "string" },
      { name: "tokenId", type: "uint256" },
      { name: "registered", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Reputation Contract ABI (minimal - only functions we use)
 */
export const REPUTATION_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getReputation",
    outputs: [
      { name: "score", type: "uint256" },
      { name: "trustVector", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Credit Score Contract ABI (minimal - only functions we use)
 */
export const CREDIT_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getCreditScore",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getCreditStatus",
    outputs: [
      { name: "limit", type: "uint256" },
      { name: "available", type: "uint256" },
      { name: "inUse", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Escrow Contract ABI (minimal - only functions we use)
 */
export const ESCROW_ABI = [
  {
    inputs: [
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "creditAmount", type: "uint256" },
      { name: "description", type: "string" },
    ],
    name: "createAndFundEscrow",
    outputs: [{ name: "escrowId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "releaseEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getEscrow",
    outputs: [
      {
        components: [
          { name: "id", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "collateralAmount", type: "uint256" },
          { name: "creditAmount", type: "uint256" },
          { name: "loanId", type: "uint256" },
          { name: "description", type: "string" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "completedAt", type: "uint256" },
          { name: "disputeDeadline", type: "uint256" },
          { name: "buyerRated", type: "bool" },
          { name: "sellerRated", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextEscrowId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * USDC Contract ABI (minimal - only functions we use)
 */
export const USDC_ABI = [
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
] as const;
