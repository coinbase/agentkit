/**
 * @file ingravityActionProvider.ts
 * @description Coinbase AgentKit Action Provider for Ingravity Autonomous 5-EVM Web3 Security.
 * Integrates $0.01 Fast-Ping, Pre-Flight Transaction Firewall, Token Rugpull Scanner,
 * DeFi Math Slippage Guard, Solidity Audit, Protocol Dossier, and Deep Exploit Bounties with x402 v2 payments.
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

import {
  INGRAVITY_WORKER_URL,
  INGRAVITY_PAY_TO_WALLET,
  BASE_USDC_CONTRACT,
  BASE_CHAIN_ID,
  ERC8021_BUILDER_CODE,
  ERC8021_SUFFIX_HEX,
  INGRAVITY_ACTION_PROVIDER_NAME,
} from "./constants";

import {
  FastPingSchema,
  TxFirewallSchema,
  TokenRugScannerSchema,
  DefiMathGuardSchema,
  AuditSoliditySchema,
  ProtocolDossierSchema,
  DeepExploitBountySchema,
} from "./schemas";

import { IngravityActionProviderConfig } from "./types";

/**
 * Appends the Base Builder Code (ERC-8021) suffix to transaction calldata.
 */
export function encodeErc8021Calldata(calldataHex: string = "0x"): string {
  const clean = String(calldataHex || "0x").trim();
  const normalized = clean.startsWith("0x") || clean.startsWith("0X") ? clean.slice(2) : clean;
  if (!/^[0-9a-fA-F]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex calldata passed to encodeErc8021Calldata");
  }
  const lower = normalized.toLowerCase();
  if (lower.endsWith(ERC8021_SUFFIX_HEX.toLowerCase())) {
    return "0x" + lower;
  }
  return "0x" + lower + ERC8021_SUFFIX_HEX;
}

/**
 * IngravitySecurityActionProvider
 *
 * Implements deterministic EVM pre-flight security tools with autonomous x402 v2 micropayment settlement.
 * Protects autonomous AI agents against drainers, malicious proxies, and honeypots on Base and peer EVMs.
 */
