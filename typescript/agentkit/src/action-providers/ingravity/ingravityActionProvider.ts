import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  BASE_CAIP2_NETWORK,
  BASE_CHAIN_ID,
  BASE_USDC_CONTRACT,
  ERC8021_SUFFIX_HEX,
  INGRAVITY_ACTION_PROVIDER_NAME,
  INGRAVITY_ROUTES,
  INGRAVITY_SDK_VERSION,
  INGRAVITY_WORKER_URL,
  USDC_DECIMALS,
} from "./constants";
import {
  AuditSoliditySchema,
  DeepExploitBountySchema,
  DefiMathGuardSchema,
  FastPingSchema,
  ProtocolDossierSchema,
  TokenRugScannerSchema,
  TxFirewallSchema,
} from "./schemas";
import {
  IngravityActionProviderConfig,
  IngravityExecutionOptions,
  X402AcceptOption,
  X402ChallengePayload,
} from "./types";

interface ResolvedIngravityConfig {
  workerUrl: string;
  maxSpendUsdc: number | null;
  capitalAtRiskUsd: number | null;
  enableReceiptCache: boolean;
}

/**
 * Appends the Base ERC-8021 builder attribution suffix to hexadecimal transaction calldata.
 *
 * @param calldataHex - Hex-encoded EVM calldata (defaults to "0x")
 * @returns Calldata with the ERC-8021 attribution suffix appended once
 */
export function encodeErc8021Calldata(calldataHex = "0x"): string {
  const clean = String(calldataHex || "0x").trim();
  const normalized = clean.startsWith("0x") || clean.startsWith("0X") ? clean.slice(2) : clean;
  if (!/^[0-9a-fA-F]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex calldata passed to encodeErc8021Calldata");
  }
  const lower = normalized.toLowerCase();
  if (lower.endsWith(ERC8021_SUFFIX_HEX.toLowerCase())) {
    return `0x${lower}`;
  }
  return `0x${lower}${ERC8021_SUFFIX_HEX}`;
}

/**
 * IngravityActionProvider provides 5-EVM pre-flight security, honeypot forensics,
 * exact BigInt DeFi MEV protection, and Solidity auditing settled via native x402 v2 USDC on Base.
 */
