/**
 * Default AgentCoin router URL (Base Sepolia testnet deployment).
 */
export const AGENTCOIN_DEFAULT_URL = "https://agentcoinhq.com";

/**
 * Networks supported by the AgentCoin action provider. Testnet only.
 */
export const AGENTCOIN_SUPPORTED_NETWORKS = ["base-sepolia"] as const;

/**
 * Base Sepolia chain id.
 */
export const AGENTCOIN_CHAIN_ID = 84532;

/**
 * CAIP-2 identifier for Base Sepolia.
 */
export const AGENTCOIN_CAIP2 = "eip155:84532";

/**
 * Circle test USDC on Base Sepolia.
 */
export const AGENTCOIN_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * AgentCoin JobEscrow contract on Base Sepolia.
 */
export const AGENTCOIN_ESCROW = "0x4EaF6d09F8C22980Bb16E719779ACe73A7b1CB3D";

/**
 * Address of the AgentCoin operator key that signs scores and delivery records (EIP-191).
 */
export const AGENTCOIN_OPERATOR_SIGNER = "0xf1b27b5Bd659D9Bfb4835777E64B8F8e5C3eCf68";

/**
 * Default per-order payment ceiling in USDC base units (0.05 test USDC).
 */
export const AGENTCOIN_DEFAULT_MAX_PAYMENT = 50_000n;

/**
 * JobEscrow job states, indexed by the on-chain enum value.
 */
export const ESCROW_STATES = [
  "None",
  "Open",
  "Funded",
  "Submitted",
  "Completed",
  "Rejected",
  "Partial",
  "Disputed",
  "Settled",
  "Expired",
  "Cancelled",
] as const;

/**
 * Minimal ERC-20 approve ABI.
 */
export const ERC20_APPROVE_ABI = [
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

/**
 * Subset of the JobEscrow ABI used by this provider.
 */
export const ESCROW_ABI = [
  {
    type: "function",
    name: "createAndFundFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "client", type: "address" },
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "specHash", type: "bytes32" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "timeoutRelease",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "configVersion", type: "uint32" },
          { name: "state", type: "uint8" },
          { name: "outcome", type: "uint8" },
          { name: "accepted", type: "bool" },
          { name: "instant", type: "bool" },
          { name: "payoutBps", type: "uint16" },
          { name: "deadline", type: "uint64" },
          { name: "submittedAt", type: "uint64" },
          { name: "verdictAt", type: "uint64" },
          { name: "disputedAt", type: "uint64" },
          { name: "amount", type: "uint256" },
          { name: "providerBond", type: "uint256" },
          { name: "slashBase", type: "uint256" },
          { name: "specHash", type: "bytes32" },
          { name: "deliverableHash", type: "bytes32" },
          { name: "reasonHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "JobCreated",
    anonymous: false,
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "specHash", type: "bytes32", indexed: false },
      { name: "configVersion", type: "uint32", indexed: false },
    ],
  },
] as const;
