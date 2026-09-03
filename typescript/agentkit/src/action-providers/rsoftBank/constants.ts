export const DEFAULT_BASE_URL = "https://rsoft-agentic-bank.com/api/v1";
export const DEFAULT_TRUST_URL =
  "https://7pdor5bjoty7gyat56u6fgcrue0gbvnd.lambda-url.us-east-1.on.aws";

// EIP-712 domain + struct — MUST match the bank's verifier exactly.
export const CHAIN_ID = 8453;
export const VERIFYING_CONTRACT = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
export const EIP712_DOMAIN_NAME = "RSoft Agentic Bank";
export const EIP712_DOMAIN_VERSION = "1";
export const LOAN_REQUEST_TYPES = {
  LoanRequest: [
    { name: "agentWallet", type: "address" },
    { name: "loanAmountUsdc6", type: "uint256" },
    { name: "nonce", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** Seconds a signed loan request stays valid. */
export const SIGNATURE_TTL_SECONDS = 900;
