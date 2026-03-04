/**
 * Spraay contract address on Base Mainnet.
 */
export const SPRAAY_CONTRACT_ADDRESS = "0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC" as const;

/**
 * Spraay protocol fee in basis points (0.3% = 30 bps).
 */
export const SPRAAY_PROTOCOL_FEE_BPS = 30;

/**
 * Maximum number of recipients per transaction.
 */
export const SPRAAY_MAX_RECIPIENTS = 200;

/**
 * Spraay contract ABI — only the functions needed for the action provider.
 */
export const SPRAAY_ABI = [
  {
    name: "sprayETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "recipients",
        type: "address[]",
      },
      {
        name: "amounts",
        type: "uint256[]",
      },
    ],
    outputs: [],
  },
  {
    name: "sprayToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "token",
        type: "address",
      },
      {
        name: "recipients",
        type: "address[]",
      },
      {
        name: "amounts",
        type: "uint256[]",
      },
    ],
    outputs: [],
  },
] as const;

/**
 * Standard ERC-20 ABI fragments needed for token approval and decimals lookup.
 */
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
