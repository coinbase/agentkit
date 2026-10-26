import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { CheckDenylistSchema, CheckPayeeSchema, CheckSignatureSchema } from "./schemas";
import {
  DEFAULT_MAX_PAYMENT_USDC,
  DENYLIST_TTL_MS,
  USDC_DECIMALS,
  VERIQL_BASE_URL,
} from "./constants";

export interface VeriqlActionProviderConfig {
  /**
   * A Veriql API key (`vq_live_...`). With one, calls spend prepaid credits
   * and no payment is ever signed. Falls back to `VERIQL_API_KEY`.
   */
  apiKey?: string;
  /**
   * Without a key, calls are paid per request over x402 from the agent's own
   * wallet. Any payment option above this many USDC is refused before
   * signing. Falls back to `VERIQL_MAX_PAYMENT_USDC`, then 0.01.
   */
  maxPaymentUsdc?: number;
  /** Override for testing against a non-production deployment. */
  baseUrl?: string;
}

type Family = "evm" | "solana" | "tron" | "btc";

/**
 * Which denylist family an address belongs to, by shape alone. Tron is checked
 * before Solana because a 34-character Tron address also passes a base58
 * length check.
 *
 * @param address - The address to classify
 * @returns The address family, or null if the shape is not recognised
 */
export function familyOf(address: string): Family | null {
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
  if (/^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)) return "btc";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "solana";
  return null;
}

/**
 * Converts a whole-USDC cap to atomic units without floating-point drift:
 * `0.29 * 1e6` is `289999.99999999994`, which truncates to the wrong amount.
 *
 * @param usdc - The amount in whole USDC
 * @returns The amount in atomic units (6 decimals)
 */
export function usdcToAtomic(usdc: number): bigint {
  return BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));
}

/**
 * Drops every payment option priced above `capAtomic`. x402 v2 carries the
 * price as `amount`, v1 as `maxAmountRequired`; an option carrying neither is
 * dropped too, because a price we cannot read is not one we can agree to.
 *
 * @param capAtomic - The highest acceptable price, in atomic USDC units
 * @returns An x402 payment policy that filters the offered requirements
 */
export function priceCapPolicy(capAtomic: bigint) {
  return <T extends object>(_version: number, reqs: T[]): T[] =>
    reqs.filter(r => {
      const rec = r as Record<string, unknown>;
      const raw = rec.amount ?? rec.maxAmountRequired;
      if (typeof raw !== "string" && typeof raw !== "number") return false;
      try {
        return BigInt(raw) <= capAtomic;
      } catch {
        return false;
      }
    });
}

/**
 * Veriql checks for agents that move money.
 *
 * - `check_payee` before sending funds: OFAC SDN, the Drain Watch scam list,
 *   and whether Tether or Circle has frozen the address (read from the issuer's
 *   own contract).
 * - `check_signature` before signing: decodes approvals, Permit/Permit2,
 *   EIP-7702 delegations, transfers and revokes, and checks who gains the power.
 * - `check_denylist`: a free lookup against the same lists, no payment.
 *
 * Read-only: Veriql never asks for a key, never signs and never moves funds.
 */
export class VeriqlActionProvider extends ActionProvider<WalletProvider> {
  private readonly apiKey?: string;
  private readonly capAtomic: bigint;
  private readonly baseUrl: string;
  private denylist = new Map<Family, { at: number; values: Set<string> }>();

