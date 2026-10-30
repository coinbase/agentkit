import { parseAbi } from "viem";

/** Robinhood Chain, where Priors' pool and USDG live. */
export const ROBINHOOD_CHAIN_ID = "4663";
export const ROBINHOOD_NETWORK = "eip155:4663";

/** Priors' credit pool (CreditPoolV2) on Robinhood Chain. */
export const PRIORS_POOL = "0x281210097f0de7A8FB6F87310AF0f089c9C8DE21" as const;

/** USDG (Global Dollar) on Robinhood Chain: what lines are drawn and x402 payments settled in. */
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const USDG_DECIMALS = 6;

/** Priors' public read API (records and lines, no key). */
export const PRIORS_API = "https://priors.trade";

/** Default loan term when borrowing the gap of a payment: 7 days. */
export const DEFAULT_TERM_DAYS = 7;

export const POOL_ABI = parseAbi([
  "function getParams() view returns ((uint256 minLoan, uint256 maxLoan, uint64 minTerm, uint64 maxTerm, uint64 grace, uint64 minScoreTerm, uint256 feeBps, uint256 sponsorFeeBps, uint256 protocolFeeBps, uint256 minStake, uint256 maxUtilizationBps, uint256 keeperBounty))",
  "function quoteFee(uint256 agentId, uint256 principal, uint64 term) view returns (uint256 fee, uint256 sponsorCut, uint256 reserveCut, uint256 premium)",
  "function borrow(uint256 agentId, uint256 amount, uint64 term, address to, uint256 maxFee) returns (uint256)",
  "function repay(uint256 loanId, uint256 expectedAgentId, uint256 maxDue)",
  "function getLoan(uint256 loanId) view returns ((uint256 agentId, uint256 sponsorId, uint256 principal, uint256 fee, uint256 sponsorCut, uint256 reserveCut, uint256 premium, address owner, uint64 issuedAt, uint64 dueAt, uint64 defaultableAt, uint64 minScoreTerm, uint64 closedAt, uint8 status))",
  "event Borrowed(uint256 indexed loanId, uint256 indexed agentId, uint256 indexed sponsorId, uint256 principal, uint256 fee, uint64 dueAt, address to)",
]);

/** Loan status 1 is active in CreditPoolV2. */
export const LOAN_ACTIVE = 1;
