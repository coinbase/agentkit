import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { NULLCLEAR_API_BASE_URL } from "./constants";
import { NullClearEvmChain, NullClearForensicChain, NullClearGuardedRpcOptions } from "./types";

const CHAIN_ID_MAP: Record<string, NullClearForensicChain> = {
  "8453": "base",
  "84532": "base",
  "1": "eth",
  "42161": "arbitrum",
  "10": "optimism",
  "137": "polygon",
  "56": "bsc",
};

/**
 * Infers the NullClear chain identifier from an explicit parameter or the wallet's active network.
 *
 * @param walletProvider - The connected AgentKit wallet provider.
 * @param explicitChain - Optional caller-specified chain override.
 * @returns Normalized NullClear chain identifier.
 */
export function inferForensicChain(
  walletProvider: WalletProvider,
  explicitChain?: NullClearForensicChain,
): NullClearForensicChain {
  if (explicitChain) {
    return explicitChain;
  }

  const network: Network = walletProvider.getNetwork();
  if (network.protocolFamily === "svm" || network.networkId?.includes("solana")) {
    return "solana";
  }

  if (network.chainId && CHAIN_ID_MAP[network.chainId]) {
    return CHAIN_ID_MAP[network.chainId];
  }

  const nid = (network.networkId || "").toLowerCase();
  if (nid.includes("arbitrum")) return "arbitrum";
  if (nid.includes("optimism")) return "optimism";
  if (nid.includes("polygon") || nid.includes("matic")) return "polygon";
  if (nid.includes("bsc") || nid.includes("bnb")) return "bsc";
  if (nid.includes("ethereum")) return "eth";

  return "base";
}

/**
 * Infers an EVM-only chain identifier for smart contract bytecode/proxy inspection.
 *
 * @param walletProvider - The connected AgentKit wallet provider.
 * @param explicitChain - Optional caller-specified EVM chain override.
 * @returns Normalized EVM chain identifier.
 */
export function inferEvmChain(
  walletProvider: WalletProvider,
  explicitChain?: NullClearEvmChain,
): NullClearEvmChain {
  if (explicitChain) {
    return explicitChain;
  }

  const inferred = inferForensicChain(walletProvider);
  if (inferred === "solana") {
    throw new Error(
      "Contract proxy/bytecode inspection supports EVM chains (`base`, `eth`, `arbitrum`, `optimism`, `polygon`, `bsc`). Use `scan_token` or `preflight_guard` for Solana.",
    );
  }

  return inferred;
}

/**
 * Constructs a Drop-In Guarded JSON-RPC URL (`https://api.nullclear.dev/rpc/:chain/:apiKey`)
 * that passes reads through at 0 credit cost and screens transactions before broadcast.
 *
 * @param options - Guarded RPC URL configuration options.
 * @returns Formatted Guarded JSON-RPC endpoint URL.
 */
export function buildNullClearGuardedRpcUrl(options: NullClearGuardedRpcOptions): string {
  const base = (options.apiBaseUrl || NULLCLEAR_API_BASE_URL).replace(/\/+$/, "");
  const params = new URLSearchParams();
  if (options.failMode) {
    params.set("failMode", options.failMode);
  }
  if (typeof options.timeoutMs === "number") {
    params.set("timeoutMs", String(options.timeoutMs));
  }
  if (typeof options.blockCaution === "boolean") {
    params.set("blockCaution", String(options.blockCaution));
  }
  const qs = params.toString();
  return `${base}/rpc/${options.chain}/${encodeURIComponent(options.apiKey)}${qs ? `?${qs}` : ""}`;
}

/**
 * Executes an HTTP request against the NullClear API with optional Prepaid Pass Bearer authentication.
 *
 * @param apiBaseUrl - Normalized NullClear API base URL.
 * @param path - Endpoint path starting with `/`.
 * @param init - Fetch request options.
 * @param apiKey - Optional NullClear Prepaid Pass (`nc_live_...`) Bearer key.
 * @returns Parsed JSON string or actionable error guidance string.
 */
export async function callNullClearApi(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  apiKey?: string,
): Promise<string> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 402) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return JSON.stringify(
      {
        error: "NullClear free daily limit reached or paid endpoint requires pass/x402 settlement",
        upgradeInstructions:
          "Mint a $5/$25/$100 Prepaid Pass via POST https://api.nullclear.dev/v1/pass/buy and configure `apiKey` on nullclearActionProvider({ apiKey }) or use Drop-In Guarded RPC.",
        details: body,
      },
      null,
      2,
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${errText ? `: ${errText}` : ""}`);
  }

  const data = await response.json();
  return JSON.stringify(data, null, 2);
}