export class IngravityActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: ResolvedIngravityConfig;
  private readonly receiptCache: Map<string, string>;

  /**
   * Creates a new instance of IngravityActionProvider.
   *
   * @param config - Optional gateway, spending cap, and session receipt cache configuration
   */
  constructor(config: IngravityActionProviderConfig = {}) {
    super(INGRAVITY_ACTION_PROVIDER_NAME, []);
    this.config = {
      workerUrl: (config.workerUrl ?? INGRAVITY_WORKER_URL).replace(/\/$/, ""),
      maxSpendUsdc: config.maxSpendUsdc != null ? Number(config.maxSpendUsdc) : null,
      capitalAtRiskUsd: config.capitalAtRiskUsd != null ? Number(config.capitalAtRiskUsd) : null,
      enableReceiptCache: config.enableReceiptCache !== false,
    };
    this.receiptCache = new Map<string, string>();
  }

  /**
   * Checks whether this action provider supports the given network.
   *
   * @param network - The target blockchain network
   * @returns True if the network uses the EVM protocol family
   */
  supportsNetwork = (network: Network): boolean => {
    return network.protocolFamily === "evm";
  };

  /**
   * Executes a $0.01 USDC binary SAFE/DANGER address gate across 5 EVM chains.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 EIP-3009 settlement
   * @param args - Target EVM address and optional chainId
   * @returns JSON string with the binary SAFE/DANGER verdict
   */
  @CreateAction({
    name: "ingravity_fast_ping",
    description:
      "Ultra-low-cost binary SAFE/DANGER address gate across 5 EVM chains ($0.01 USDC flat via x402 v2 on Base). Built for high-frequency bots with strict <=$0.05 auto-pay limits.",
    schema: FastPingSchema,
  })
  async fastPing(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FastPingSchema>,
  ): Promise<string> {
    const chainId = args.chainId ?? BASE_CHAIN_ID;
    const encodedAddr = encodeURIComponent(args.address);
    const path = `${INGRAVITY_ROUTES.FAST_PING}?address=${encodedAddr}&chainId=${chainId}`;
    const result = await this.executeX402Request(walletProvider, "GET", path, null, {
      cacheTarget: `${args.address}:${chainId}`,
    });
    return JSON.stringify(result, null, 2);
  }

  /**
   * Inspects EVM transaction calldata before signing to block drainers and infinite approvals.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - Destination address, calldata, optional sender, value, chainId, and risk metadata
   * @returns JSON string with firewall verdict, decoded action, and unsigned revocation calldata
   */
  @CreateAction({
    name: "ingravity_tx_firewall",
    description:
      "Pre-flight EVM transaction firewall and anti-drainer simulator ($0.10 USDC via x402 v2 on Base). Decodes calldata, inspects live EIP-1967/1167 proxy slots across 5 EVMs, blocks Permit2/drainer sweeps, and returns unsigned revocation bundles.",
    schema: TxFirewallSchema,
  })
  async txFirewall(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TxFirewallSchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      to: args.to,
      data: args.data ?? "0x",
      from: args.from ?? walletProvider.getAddress(),
      value: args.value ?? "0",
      chainId: args.chainId ?? BASE_CHAIN_ID,
    };
    if (args.ticketId) {
      payload.ticketId = args.ticketId;
    }
    const capital = args.capitalAtRiskUsd ?? this.config.capitalAtRiskUsd;
    if (capital != null) {
      payload.capitalAtRiskUsd = capital;
    }

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.TX_FIREWALL,
      payload,
      { cacheTarget: `${args.to}:${payload.data}:${payload.chainId}` },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Scans an ERC-20 token for honeypots, abusive taxes, blacklists, and hidden proxies via live RPC.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - Deployed tokenAddress and/or Solidity code, chainId, tokenName, and tier
   * @returns JSON string with sellability verdict, rug probability score, and forensic evidence
   */
  @CreateAction({
    name: "ingravity_token_rug_scanner",
    description:
      "Audits EVM ERC-20 tokens for honeypots, hidden mints, blacklists, and EIP-1967/1167 proxies via live 5-EVM RPC bytecode disassembly ($0.12 Full / $0.04 Essential USDC via x402 v2). No Solidity source required.",
    schema: TokenRugScannerSchema,
  })
  async tokenRugScanner(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenRugScannerSchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      chainId: args.chainId ?? BASE_CHAIN_ID,
      tier: args.tier ?? "FULL",
    };
    if (args.tokenAddress) {
      payload.tokenAddress = args.tokenAddress;
    }
    if (args.code) {
      payload.code = args.code;
    }
    if (args.tokenName) {
      payload.tokenName = args.tokenName;
    }

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.TOKEN_RUG_SCANNER,
      payload,
      {
        tier: args.tier ?? "FULL",
        cacheTarget: `${args.tokenAddress ?? "code"}:${payload.chainId}:${payload.tier}`,
      },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Computes exact 18-decimal BigInt AMM slippage, MEV sandwich bounds, and liquidation thresholds.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - AMM reserve/swap inputs and/or perpetual leverage parameters plus tier
   * @returns JSON string with exact BigInt swap metrics, MEV risk, and liquidation limits
   */
  @CreateAction({
    name: "ingravity_defi_math_guard",
    description:
      "Computes deterministic BigInt AMM slippage, 48-step MEV anti-sandwich bounds, and perpetual liquidation prices ($0.10 Full / $0.04 Essential USDC via x402 v2).",
    schema: DefiMathGuardSchema,
  })
  async defiMathGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DefiMathGuardSchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      tier: args.tier ?? "FULL",
    };
    if (args.amm) {
      payload.amm = args.amm;
    }
    if (args.leverage) {
      payload.leverage = args.leverage;
    }

    const cacheKey = args.amm
      ? `${args.amm.reserveIn}:${args.amm.reserveOut}:${args.amm.amountIn}:${payload.tier}`
      : `${args.leverage?.entryPrice ?? "lev"}:${args.leverage?.leverage ?? "1"}:${payload.tier}`;

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.DEFI_MATH_GUARD,
      payload,
      { tier: args.tier ?? "FULL", cacheTarget: cacheKey },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Runs a deterministic 24-vector static security audit on a Solidity smart contract.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - Raw Solidity source code, optional contract metadata, deployed address, and tier
   * @returns JSON string with security score, grade, severity counts, and audit findings
   */
  @CreateAction({
    name: "ingravity_audit_solidity",
    description:
      "Deterministic 24-vector static security audit for Solidity smart contracts with 4-gate anti-noise filtering and optional live TVL verification ($0.85 Full / $0.35 Essential USDC via x402 v2).",
    schema: AuditSoliditySchema,
  })
  async auditSolidity(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AuditSoliditySchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      code: args.code,
      chainId: args.chainId ?? BASE_CHAIN_ID,
      tier: args.tier ?? "FULL",
    };
    if (args.contractName) {
      payload.contractName = args.contractName;
    }
    if (args.contractAddress) {
      payload.contractAddress = args.contractAddress;
    }
    if (args.ownerTreasury) {
      payload.ownerTreasury = args.ownerTreasury;
    }

    const solLabel = args.contractAddress ?? args.contractName ?? "sol";
    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.AUDIT_SOLIDITY,
      payload,
      {
        tier: args.tier ?? "FULL",
        cacheTarget: `${solLabel}:${args.code.length}:${payload.tier}`,
      },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Generates a multi-contract cross-reentrancy and ERC-4626/oracle invariant audit dossier.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - Array of 1-20 Solidity contracts, protocol name, TVL target, and tier
   * @returns JSON string with protocol security score, call graph, invariants, and findings
   */
  @CreateAction({
    name: "ingravity_protocol_dossier",
    description:
      "Audits 1-20 interdependent Solidity contracts for cross-contract read-only reentrancy and ERC-4626/oracle invariants ($12.00 Full / $3.50 Essential USDC via x402 v2).",
    schema: ProtocolDossierSchema,
  })
  async protocolDossier(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ProtocolDossierSchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      contracts: args.contracts,
      chainId: args.chainId ?? BASE_CHAIN_ID,
      tier: args.tier ?? "FULL",
    };
    if (args.protocolName) {
      payload.protocolName = args.protocolName;
    }
    if (args.tvlTargetUsd != null) {
      payload.tvlTargetUsd = args.tvlTargetUsd;
    }
    if (args.contractAddress) {
      payload.contractAddress = args.contractAddress;
    }
    if (args.ownerTreasury) {
      payload.ownerTreasury = args.ownerTreasury;
    }

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.PROTOCOL_DOSSIER,
      payload,
      {
        tier: args.tier ?? "FULL",
        cacheTarget: `${args.protocolName ?? "protocol"}:${args.contracts.length}:${payload.tier}`,
      },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Simulates institutional flash-loan exploit vectors and computes Safe-Harbor rescue plans.
   *
   * @param walletProvider - The EVM wallet provider used for gasless x402 settlement
   * @param args - Target protocolName, optional poolAddress, chainId, TVL, code, and tier
   * @returns JSON string with exploit immunity score, live TVL forensics, and Safe-Harbor plan
   */
  @CreateAction({
    name: "ingravity_deep_exploit_bounty",
    description:
      "Institutional flash-loan exploit simulation, live 5-EVM TVL verification, and unsigned EIP-5792 Safe-Harbor rescue bundle planner ($45.00 Full / $9.50 Essential USDC via x402 v2).",
    schema: DeepExploitBountySchema,
  })
  async deepExploitBounty(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DeepExploitBountySchema>,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      protocolName: args.protocolName,
      chainId: args.chainId ?? BASE_CHAIN_ID,
      tier: args.tier ?? "FULL",
    };
    if (args.poolAddress) {
      payload.poolAddress = args.poolAddress;
    }
    if (args.ownerTreasury) {
      payload.ownerTreasury = args.ownerTreasury;
    }
    if (args.tvlUsd != null) {
      payload.tvlUsd = args.tvlUsd;
    }
    if (args.code) {
      payload.code = args.code;
    }

    const result = await this.executeX402Request(
      walletProvider,
      "POST",
      INGRAVITY_ROUTES.DEEP_EXPLOIT_BOUNTY,
      payload,
      {
        tier: args.tier ?? "FULL",
        cacheTarget: `${args.protocolName}:${args.poolAddress ?? "default"}:${payload.tier}`,
      },
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Clears all cached X-Ingravity-Receipt-Token session entries.
   *
   * @returns Void after clearing the local receipt cache
   */
  clearReceiptCache(): void {
    this.receiptCache.clear();
  }

  /**
   * Creates an x402 client bound to the EVM wallet provider for gasless EIP-3009 signing.
   *
   * @param walletProvider - The EVM wallet provider
   * @returns Configured x402Client instance registered with the exact EVM scheme
   */
  private createX402Client(walletProvider: EvmWalletProvider): x402Client {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      readContract: (args: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: args.address,
          abi: args.abi as never,
          functionName: args.functionName as never,
          args: args.args as never,
        }),
    };
    registerExactEvmScheme(client, { signer });
    return client;
  }

  /**
   * Executes an Ingravity API call with receipt reuse, budget enforcement, and native x402 v2 payment.
   *
   * @param walletProvider - The EVM wallet provider used to sign EIP-3009 x402 payments
   * @param method - HTTP method ("GET" or "POST")
   * @param path - Endpoint path including /api/v1/ prefix and optional query string
   * @param body - Optional JSON request payload for POST requests
   * @param options - Optional tier and receipt cache key metadata
   * @returns Parsed JSON response from the Ingravity gateway
   */
  private async executeX402Request(
    walletProvider: EvmWalletProvider,
    method: "GET" | "POST",
    path: string,
    body: Record<string, unknown> | null,
    options: IngravityExecutionOptions = {},
  ): Promise<unknown> {
    const url = `${this.config.workerUrl}${path}`;
    const cacheKey = `${path.split("?")[0]}::${options.cacheTarget ?? ""}`.toLowerCase();

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": `coinbase-agentkit-ingravity/${INGRAVITY_SDK_VERSION}`,
    };

    if (this.config.maxSpendUsdc != null) {
      headers["X-Agent-Budget"] = String(this.config.maxSpendUsdc);
    }

    if (this.config.enableReceiptCache && this.receiptCache.has(cacheKey)) {
      headers["X-Ingravity-Receipt-Token"] = this.receiptCache.get(cacheKey) as string;
    }

    const requestInit: RequestInit = {
      method,
      headers: { ...headers },
    };

    if (method === "POST" && body) {
      (requestInit.headers as Record<string, string>)["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }

    // Step 1: Probe request (succeeds immediately if cached receipt is valid; otherwise returns 402)
    const probeResponse = await fetch(url, requestInit);

    if (probeResponse.ok) {
      return this.finalizeSuccessResponse(probeResponse, cacheKey);
    }

    if (probeResponse.status !== 402) {
      const errText = await probeResponse.text();
      throw new Error(`Ingravity gateway returned status ${probeResponse.status}: ${errText}`);
    }

    // Step 2: Inspect x402 v2 challenge (atomic accepts[0].amount) and enforce maxSpendUsdc cap
    const acceptOption = await this.parseX402V2Accept(probeResponse);
    this.validatePaymentOption(acceptOption);

    // Step 3: Settle gaslessly via Coinbase's native @x402/fetch + @x402/evm (PAYMENT-SIGNATURE)
    const client = this.createX402Client(walletProvider);
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    const paidResponse = await fetchWithPayment(url, requestInit);
    if (!paidResponse.ok) {
      const errText = await paidResponse.text();
      throw new Error(
        `Ingravity gateway rejected x402 payment (${paidResponse.status}): ${errText}`,
      );
    }

    return this.finalizeSuccessResponse(paidResponse, cacheKey);
  }

  /**
   * Parses the x402 v2 payment requirement option from PAYMENT-REQUIRED header or JSON body.
   *
   * @param response - HTTP 402 Response from the Ingravity gateway
   * @returns The primary Base USDC accept option from accepts[0]
   */
  private async parseX402V2Accept(response: Response): Promise<X402AcceptOption> {
    let challenge: X402ChallengePayload | null = null;

    const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
    if (paymentRequiredHeader) {
      try {
        const decoded = Buffer.from(paymentRequiredHeader, "base64").toString("utf8");
        challenge = JSON.parse(decoded) as X402ChallengePayload;
      } catch {
        challenge = null;
      }
    }

    if (!challenge || !Array.isArray(challenge.accepts) || challenge.accepts.length === 0) {
      try {
        challenge = (await response.json()) as X402ChallengePayload;
      } catch {
        challenge = null;
      }
    }

    const accepts = Array.isArray(challenge?.accepts) ? challenge.accepts : [];
    const baseUsdcAccept =
      accepts.find(
        opt =>
          opt.network === BASE_CAIP2_NETWORK &&
          String(opt.asset ?? "").toLowerCase() === BASE_USDC_CONTRACT.toLowerCase(),
      ) ?? accepts[0];

    if (!baseUsdcAccept) {
      throw new Error("Ingravity 402 response missing valid x402 v2 accepts payment option.");
    }

    return baseUsdcAccept;
  }

  /**
   * Validates the x402 payment asset, network, and atomic amount against configured maxSpendUsdc.
   *
   * @param option - Parsed x402 v2 accept option containing atomic USDC units
   * @returns Void if valid; throws an error if network, asset, or budget limit fails
   */
  private validatePaymentOption(option: X402AcceptOption): void {
    const rawAtomic = option.amount ?? option.maxAmountRequired;
    if (!rawAtomic || !/^\d+$/.test(String(rawAtomic))) {
      throw new Error("Invalid atomic payment amount in Ingravity x402 v2 challenge.");
    }

    if (option.network && option.network !== BASE_CAIP2_NETWORK) {
      throw new Error(
        `Unexpected x402 settlement network "${option.network}"; expected "${BASE_CAIP2_NETWORK}".`,
      );
    }

    if (option.asset && option.asset.toLowerCase() !== BASE_USDC_CONTRACT.toLowerCase()) {
      throw new Error(
        `Unexpected x402 settlement asset "${option.asset}"; expected Base USDC (${BASE_USDC_CONTRACT}).`,
      );
    }

    const amountUsdc = Number(rawAtomic) / 10 ** USDC_DECIMALS;
    if (this.config.maxSpendUsdc != null && amountUsdc > this.config.maxSpendUsdc) {
      throw new Error(
        `Action requires $${amountUsdc.toFixed(2)} USDC (${rawAtomic} atomic units), exceeding configured maxSpendUsdc limit of $${this.config.maxSpendUsdc} USDC.`,
      );
    }
  }

  /**
   * Parses a successful 200 OK gateway response and caches any issued receipt token.
   *
   * @param response - HTTP 200 Response from the Ingravity gateway
   * @param cacheKey - Normalized cache key for session receipt reuse
   * @returns Parsed JSON body from the response
   */
  private async finalizeSuccessResponse(response: Response, cacheKey: string): Promise<unknown> {
    const payload = (await response.json()) as Record<string, unknown>;
    const headerReceipt = response.headers.get("X-Ingravity-Receipt-Token");
    const bodyReceipt =
      payload && typeof payload.receiptToken === "string" ? payload.receiptToken : null;
    const receiptToken = headerReceipt ?? bodyReceipt;

    if (this.config.enableReceiptCache && receiptToken) {
      this.receiptCache.set(cacheKey, receiptToken);
    }

    return payload;
  }
}

/**
 * Factory function to instantiate IngravityActionProvider.
 *
 * @param config - Optional gateway, spending cap, and receipt cache configuration
 * @returns A new IngravityActionProvider instance
 */
export const ingravityActionProvider = (config?: IngravityActionProviderConfig) =>
  new IngravityActionProvider(config);
