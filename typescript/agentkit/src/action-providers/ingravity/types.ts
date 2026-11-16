/**
 * @file types.ts
 * @description TypeScript interface definitions for Ingravity Security Action Provider.
 */

export interface IngravityActionProviderConfig {
  /**
   * Endpoint for the Ingravity Cloudflare Worker gateway.
   * Defaults to https://red-shape-1b3b.daviddelmoral79.workers.dev
   */
  workerUrl?: string;

  /**
   * Treasury receiver address on Base Mainnet.
   * Defaults to 0xAA99e12320a3db0116ef56D2e19F70f6796Bad0f
   */
  payToWallet?: string;

  /**
   * Maximum allowed USDC expenditure per action call.
   * If an action requires more than this cap, it auto-negotiates to ESSENTIAL tier or halts.
   */
  maxSpendUsdc?: number;

  /**
   * Capital at risk in USD under the agent's management.
   */
  capitalAtRiskUsd?: number;

  /**
   * Whether to enable local session receipt caching (X-Ingravity-Receipt-Token).
   * Prevents paying twice for identical queries in the same agent session.
   * Defaults to true.
   */
  enableReceiptCache?: boolean;
}

export interface X402PaymentRequirement {
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  tier?: string;
  facilitator?: string;
}

export interface FastPingResult {
  address: string;
  chainId: number;
  verdict: "SAFE" | "DANGER" | "UNKNOWN_UNVERIFIED_RPC";
  isSafe: boolean;
  costUsdc: string;
  txHash?: string;
  timestamp: string;
}

export interface TxFirewallResult {
  allowed: boolean;
  action: "PROCEED" | "BLOCK_DRAINER" | "WARN_UNVERIFIED";
  riskScore: number;
  flags: string[];
  simulationSummary?: string;
  recommendedRevocations?: string[];
  safeHarborRescueBundle?: {
    calldata: string;
    builderAttribution: string;
    splits: { owner: string; whitehatRescueFee: string };
  };
  costUsdc: string;
  receiptToken?: string;
}

export interface TokenRugResult {
  tokenAddress: string;
  chainId: number;
  riskScore: number;
  isHoneypot: boolean;
  isProxy: boolean;
  ownerPrivileges: string[];
  findings: string[];
  costUsdc: string;
}

export interface DefiMathResult {
  poolAddress: string;
  slippageBps: number;
  mevRisk: "LOW" | "MEDIUM" | "HIGH";
  expectedOutput: string;
  minOutputWithTolerance: string;
  costUsdc: string;
}

export interface AuditSolidityResult {
  status: "PASSED" | "FAILED_VULNERABILITIES_FOUND";
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  findings: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    line?: number;
  }>;
  costUsdc: string;
}