  /**
   * Creates a new VeriqlActionProvider.
   *
   * @param config - Optional API key, payment cap and base URL
   */
  constructor(config: VeriqlActionProviderConfig = {}) {
    super("veriql", []);
    this.apiKey = config.apiKey ?? process.env.VERIQL_API_KEY ?? undefined;
    const envCap = Number(process.env.VERIQL_MAX_PAYMENT_USDC);
    const cap =
      config.maxPaymentUsdc ??
      (Number.isFinite(envCap) && envCap > 0 ? envCap : DEFAULT_MAX_PAYMENT_USDC);
    this.capAtomic = usdcToAtomic(cap);
    this.baseUrl = (config.baseUrl ?? VERIQL_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * Checks a payment recipient before funds are sent.
   *
   * @param walletProvider - The wallet that pays for the call over x402
   * @param args - The recipient address
   * @returns The verdict as a JSON string, or an error telling the agent to treat it as unverified
   */
  @CreateAction({
    name: "check_payee",
    description: `Check an address BEFORE sending it any money (a transfer, a payment, a payout).
Checks the US Treasury OFAC sanctions list, the Veriql Drain Watch list of known drainer and scam
addresses, and whether Tether or Circle has frozen the address (read from the issuer's contract).
Works for EVM, Solana, Bitcoin and Tron addresses.

Returns a verdict:
- do_not_pay: do NOT send funds. Tell the user why, using the reasons returned.
- no_known_risk: nothing adverse was found. This is not a guarantee the recipient is safe.
- incomplete: some checks could not run. Treat it as unverified, not as clean.

Costs $0.005 in USDC from this wallet (or one credit with an API key).`,
    schema: CheckPayeeSchema,
  })
  async checkPayee(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckPayeeSchema>,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/v1/payee?address=${encodeURIComponent(args.address.trim())}`;
    return this.call(walletProvider, url, { method: "GET" });
  }

  /**
   * Checks a signing request before it is signed.
   *
   * @param walletProvider - The wallet that pays for the call over x402
   * @param args - The payload the agent was asked to sign
   * @returns The decision as a JSON string, or an error telling the agent to treat it as unverified
   */
  @CreateAction({
    name: "check_signature",
    description: `Check a signing request BEFORE signing it. Pass exactly what you were asked to sign:
raw transaction calldata (0x...), an EIP-712 typed-data JSON string, or a JSON-RPC signing request.
Decodes token approvals, Permit and Permit2, EIP-7702 delegations, transfers and revokes, and checks
whoever gains the power against OFAC and Drain Watch.

Returns block, warn or allow, with the decoded action in plain words.
- block: do NOT sign. A payload that cannot be decoded is also block, and is not charged.
- warn: explain the risk to the user and get explicit confirmation before signing.
- allow: no known risk was found in what this payload does.

Costs $0.005 in USDC from this wallet (or one credit with an API key).`,
    schema: CheckSignatureSchema,
  })
  async checkSignature(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckSignatureSchema>,
  ): Promise<string> {
    // Typed data arrives as a JSON string from a model; send it as the object
    // it describes so the server decodes the structure, not a quoted string.
    let payload: unknown = args.payload.trim();
    if (typeof payload === "string" && /^[[{]/.test(payload)) {
      try {
        payload = JSON.parse(payload);
      } catch {
        // Not JSON after all: the server reports it as undecodable (block).
      }
    }
    return this.call(walletProvider, `${this.baseUrl}/api/v1/signature`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    });
  }

  /**
   * Looks an address up in the free Veriql denylist.
   *
   * @param args - The address to look up
   * @returns Whether the address is listed, as a JSON string
   */
  @CreateAction({
    name: "check_denylist",
    description: `Free, instant lookup of an address against the Veriql denylist (OFAC SDN sanctions plus
Drain Watch known drainer and scam addresses), refreshed daily. No payment.
Use it for a quick screen. Before actually sending funds prefer check_payee, which also reads
Tether and Circle freezes. An address NOT on the list means no listing was found, not that it is safe.`,
    schema: CheckDenylistSchema,
  })
  async checkDenylist(args: z.infer<typeof CheckDenylistSchema>): Promise<string> {
    const address = args.address.trim();
    const family = familyOf(address);
    if (!family) {
      return JSON.stringify({
        error: true,
        message: "Not a recognised EVM, Solana, Bitcoin or Tron address.",
      });
    }
    try {
      const values = await this.loadDenylist(family);
      const needle = family === "evm" ? address.toLowerCase() : address;
      const listed = values.has(needle);
      return JSON.stringify({
        address,
        family,
        listed,
        verdict: listed ? "do_not_pay" : "not_listed",
        note: listed
          ? "Listed on OFAC SDN or Drain Watch. Do not send funds. Run check_payee for the reasons."
          : "No listing found. This is not a statement that the address is safe.",
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Denylist unavailable: ${error instanceof Error ? error.message : String(error)}. Treat the address as unverified.`,
      });
    }
  }

  /**
   * Veriql is a read-only API, so every network is supported.
   *
   * @returns Always true
   */
  supportsNetwork = () => true;

  /**
   * Loads one family of the denylist, cached for an hour. A failed refresh
   * keeps the previous copy rather than reading as an empty list.
   *
   * @param family - The address family to load
   * @returns The listed addresses, EVM ones lowercased
   */
  private async loadDenylist(family: Family): Promise<Set<string>> {
    const hit = this.denylist.get(family);
    if (hit && Date.now() - hit.at < DENYLIST_TTL_MS) return hit.values;
    const res = await fetch(`${this.baseUrl}/api/denylist?family=${family}`);
    if (!res.ok) {
      // The feed answers 503 rather than an empty list; keep a stale copy.
      if (hit) return hit.values;
      throw new Error(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as { items?: { value?: unknown }[] };
    if (!Array.isArray(body.items)) {
      if (hit) return hit.values;
      throw new Error("unexpected response");
    }
    const values = new Set<string>();
    for (const item of body.items) {
      if (typeof item?.value !== "string") continue;
      values.add(family === "evm" ? item.value.toLowerCase() : item.value);
    }
    this.denylist.set(family, { at: Date.now(), values });
    return values;
  }

  /**
   * Calls a paid Veriql endpoint with the API key, or over x402 from the wallet.
   *
   * @param walletProvider - The wallet that pays when no API key is set
   * @param url - The endpoint URL
   * @param init - The request options
   * @returns The response body as a JSON string, or an error object
   */
  private async call(
    walletProvider: WalletProvider,
    url: string,
    init: RequestInit,
  ): Promise<string> {
    try {
      let res: Response;
      if (this.apiKey) {
        res = await fetch(url, {
          ...init,
          headers: { ...(init.headers as object), "x-api-key": this.apiKey },
        });
      } else {
        const client = await this.createX402Client(walletProvider);
        if (!client) {
          return JSON.stringify({
            error: true,
            message:
              "This wallet cannot pay over x402 (needs an EVM or Solana wallet holding USDC on Base or Solana). Set VERIQL_API_KEY instead: a free key is at https://veriql.app/api/checkout?pack=free",
          });
        }
        res = await wrapFetchWithPayment(fetch, client)(url, init);
      }
      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // Leave non-JSON bodies as text.
      }
      if (!res.ok) {
        return JSON.stringify({
          error: true,
          status: res.status,
          message:
            res.status === 402
              ? `Payment was not completed. Veriql's price may be above this agent's cap (${Number(this.capAtomic) / 10 ** USDC_DECIMALS} USDC), or the wallet lacks USDC on Base or Solana.`
              : `Veriql answered ${res.status}. Treat the address or payload as unverified.`,
          details: data,
        });
      }
      const settlement =
        res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
      return JSON.stringify(settlement ? { ...(data as object), paid: true } : data);
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Veriql request failed: ${error instanceof Error ? error.message : String(error)}. Treat the address or payload as unverified.`,
      });
    }
  }

  /**
   * Creates an x402 client for the wallet, capped at the configured price.
   *
   * @param walletProvider - The wallet that signs the payment
   * @returns The client, or null if the wallet cannot pay over x402
   */
  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client | null> {
    const client = new x402Client();
    if (walletProvider instanceof EvmWalletProvider) {
      registerExactEvmScheme(client, { signer: walletProvider.toSigner() });
    } else if (walletProvider instanceof SvmWalletProvider) {
      registerExactSvmScheme(client, { signer: await walletProvider.toSigner() });
    } else {
      return null;
    }
    client.registerPolicy(priceCapPolicy(this.capAtomic));
    return client;
  }
}

/**
 * Creates a VeriqlActionProvider.
 *
 * @param config - Optional API key, payment cap and base URL
 * @returns A new VeriqlActionProvider
 */
export const veriqlActionProvider = (config: VeriqlActionProviderConfig = {}) =>
  new VeriqlActionProvider(config);
