/**
 * Spraay batch payment contract (SprayContract) address on Base Mainnet.
 * Verified on BaseScan / Blockscout.
 */
export const SPRAAY_CONTRACT_ADDRESS = "0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC" as const;

/**
 * Default Spraay protocol fee in basis points (0.3% = 30 bps).
 * The live value is read from the contract's `feeBps` view; this constant is the fallback.
 */
export const SPRAAY_PROTOCOL_FEE_BPS = 30;

/**
 * Maximum number of recipients per transaction (contract-enforced MAX_RECIPIENTS).
 */
export const SPRAAY_MAX_RECIPIENTS = 200;

/**
 * Zero address, used by `sprayEqual` to select native ETH transfers.
 */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Spraay gateway base URL. Hosts free pre-flight endpoints (validate/estimate)
 * and x402-metered execution endpoints (batch execute/estimate, escrow create).
 */
export const SPRAAY_GATEWAY_BASE_URL = "https://gateway.spraay.app";

/**
 * Free (no payment required) gateway endpoint paths.
 */
export const SPRAAY_FREE_VALIDATE_BATCH_PATH = "/free/validate-batch";
export const SPRAAY_FREE_ESTIMATE_BATCH_PATH = "/free/estimate-batch";

/**
 * x402-metered (paid) gateway endpoint paths. Pricing is returned via a
 * 402 Payment Required challenge on first request.
 */
export const SPRAAY_GATEWAY_BATCH_EXECUTE_PATH = "/api/v1/batch/execute";
export const SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH = "/api/v1/batch/estimate";
export const SPRAAY_GATEWAY_ESCROW_CREATE_PATH = "/api/v1/escrow/create";

/**
 * Batch Payment Aggregate (BPA) schema version used by the Spraay gateway.
 */
export const SPRAAY_BPA_VERSION = "1.0";

/**
 * SprayContract ABI — matches the verified contract deployed at
 * SPRAAY_CONTRACT_ADDRESS. Variable-amount functions take an array of
 * (recipient, amount) structs; `sprayEqual` covers the uniform-amount case
 * for both ETH (token = zero address) and ERC-20 tokens.
 */
export const SPRAAY_ABI = [
  {
    name: "sprayETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "recipients",
        type: "tuple[]",
        components: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "sprayToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      {
        name: "recipients",
        type: "tuple[]",
        components: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "sprayEqual",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amountPerRecipient", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "feeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "calculateTotalCost",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "totalAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * ERC-20 ABI fragments needed for approvals, metadata lookups, and
 * EIP-2612 permit support (nonces/version/permit).
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
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "version",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "permit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/**
 * EIP-2612 Permit typed-data structure.
 */
export const EIP2612_PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Validity window for EIP-2612 permit signatures, in seconds.
 */
export const PERMIT_DEADLINE_SECONDS = 1800;