export class IngravityActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: Required<Omit<IngravityActionProviderConfig, "maxSpendUsdc" | "capitalAtRiskUsd">> & {
    maxSpendUsdc: number | null;
    capitalAtRiskUsd: number | null;
  };
  private readonly receiptCache: Map<string, string>;

  constructor(config: IngravityActionProviderConfig = {}) {
    super(INGRAVITY_ACTION_PROVIDER_NAME, []);
    this.config = {
      workerUrl: (config.workerUrl || INGRAVITY_WORKER_URL).replace(/\/$/, ""),
      payToWallet: config.payToWallet || INGRAVITY_PAY_TO_WALLET,
      maxSpendUsdc: config.maxSpendUsdc != null ? Number(config.maxSpendUsdc) : null,
      capitalAtRiskUsd: config.capitalAtRiskUsd != null ? Number(config.capitalAtRiskUsd) : null,
      enableReceiptCache: config.enableReceiptCache !== false,
    };
    this.receiptCache = new Map();
  }

  /**
   * Supports any EVM-compatible network.
   */
  supportsNetwork = (network: Network): boolean => {
    return network.protocolFamily === "evm";
  };

  /**
   * Action 1: ingravity_fast_ping
   * $0.01 USDC binary SAFE/DANGER address gate.
   */
  @CreateAction({
    name: "ingravity_fast_ping",
    description:
      "Ultra-low-cost binary SAFE/DANGER address gate across 5 EVM chains ($0.01 USDC flat via x402). " +
      "Built for high-frequency bots with strict <=$0.05 auto-pay limits. Returns boolean SAFE/DANGER only (zero forensic leaks).",
    schema: FastPingSchema,
  })
  async fastPing(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FastPingSchema>,
  ): Promise<string> {
    const chainId = args.chainId || BASE_CHAIN_ID;
    const path = `/fast-ping?address=${encodeURIComponent(args.address)}&chainId=${chainId}`;
    const result = await this.executeX402Request(walletProvider, "GET", path, null, {
      tier: "ESSENTIAL",
      ticketId: args.address,
    });
    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 2: ingravity_tx_firewall
   * Pre-flight simulation, drainer interception & EIP-5792 rescue bundle ($0.10 USDC + 0.15% pre-flight).
   */
  @CreateAction({
    name: "ingravity_tx_firewall",
    description:
      "Pre-flight transaction firewall and anti-drainer simulator ($0.10 USDC). " +
      "Simulates execution before signing, checks EIP-1967/1167 proxy storage, blocks infinite approvals, and generates EIP-5792 rescue bundles.",
    schema: TxFirewallSchema,
  })
  async txFirewall(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TxFirewallSchema>,
  ): Promise<string> {
    const payload = {
      to: args.to,
      data: args.data || "0x",
      value: args.value || "0",
      chainId: args.chainId || BASE_CHAIN_ID,
      victimWallet: args.victimWallet || (await walletProvider.getAddress()),
      capitalAtRiskUsd: args.capitalAtRiskUsd || this.config.capitalAtRiskUsd || undefined,
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/tx-firewall",
      payload,
      { ticketId: args.to },
    );

    // If a rescue calldata was emitted, ensure ERC-8021 builder attribution is attached
    if (result && typeof result === "object" && result.safeHarborRescueBundle?.calldata) {
      result.safeHarborRescueBundle.calldata = encodeErc8021Calldata(
        result.safeHarborRescueBundle.calldata,
      );
      result.safeHarborRescueBundle.builderAttribution = ERC8021_BUILDER_CODE;
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 3: ingravity_token_rug_scanner
   * Live EVM RPC ERC-20 honeypot and rugpull analysis ($0.12 / $0.04 USDC).
   */
  @CreateAction({
    name: "ingravity_token_rug_scanner",
    description:
      "Audits EVM ERC-20 tokens directly by address across 5 chains ($0.12 Full / $0.04 Essential). " +
      "Disassembles bytecode via live RPC, scans proxy implementations, owner privileges, and honeypot traps without source code.",
    schema: TokenRugScannerSchema,
  })
  async tokenRugScanner(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenRugScannerSchema>,
  ): Promise<string> {
    const payload = {
      tokenAddress: args.tokenAddress,
      chainId: args.chainId || BASE_CHAIN_ID,
      tier: args.tier || "FULL",
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/token-rug-scanner",
      payload,
      { tier: args.tier, ticketId: args.tokenAddress },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 4: ingravity_defi_math_guard
   * Exact BigInt AMM slippage, MEV sandwich guard, and liquidity calculation ($0.10 / $0.04 USDC).
   */
  @CreateAction({
    name: "ingravity_defi_math_guard",
    description:
      "Computes exact BigInt AMM slippage and MEV anti-sandwich bounds on Uniswap v3 & Aerodrome ($0.10 Full / $0.04 Essential). " +
      "Verifies execution boundaries to guarantee the agent is not frontrun or exploited.",
    schema: DefiMathGuardSchema,
  })
  async defiMathGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DefiMathGuardSchema>,
  ): Promise<string> {
    const payload = {
      poolAddress: args.poolAddress,
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      amountIn: args.amountIn,
      chainId: args.chainId || BASE_CHAIN_ID,
      tier: args.tier || "FULL",
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/defi-math-guard",
      payload,
      { tier: args.tier, ticketId: args.poolAddress },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 5: ingravity_audit_solidity
   * Deterministic 24-vector static security audit ($0.85 / $0.35 USDC).
   */
  @CreateAction({
    name: "ingravity_audit_solidity",
    description:
      "Deterministic 24-vector static security audit for Solidity smart contracts ($0.85 Full / $0.35 Essential). " +
      "Applies Anti-Bypass critical fix sealing and live TVL Safe-Harbor split calculations.",
    schema: AuditSoliditySchema,
  })
  async auditSolidity(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AuditSoliditySchema>,
  ): Promise<string> {
    const payload = {
      sourceCode: args.sourceCode,
      contractAddress: args.contractAddress,
      tier: args.tier || "FULL",
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/audit-solidity",
      payload,
      { tier: args.tier, ticketId: args.contractAddress || "solidity_source" },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 6: ingravity_protocol_dossier
   * Multi-contract cross-reentrancy graph ($12.00 / $3.50 USDC).
   */
  @CreateAction({
    name: "ingravity_protocol_dossier",
    description:
      "Multi-contract cross-reentrancy and oracle invariant graph ($12.00 Full / $3.50 Essential). " +
      "Audits cross-contract call graphs and flash-loan vulnerability vectors across multiple protocol contracts.",
    schema: ProtocolDossierSchema,
  })
  async protocolDossier(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ProtocolDossierSchema>,
  ): Promise<string> {
    const payload = {
      targetId: args.targetId,
      contracts: args.contracts,
      tier: args.tier || "FULL",
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/protocol-dossier",
      payload,
      { tier: args.tier, ticketId: args.targetId },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Action 7: ingravity_deep_exploit_bounty
   * Institutional flash-loan simulation + Safe-Harbor rescue ($45.00 / $9.50 USDC).
   */
  @CreateAction({
    name: "ingravity_deep_exploit_bounty",
    description:
      "Institutional flash-loan simulation + EIP-5792 atomic Safe-Harbor whitehat rescue split ($45.00 Full / $9.50 Essential). " +
      "90%-95% owner recovery, 5%-10% automated bounty execution calldata.",
    schema: DeepExploitBountySchema,
  })
  async deepExploitBounty(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DeepExploitBountySchema>,
  ): Promise<string> {
    const payload = {
      targetId: args.targetId,
      contracts: args.contracts,
      simulateRescue: args.simulateRescue !== false,
      tier: args.tier || "FULL",
    };

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      "/deep-exploit-bounty",
      payload,
      { tier: args.tier, ticketId: args.targetId },
    );

    if (result && typeof result === "object" && result.rescueCalldata) {
      result.rescueCalldata = encodeErc8021Calldata(result.rescueCalldata);
      result.builderAttribution = ERC8021_BUILDER_CODE;
    }

    return JSON.stringify(result, null, 2);
  }

  // ==========================================================================
  // INTERNAL X402 PROTOCOL CLIENT & SETTLEMENT ENGINE
  // ==========================================================================

  private async executeX402Request(
    walletProvider: EvmWalletProvider,
    method: "GET" | "POST",
    path: string,
    body: any,
    options: { tier?: string; ticketId?: string } = {},
  ): Promise<any> {
    const url = `${this.config.workerUrl}${path}`;
    const cacheKey = `${path}::${options.ticketId || ""}`.toLowerCase();

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "coinbase-agentkit-ingravity/1.3.0",
    };

    if (options.tier) {
      headers["X-Agent-Budget"] = options.tier;
    }

    // Check session receipt cache
    if (this.config.enableReceiptCache && this.receiptCache.has(cacheKey)) {
      headers["X-Ingravity-Receipt-Token"] = this.receiptCache.get(cacheKey)!;
    }

    let requestInit: RequestInit = {
      method,
      headers: { ...headers },
    };

    if (method === "POST" && body) {
      headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }

    // Initial Probe Request
    let response = await fetch(url, requestInit);

    // If 200 OK directly (e.g. cached receipt was accepted)
    if (response.ok) {
      const data = await response.json();
      return data;
    }

    // If not 402 Payment Required, throw error with server details
    if (response.status !== 402) {
      const errText = await response.text();
      throw new Error(`Ingravity gateway returned status ${response.status}: ${errText}`);
    }

    // Process HTTP 402 Payment Challenge
    const paymentReq = await this.parse402Challenge(response);

    // Enforce maxSpendUsdc guardrail
    const requiredAmountNum = parseFloat(paymentReq.amount);
    if (this.config.maxSpendUsdc != null && requiredAmountNum > this.config.maxSpendUsdc) {
      throw new Error(
        `Action requires $${paymentReq.amount} USDC, exceeding configured maxSpendUsdc limit of $${this.config.maxSpendUsdc} USDC.`,
      );
    }

    // Execute On-Chain Settlement on Base Mainnet
    const paymentProof = await this.settlePayment(walletProvider, paymentReq);

    // Resend Request with Authorization Header
    headers["Authorization"] = `x402 ${paymentProof}`;
    requestInit.headers = { ...headers };

    response = await fetch(url, requestInit);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ingravity gateway rejected payment authorization (${response.status}): ${errText}`);
    }

    const payload = await response.json();

    // Cache receipt token if emitted
    const receiptToken =
      response.headers.get("X-Ingravity-Receipt-Token") ||
      (payload && typeof payload === "object" ? payload.receiptToken : null);

    if (this.config.enableReceiptCache && receiptToken) {
      this.receiptCache.set(cacheKey, receiptToken);
    }

    return payload;
  }

  private async parse402Challenge(response: Response): Promise<{
    network: string;
    asset: string;
    payTo: string;
    amount: string;
    facilitator?: string;
  }> {
    let authHeader = response.headers.get("WWW-Authenticate") || "";
    let bodyData: any = {};
    try {
      bodyData = await response.json();
    } catch (_) {}

    const amount =
      bodyData.amountRequired ||
      bodyData.amount ||
      this.extractHeaderParam(authHeader, "amount") ||
      "0.01";

    const payTo =
      bodyData.payTo ||
      this.extractHeaderParam(authHeader, "payTo") ||
      this.config.payToWallet;

    const asset =
      bodyData.asset ||
      this.extractHeaderParam(authHeader, "asset") ||
      BASE_USDC_CONTRACT;

    const network =
      bodyData.network ||
      this.extractHeaderParam(authHeader, "network") ||
      "eip155:8453";

    return {
      network,
      asset,
      payTo,
      amount: String(amount),
      facilitator: bodyData.facilitator,
    };
  }

  private extractHeaderParam(header: string, param: string): string | null {
    const regex = new RegExp(`${param}=["']?([^"',\\s]+)["']?`, "i");
    const match = header.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Executes micropayment in Base USDC via EvmWalletProvider.
   * Encodes standard ERC-20 transfer(address to, uint256 amount) with 6 decimals.
   */
  private async settlePayment(
    walletProvider: EvmWalletProvider,
    paymentReq: { asset: string; payTo: string; amount: string; network: string },
  ): Promise<string> {
    const rawUnits = Math.round(parseFloat(paymentReq.amount) * 1_000_000);
    const amountHex = rawUnits.toString(16).padStart(64, "0");
    const cleanPayTo = paymentReq.payTo.replace(/^0x/i, "").padStart(64, "0");

    // ERC-20 transfer(address,uint256) selector: 0xa9059cbb
    const transferCalldata = `0xa9059cbb${cleanPayTo}${amountHex}`;

    // Append Base Builder Code attribution
    const finalCalldata = encodeErc8021Calldata(transferCalldata);

    const txHash = await walletProvider.sendTransaction({
      to: paymentReq.asset as `0x${string}`,
      data: finalCalldata as `0x${string}`,
      value: BigInt(0),
    });

    await walletProvider.waitForTransactionReceipt(txHash);

    return JSON.stringify({
      scheme: "erc20_transfer",
      txHash,
      payer: await walletProvider.getAddress(),
      payTo: paymentReq.payTo,
      amount: paymentReq.amount,
      network: paymentReq.network,
      builderCode: ERC8021_BUILDER_CODE,
    });
  }
}

/**
 * Factory function for convenient instantiation.
 */
export const ingravityActionProvider = (config?: IngravityActionProviderConfig) =>
  new IngravityActionProvider(config);
