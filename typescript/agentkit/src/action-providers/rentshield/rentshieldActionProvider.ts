import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { CheckTokenRugShieldSchema, ScanWalletUnclaimedRentSchema } from "./schemas";

const DEFAULT_RENTSHIELD_ORIGIN = "https://rentandrugshield.com";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SOLANA_PUBKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Configuration options for RentShieldActionProvider.
 */
export interface RentShieldActionProviderConfig {
  apiUrl?: string;
  apiKey?: string;
}

/**
 * Validates that an input string decodes to an exact 32-byte base58 Solana public key.
 *
 * @param input - Candidate base58 public address string
 * @returns True when input is a valid 32-byte Solana public key
 */
export function isValidSolanaPublicKey(input: string): boolean {
  const trimmed = String(input || "").trim();
  if (!SOLANA_PUBKEY_REGEX.test(trimmed)) {
    return false;
  }
  const bytes: number[] = [0];
  for (let i = 0; i < trimmed.length; i += 1) {
    let carry = BASE58_ALPHABET.indexOf(trimmed[i]);
    if (carry < 0) {
      return false;
    }
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingOnes = 0;
  while (leadingOnes < trimmed.length && trimmed[leadingOnes] === "1") {
    leadingOnes += 1;
  }
  return bytes.length + leadingOnes === 32;
}

/**
 * RentShieldActionProvider provides read-only 11-layer pre-buy Solana token rug checks
 * and 0%-first-claim empty ATA SOL rent recovery previews via https://rentandrugshield.com.
 *
 * @augments ActionProvider
 */
export class RentShieldActionProvider extends ActionProvider {
  private readonly explicitBaseUrl?: string;
  private readonly apiKey?: string;
  private cachedLiveBase: { url: string | null; expiresAt: number } = {
    url: null,
    expiresAt: 0,
  };

  /**
   * Initializes a new RentShieldActionProvider instance.
   *
   * @param config - Optional API URL and API key configuration
   */
  constructor(config: RentShieldActionProviderConfig = {}) {
    super("rentshield", []);
    const rawUrl = (config.apiUrl || process.env.RENTSHIELD_API_URL || "")
      .trim()
      .replace(/\/+$/, "");
    this.explicitBaseUrl = rawUrl || undefined;
    this.apiKey = config.apiKey || process.env.RENTSHIELD_API_KEY || undefined;
  }

  /**
   * Runs a read-only 11-layer pre-buy rug and scam safety check on a Solana token mint.
   *
   * @param args - Object containing the public Solana mint address
   * @returns JSON string with the 11-layer safety score, verdict, and per-layer checks
   */
  @CreateAction({
    name: "check_token_rug_shield",
    description: `Run a read-only 11-layer pre-buy rug and scam safety audit on a Solana token mint (SPL, Token-2022, or pump.fun) via https://rentandrugshield.com.
Evaluates mint/freeze authorities, Token-2022 permanent delegate & transfer hook traps, LP lock/burn verification, holder concentration, and Block-0 Sybil clusters.
Pass only a public base58 mint address. Never pass private keys or seed phrases.`,
    schema: CheckTokenRugShieldSchema,
  })
  async checkTokenRugShield(args: z.infer<typeof CheckTokenRugShieldSchema>): Promise<string> {
    const mint = String(args.mint || "").trim();
    if (!isValidSolanaPublicKey(mint)) {
      return JSON.stringify({
        ok: false,
        error:
          "Invalid mint address: expected a 32-byte base58 Solana public key. Never pass private keys or seed phrases.",
      });
    }

    try {
      const response = await this.requestJson(
        `/api/v1/shield-check?mint=${encodeURIComponent(mint)}`,
        {
          method: "GET",
          headers: { "X-Payment-Protocol": "x402" },
        },
      );
      if (response.status === 402) {
        return JSON.stringify({
          ok: false,
          paid: false,
          http: 402,
          note: "Free daily limit reached. Nothing was signed or paid automatically.",
          terms: response.body,
        });
      }
      if (response.status >= 400) {
        return JSON.stringify({
          ok: false,
          http: response.status,
          error: `Rent & Rug Shield HTTP ${response.status}`,
        });
      }
      const data = response.body;
      const rawScore = typeof data.score === "number" ? data.score : Number(data.safety_score);
      const score = Number.isFinite(rawScore) ? rawScore : null;
      return JSON.stringify({
        ok: true,
        mint: data.mint || mint,
        symbol: data.symbol || null,
        name: data.name || null,
        tokenProgram: data.token_program || null,
        score,
        safeToBuy: Boolean(
          data.safe_to_buy ?? (score !== null && score >= 75 && !data.hidden_pda_rent_trap),
        ),
        verdict: data.verdict || null,
        layersChecked: data.layers_checked ?? 11,
        layersPassed: data.layers_passed ?? null,
        checklistSummary: data.checklist_summary || null,
        checks: Array.isArray(data.checks) ? data.checks : [],
        reportUrl: `${DEFAULT_RENTSHIELD_ORIGIN}/audit/${mint}`,
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: `Failed to check token rug shield: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Scans a public Solana wallet for reclaimable rent-exempt SOL in empty SPL & Token-2022 ATAs.
   *
   * @param args - Object containing the public Solana wallet address
   * @returns JSON string with reclaimable account counts, SOL total, and 0%-first-claim fee status
   */
  @CreateAction({
    name: "scan_wallet_unclaimed_rent",
    description: `Read-only, non-custodial scan for reclaimable rent-exempt SOL locked in empty SPL and Token-2022 Associated Token Accounts via https://rentandrugshield.com (0% fee on first claim).
Pass only a public base58 wallet address. Never pass private keys or seed phrases.`,
    schema: ScanWalletUnclaimedRentSchema,
  })
  async scanWalletUnclaimedRent(
    args: z.infer<typeof ScanWalletUnclaimedRentSchema>,
  ): Promise<string> {
    const wallet = String(args.wallet || "").trim();
    if (!isValidSolanaPublicKey(wallet)) {
      return JSON.stringify({
        ok: false,
        error:
          "Invalid wallet address: expected a 32-byte base58 Solana public key. Never pass private keys or seed phrases.",
      });
    }

    try {
      const response = await this.requestJson("/api/scan-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, user_initiated: false }),
      });
      if (response.status >= 400) {
        return JSON.stringify({
          ok: false,
          http: response.status,
          error: `Rent & Rug Shield HTTP ${response.status}`,
        });
      }
      const data = response.body;
      return JSON.stringify({
        ok: true,
        wallet: data.wallet || wallet,
        isFirstFreeClaim: Boolean(data.is_first_free_claim),
        effectiveFeeBps: data.effective_fee_bps ?? data.fee_bps ?? 0,
        reclaimableCount: data.reclaimable_count ?? 0,
        emptyCount: data.empty_count ?? 0,
        dustCount: data.dust_count ?? 0,
        activeCount: data.active_count ?? 0,
        totalReclaimableSol: data.total_reclaimable_sol ?? 0,
        totalReclaimableLamports: data.total_reclaimable_lamports ?? 0,
        emptyReclaimable: Array.isArray(data.empty_reclaimable) ? data.empty_reclaimable : [],
        claimUrl: `${DEFAULT_RENTSHIELD_ORIGIN}/?wallet=${wallet}`,
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: `Failed to scan wallet unclaimed rent: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network belongs to the Solana (SVM) protocol family
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "svm";
  }

  /**
   * Resolves the live HTTPS gateway endpoint from rentandrugshield.com/live_endpoint.json.
   *
   * @returns Resolved HTTPS base URL or null if unavailable
   */
  private async resolveLiveApiBase(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedLiveBase.url && this.cachedLiveBase.expiresAt > now) {
      return this.cachedLiveBase.url;
    }
    const response = await fetch(`${DEFAULT_RENTSHIELD_ORIGIN}/live_endpoint.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const candidate = String(payload.api_base || payload.endpoint || "")
      .trim()
      .replace(/\/+$/, "");
    if (!candidate) {
      return null;
    }
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") {
      return null;
    }
    this.cachedLiveBase = { url: candidate, expiresAt: now + 5 * 60 * 1000 };
    return candidate;
  }

  /**
   * Sends an HTTPS JSON request to Rent & Rug Shield with automatic live_endpoint.json fallback.
   *
   * @param path - Request path and query string
   * @param init - Fetch initialization options
   * @returns HTTP status code and parsed JSON body
   */
  private async requestJson(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const initialBase =
      this.explicitBaseUrl ||
      (this.cachedLiveBase.url && this.cachedLiveBase.expiresAt > Date.now()
        ? this.cachedLiveBase.url
        : DEFAULT_RENTSHIELD_ORIGIN);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((init.headers as Record<string, string>) || {}),
      ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
    };

    let response = await fetch(`${initialBase}${path}`, { ...init, headers });
    if (!this.explicitBaseUrl && (response.status === 404 || response.status === 405)) {
      const liveBase = await this.resolveLiveApiBase();
      if (liveBase && liveBase !== initialBase) {
        response = await fetch(`${liveBase}${path}`, { ...init, headers });
      }
    }

    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { raw: text.slice(0, 2000) };
    }
    return { status: response.status, body };
  }
}

/**
 * Factory function to create a new RentShieldActionProvider instance.
 *
 * @param config - Optional configuration options for RentShieldActionProvider
 * @returns A new RentShieldActionProvider instance
 */
export const rentshieldActionProvider = (config: RentShieldActionProviderConfig = {}) =>
  new RentShieldActionProvider(config);
