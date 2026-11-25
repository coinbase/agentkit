import { promises as dnsPromises } from "node:dns";
import { isIP } from "node:net";
import { z } from "zod";
import { decodeEventLog, encodeFunctionData, erc20Abi, formatUnits, Hex, parseUnits } from "viem";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  BorrowSchema,
  GetAgentRecordSchema,
  GetCreditLineSchema,
  PayX402WithCreditSchema,
  RepaySchema,
} from "./schemas";
import {
  AUTO_TERM_DAYS,
  AUTOREPAY,
  AUTOREPAY_ABI,
  DEFAULT_TERM_DAYS,
  LOAN_ACTIVE,
  POOL_ABI,
  PRIORS_API,
  PRIORS_POOL,
  REGISTRY,
  REGISTRY_ABI,
  ROBINHOOD_CHAIN_ID,
  USDG,
  USDG_DECIMALS,
} from "./constants";
// the data fence around the seller's text
import { fenced, guarded, unfenced } from "./fence";
// one signature per purchase
import {
  MAX_VALIDITY_SECONDS,
  REQUEST_TIMEOUT_MS,
  SKEW_SECONDS,
  isAbort,
  pickUsdgRequirement,
  purchaseKey,
  readCapped,
  resend,
  Sent,
  usdgClient,
} from "./payment";

/** A payment signed for a purchase and not seen settled: until it expires, the only payment sent for that purchase. */
type Signed = {
  paymentHeaders: Record<string, string>;
  validBefore: number;
  price: bigint;
  payTo: string;
  borrowed: string;
};
/** A paid request's resends while its seller answers "settlement pending", as Priors' MCP server sends them. */
const RESEND = { retries: 2, maxSleepMs: 10_000, timeoutMs: REQUEST_TIMEOUT_MS };

const usdg = (atomic: bigint) => formatUnits(atomic, USDG_DECIMALS);
const sameAddress = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();
const utcDay = () => new Date().toISOString().slice(0, 10);

/**
 * Auto-borrow, set by the owner in code (never by the model): pay_x402_with_priors_credit borrows the gap on its own,
 * up to `perCall` USDG a call and `perDay` USDG a UTC day in this process, for the `hosts` listed only (exact host
 * names), for 14 days, and only while this wallet's Autopay (AutoRepay v2) covers the new loan. The model's maxBorrow
 * can only lower the amount.
 */
export type AutoBorrowOptions = { perCall: string; perDay: string; hosts: string[] };
export type PriorsOptions = { autoBorrow?: AutoBorrowOptions };

/** A refusal before anything is sent (its message is the answer). */
class Refusal extends Error {}

/** A transaction whose receipt says it reverted: it moved nothing. */
class Reverted extends Error {}

/** A borrow sent whose answer was lost: it may have opened a loan, and the answer says so (its message). */
class BorrowUnconfirmed extends Error {
  /**
   * Builds the error.
   *
   * @param amount - The borrow's amount, atomic USDG.
   * @param hash - Its transaction's hash.
   * @param cause - What the wait for its receipt threw.
   */
  constructor(amount: bigint, hash: string, cause: unknown) {
    super(
      `the borrow of ${usdg(amount)} USDG was sent (transaction ${hash}) and its answer was lost (${unfenced(String(cause))}), so it may have opened a loan: check it before calling again, and repay it with repay_priors_loan before its due date`,
    );
  }
}

/** Said when a response body broke off while it was read. */
const UNREAD =
  "The response body could not be read completely (the connection failed while it was sent).";

/**
 * Atomic USDG from an amount the model gives: a plain decimal of at most 6 places, read exactly. viem's parseUnits
 * rounds a longer one to the nearest unit, so a cap of 0.0999999 would admit 0.10.
 *
 * @param value - The amount, e.g. "0.10".
 * @param name - Its argument's name, for the refusal.
 * @returns Atomic USDG.
 */
function exactUsdg(value: string, name: string): bigint {
  const s = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(s))
    throw new Refusal(`${name} must be a plain amount of USDG, such as 0.10. Nothing was sent.`);
  if ((s.split(".")[1] ?? "").length > USDG_DECIMALS)
    throw new Refusal(
      `${name} ${s} has more than ${USDG_DECIMALS} decimals, and USDG counts in millionths: give at most 6 decimals. Nothing was sent.`,
    );
  return parseUnits(s, USDG_DECIMALS);
}

/**
 * Throws unless a transaction's receipt says it succeeded: a reverted one moved nothing, and is never reported as done.
 *
 * @param receipt - The receipt the wallet provider answered.
 * @param what - What the transaction was, e.g. "repay".
 * @param hash - Its hash.
 */
function mined(receipt: unknown, what: string, hash: string): void {
  const status = (receipt as { status?: unknown } | null)?.status;
  if (status === "success" || status === 1 || status === 1n || status === "0x1") return;
  if (status === "reverted" || status === 0 || status === 0n || status === "0x0")
    throw new Reverted(`the ${what} transaction ${hash} reverted on chain: it moved nothing`);
  throw new Error(
    `the ${what} transaction ${hash} could not be confirmed (its receipt has no status): check it before acting on it`,
  );
}

/**
 * Whether an IPv4 address is not a public one: this host, private, CGNAT, link-local, test or reserved.
 *
 * @param root0 - The address's first three numbers.
 * @param root0."0" - The first.
 * @param root0."1" - The second.
 * @param root0."2" - The third.
 * @returns Whether it is not public.
 */
function v4Private([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/**
 * An IPv6 address's eight 16-bit words.
 *
 * @param ip - The address.
 * @returns Its words, or null when it does not parse.
 */
function v6Words(ip: string): number[] | null {
  let s = ip.split("%")[0].toLowerCase();
  let tail: number[] = [];
  const dotted = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [p, q, r, t] = dotted.slice(1).map(Number);
    tail = [(p << 8) | q, (r << 8) | t];
    s = s.slice(0, -dotted[0].length);
    if (s.endsWith(":") && !s.endsWith("::")) s = s.slice(0, -1);
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const words = (x: string) =>
    x ? x.split(":").map(h => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)) : [];
  const head = words(parts[0]);
  const rest = parts.length === 2 ? words(parts[1]) : [];
  const fill = 8 - head.length - rest.length - tail.length;
  if (fill < 0 || (parts.length === 1 && fill !== 0)) return null;
  const all = [...head, ...Array(fill).fill(0), ...rest, ...tail];
  return all.some(Number.isNaN) ? null : all;
}

/**
 * Whether an IPv6 address is not a public one (an IPv4 one it carries judged as IPv4).
 *
 * @param w - Its eight 16-bit words.
 * @returns Whether it is not public.
 */
function v6Private(w: number[]): boolean {
  const v4 = (hi: number, lo: number) => v4Private([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  if (w.slice(0, 6).every(x => x === 0)) return true; // ::, ::1, and the deprecated IPv4-compatible form
  if (w.slice(0, 5).every(x => x === 0) && w[5] === 0xffff) return v4(w[6], w[7]); // IPv4-mapped
  if (
    (w[0] & 0xfe00) === 0xfc00 ||
    (w[0] & 0xffc0) === 0xfe80 ||
    (w[0] & 0xffc0) === 0xfec0 ||
    (w[0] & 0xff00) === 0xff00
  )
    return true;
  if (w[0] === 0x64 && w[1] === 0xff9b) return w[2] !== 0 || v4(w[6], w[7]); // NAT64, and its local-use range
  if (w[0] === 0x2002) return v4(w[1], w[2]); // 6to4
  return w[0] === 0x2001 && (w[1] === 0 || w[1] === 0xdb8); // Teredo, documentation
}

/**
 * Whether an address is not a public one (a string that is not an address counts as not public).
 *
 * @param ip - The address.
 * @returns Whether it is not public.
 */
function privateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Private(ip.split(".").map(Number));
  if (kind === 6) {
    const w = v6Words(ip);
    return !w || v6Private(w);
  }
  return true;
}

/**
 * Refuses, before anything is fetched, a URL whose host is a private, loopback or link-local address, a local name, or a
 * name that resolves to one: the provider fetches what the model names and hands the answer back.
 *
 * SHORTCUT: the name is resolved here and again by fetch when it connects, so a DNS answer that turns private between
 * the two (rebinding) is not caught. Upgrade when the provider fetches with credentials or reads private answers back:
 * a dispatcher whose connect lookup applies this same check.
 *
 * @param url - The URL to be fetched.
 */
async function publicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const no = new Refusal(
    `${url.host} is a private, loopback or link-local address, or a local name: only public https hosts are paid. Nothing was fetched or paid.`,
  );
  if (!host || host === "localhost" || /\.(localhost|local|home\.arpa)$/.test(host)) throw no;
  if (isIP(host)) {
    if (privateAddress(host)) throw no;
    return;
  }
  let found: Array<{ address: string }>;
  try {
    found = await dnsPromises.lookup(host, { all: true, verbatim: true });
  } catch (error) {
    throw new Refusal(
      `${url.host} could not be resolved (${unfenced(String((error as { code?: string })?.code ?? error))}). Nothing was fetched or paid.`,
    );
  }
  if (!found.length || found.some(a => privateAddress(a.address))) throw no;
}

/**
 * The settlement's transaction hash from an x402 payment-response header (nothing else of it).
 *
 * @param header - The header.
 * @returns The hash, or null when it carries none.
 */
function settledTx(header: string | null): string | null {
  if (!header) return null;
  try {
    const tx = JSON.parse(Buffer.from(header, "base64").toString("utf8"))?.transaction;
    return typeof tx === "string" && /^0x[0-9a-fA-F]{64}$/.test(tx) ? tx : null;
  } catch {
    return null;
  }
}

/**
 * PriorsActionProvider gives an agent on Robinhood Chain a USDG credit line from Priors: pay an x402 URL and borrow
 * the gap when the wallet is short, borrow and repay, and read another agent's repayment record before paying it.
 */
export class PriorsActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly auto: { perCall: bigint; perDay: bigint; hosts: Set<string> } | null;
  private borrowedToday = { day: "", amount: 0n };
  // One signature per purchase (./payment.ts): a payment this provider signed for a wallet's purchase (the method, the
  // URL as the seller reads it and the body: purchaseKey) and has not seen settle is sent again by a later call for
  // that purchase, never signed again, until it expires.
  // SHORTCUT: kept in this process's memory. A restart while such a payment may still settle (at most 600 s, plus
  // SKEW_SECONDS) forgets it, and a call for the same purchase after the restart signs again: at most one more payment
  // of at most maxPrice, to the seller the call named. Upgrade when the provider gets a place to keep state.
  private readonly unsettled = new Map<string, Signed>();
  /** The money call under way for each wallet (a payment, a borrow, a repayment): the next one waits for it. */
  private readonly running = new Map<string, Promise<void>>();

  /**
   * Constructor for the PriorsActionProvider.
   *
   * @param fetchImpl - The fetch used for Priors' API and the x402 URLs (injectable for tests).
   * @param options - `autoBorrow` (off unless given): see AutoBorrowOptions.
   */
  constructor(
    private readonly fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
    options: PriorsOptions = {},
  ) {
    super("priors", []);
    const a = options.autoBorrow;
    if (!a) {
      this.auto = null;
      return;
    }
    // the owner's limits, read exactly as the model's amounts are: more than 6 decimals is refused, never rounded
    const limit = (value: string, name: string) => {
      try {
        return exactUsdg(value, name);
      } catch (error) {
        throw new Error(String((error as Error).message).replace(/ Nothing was sent\.$/, ""));
      }
    };
    const perCall = limit(a.perCall, "autoBorrow.perCall");
    const perDay = limit(a.perDay, "autoBorrow.perDay");
    if (perCall <= 0n) throw new Error("autoBorrow.perCall must be above 0");
    if (perDay < perCall) throw new Error("autoBorrow.perDay must be at least autoBorrow.perCall");
    const hosts = (a.hosts ?? []).map(h => String(h).trim().toLowerCase());
    if (!hosts.length || hosts.some(h => !/^[a-z0-9.-]+(:\d{1,5})?$/.test(h)))
      throw new Error(
        'autoBorrow.hosts must list the host names it may borrow to pay, e.g. ["models.example"]',
      );
    this.auto = { perCall, perDay, hosts: new Set(hosts) };
  }

  /**
   * Reads an agent's Priors repayment record.
   *
   * @param _walletProvider - The wallet provider (unused: the record is public).
   * @param args - The agent id.
   * @returns The record in plain words, or an error message.
   */
  @CreateAction({
    name: "get_priors_agent_record",
    description: `
This tool reads an ERC-8004 agent's repayment record on Priors: loans repaid, late repayments, defaults and score.
Use it before paying or hiring another agent. It moves no money.

Inputs:
- agentId: the agent's ERC-8004 id on Robinhood Chain.`,
    schema: GetAgentRecordSchema,
  })
  async getAgentRecord(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentRecordSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchImpl(`${PRIORS_API}/api/check?agent=${args.agentId}`);
      if (!res.ok) return `Error: Priors answered HTTP ${res.status} for agent #${args.agentId}.`;
      const body = (await res.json()) as {
        agents?: Array<{
          name?: string;
          record?: Record<string, unknown>;
          scoreV2?: Record<string, unknown>;
        }>;
      };
      const a = body.agents?.[0];
      if (!a || !a.record) return `Agent #${args.agentId} has no Priors record.`;
      const r = a.record;
      // the name is the agent's owner's own words: one line, no fence marker however spelt
      const name = a.name ? unfenced(String(a.name).slice(0, 100)) : "";
      return guarded(
        [
          `Agent #${args.agentId}${name ? ` (${name})` : ""} on Priors:`,
          `- loans repaid: ${r.loansRepaid ?? 0} (${r.volumeRepaidUsdg ?? 0} USDG), open loans: ${r.activeLoans ?? 0}`,
          `- defaulted: ${r.defaulted ? "yes" : "no"}${r.frozen ? ", frozen" : ""}`,
          `- late repayments: ${a.scoreV2?.lateRepayments ?? 0}, Score v2: ${a.scoreV2?.score ?? "n/a"} (${a.scoreV2?.rungName ?? "n/a"})`,
          `A record shows how the agent repaid loans on Priors, not whether its service is good.`,
        ].join("\n"),
      );
    } catch (error) {
      return `Error reading agent #${args.agentId}'s record: ${error}`;
    }
  }

  /**
   * Reads an agent's Priors credit line.
   *
   * @param _walletProvider - The wallet provider (unused: the line is public).
   * @param args - The agent id.
   * @returns The line in plain words, or an error message.
   */
  @CreateAction({
    name: "get_priors_credit_line",
    description: `
This tool reads an agent's Priors credit line: its size, what is drawn and what is available to borrow. It moves no money.

Inputs:
- agentId: the agent's ERC-8004 id on Robinhood Chain.`,
    schema: GetCreditLineSchema,
  })
  async getCreditLine(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetCreditLineSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchImpl(`${PRIORS_API}/api/hub/agent?id=${args.agentId}`);
      if (!res.ok) return `Error: Priors answered HTTP ${res.status} for agent #${args.agentId}.`;
      const body = (await res.json()) as {
        agent?: {
          line?: { limit?: number; drawn?: number; available?: number };
          activeLoans?: number;
        };
      };
      const line = body.agent?.line;
      if (!line) return `Agent #${args.agentId} has no Priors line.`;
      const fmt = (n?: number) => usdg(BigInt(Math.round(Number(n ?? 0))));
      return `Agent #${args.agentId}'s Priors line: ${fmt(line.limit)} USDG, drawn ${fmt(line.drawn)}, available ${fmt(line.available)}; open loans: ${body.agent?.activeLoans ?? 0}.`;
    } catch (error) {
      return `Error reading agent #${args.agentId}'s line: ${error}`;
    }
  }

  /**
   * Borrows USDG from the agent's Priors line into this wallet.
   *
   * @param walletProvider - The wallet provider: the agent's owner or its registry wallet.
   * @param args - The agent id, the amount and the term.
   * @returns The loan, or an error message.
   */
  @CreateAction({
    name: "borrow_from_priors",
    description: `
This tool borrows USDG from the agent's Priors credit line into this wallet, on Robinhood Chain. Real money: the loan
must be repaid (principal and fee) before its due date, or the agent's record ends in a default.

Inputs:
- agentId: the agent's ERC-8004 id; this wallet must be its owner or its registry wallet.
- amount: USDG to borrow, e.g. 1.5 (at least the pool's minimum loan).
- days: the loan term in days (default 7).`,
    schema: BorrowSchema,
  })
  async borrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BorrowSchema>,
  ): Promise<string> {
    try {
      const amount = exactUsdg(args.amount, "amount");
      const loan = await this.onePerWallet(walletProvider, () =>
        this.borrowAmount(walletProvider, args.agentId, amount, args.days),
      );
      return `Borrowed ${usdg(loan.amount)} USDG from agent #${args.agentId}'s Priors line: loan #${loan.loanId}, fee ${usdg(loan.fee)} USDG, due ${loan.dueAt}. Transaction: ${loan.hash}`;
    } catch (error) {
      if (error instanceof Refusal) return `Error: ${error.message}`;
      if (error instanceof BorrowUnconfirmed) return `Error: ${error.message}.`;
      return `Error borrowing from Priors: ${unfenced(String(error))}`;
    }
  }

  /**
   * Repays a Priors loan in full from this wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The loan id.
   * @returns The repayment, or an error message.
   */
  @CreateAction({
    name: "repay_priors_loan",
    description: `
This tool repays a Priors loan in full (principal and fee) from this wallet's USDG on Robinhood Chain. Real money. Only a
loan of an agent this wallet owns or is the declared wallet of, taken by its current owner, is repaid.

Inputs:
- loanId: the loan to repay.
- agentId: the agent whose loan it is (optional; a loan of another agent is refused).`,
    schema: RepaySchema,
  })
  async repay(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RepaySchema>,
  ): Promise<string> {
    // one money call at a time per wallet (lockWallet)
    const release = await this.lockWallet(walletProvider);
    try {
      const loan = (await walletProvider.readContract({
        address: PRIORS_POOL,
        abi: POOL_ABI,
        functionName: "getLoan",
        args: [BigInt(args.loanId)],
      })) as { agentId: bigint; principal: bigint; fee: bigint; owner: string; status: number };
      if (Number(loan.status) !== LOAN_ACTIVE) return `Error: loan #${args.loanId} is not active.`;
      if (args.agentId !== undefined && BigInt(args.agentId) !== BigInt(loan.agentId))
        return `Error: loan #${args.loanId} belongs to agent #${loan.agentId}, not #${args.agentId}. Nothing was repaid.`;
      // The pool lets anyone repay any loan: this wallet's USDG goes only to a loan of an agent it acts for (its owner or
      // declared wallet), opened by the owner it has now (a loan taken while someone else held the agent is theirs)
      const holder = await this.control(walletProvider, BigInt(loan.agentId), "repaid");
      if (String(loan.owner).toLowerCase() !== holder.toLowerCase())
        return `Error: loan #${args.loanId} was opened by ${loan.owner}, which held agent #${loan.agentId} then; its owner now (${holder}) did not take it. Nothing was repaid.`;
      const due = loan.principal + loan.fee;
      const me = walletProvider.getAddress() as Hex;
      const balance = (await walletProvider.readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [me],
      })) as bigint;
      if (balance < due)
        return `Error: repaying loan #${args.loanId} needs ${usdg(due)} USDG, the wallet holds ${usdg(balance)}.`;
      const allowance = (await walletProvider.readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: "allowance",
        args: [me, PRIORS_POOL],
      })) as bigint;
      if (allowance < due) {
        const approve = await walletProvider.sendTransaction({
          to: USDG,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [PRIORS_POOL, due],
          }),
        });
        mined(await walletProvider.waitForTransactionReceipt(approve), "USDG approval", approve);
      }
      const hash = await walletProvider.sendTransaction({
        to: PRIORS_POOL,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: "repay",
          args: [BigInt(args.loanId), loan.agentId, due],
        }),
      });
      mined(await walletProvider.waitForTransactionReceipt(hash), "repay", hash);
      return `Repaid Priors loan #${args.loanId}: ${usdg(due)} USDG. Transaction: ${hash}`;
    } catch (error) {
      if (error instanceof Refusal) return `Error: ${error.message}`;
      return `Error repaying loan #${args.loanId}: ${unfenced(String(error))}`;
    } finally {
      release();
    }
  }

  /**
   * Pays an x402 URL in USDG on Robinhood Chain, borrowing the gap from the Priors line when the wallet is short.
   *
   * @param walletProvider - The wallet provider: the agent's owner or its registry wallet.
   * @param args - The URL, the agent id, the most to pay and the most to borrow.
   * @returns What was paid and borrowed and the response, or an error message.
   */
  @CreateAction({
    name: "pay_x402_with_priors_credit",
    description: `
This tool fetches a URL that charges per call with x402 (HTTP 402) and pays it in USDG on Robinhood Chain from this
wallet, with GET, or with POST and a body (an OpenAI-style chat completion, for one). If the wallet is short of the
price, it first borrows the gap from the agent's Priors line, only when maxBorrow covers it, or, when the provider was
set up with autoBorrow, on its own within the owner's limits while Autopay covers the loan. Real money: confirm the URL,
the price and the most to borrow with the user first. It signs one payment per purchase: while a payment it signed may
still settle, a call for the same purchase (the same method, URL and body) sends that payment again, never a new one.

Inputs:
- url: the https URL.
- agentId: the agent's ERC-8004 id whose line may be drawn.
- maxPrice: the most to pay for this call, in USDG (e.g. 0.10).
- maxBorrow: the most to borrow if the wallet is short, in USDG (default 0: never borrow; with autoBorrow, its amount
  per call, which this can only lower).
- days: the term of a loan taken for the gap (default 7; with autoBorrow always 14, the owner's, whatever this says).
- method, body: POST and its body (default GET with no body).`,
    schema: PayX402WithCreditSchema,
  })
  async payX402WithCredit(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PayX402WithCreditSchema>,
  ): Promise<string> {
    // a loan taken for the gap stays in the answer, whatever happens to the payment after it
    let borrowed = "";
    try {
      if (!/^https:\/\//i.test(args.url)) return "Error: only https URLs are paid.";
      await publicHost(new URL(args.url));
      const method = args.method ?? (args.body !== undefined ? "POST" : "GET");
      if (method === "GET" && args.body !== undefined)
        return "Error: a GET request cannot carry a body: use POST.";
      let json = false;
      if (args.body !== undefined) {
        try {
          JSON.parse(args.body);
          json = true;
        } catch {
          json = false;
        }
      }
      // a redirect is never followed, the paid request's included (its signed payment would go with it)
      const init = (): RequestInit =>
        args.body !== undefined
          ? {
              method,
              body: args.body,
              headers: { "content-type": json ? "application/json" : "text/plain; charset=utf-8" },
              redirect: "manual",
            }
          : { method, redirect: "manual" };
      const maxPrice = exactUsdg(args.maxPrice, "maxPrice");
      // autoBorrow: the owner's amount per call, which the model's maxBorrow can only lower, and only for its hosts
      const auto = this.auto;
      const host = new URL(args.url).host.toLowerCase();
      const autoHere = !!auto && auto.hosts.has(host);
      const named = exactUsdg(args.maxBorrow ?? "0", "maxBorrow");
      const maxBorrow = !auto
        ? named
        : !autoHere
          ? 0n
          : args.maxBorrow === undefined || named > auto.perCall
            ? auto.perCall
            : named;
      // autoBorrow: the owner's term, 14 days, whatever the model names; otherwise the term asked
      const days = auto ? AUTO_TERM_DAYS : (args.days ?? DEFAULT_TERM_DAYS);
      const me = walletProvider.getAddress() as Hex;
      const purchase = `${me.toLowerCase()} ${await purchaseKey(new Request(args.url, init()))}`;
      return await this.onePerWallet(walletProvider, async () => {
        // a payment signed for this purchase that may still settle is sent again, before anything is probed or borrowed
        const now = Math.floor(Date.now() / 1000);
        for (const [k, v] of this.unsettled)
          if (v.validBefore + SKEW_SECONDS <= now) this.unsettled.delete(k);
        const out = this.unsettled.get(purchase);
        if (out) {
          const r = await resend(args.url, out.paymentHeaders, {
            ...RESEND,
            init: init(),
            fetchImpl: this.fetchImpl,
          });
          if (r.response.ok) this.unsettled.delete(purchase);
          const first = out.borrowed ? `Its first attempt: ${out.borrowed}` : "\n";
          return guarded(
            `No new payment was signed: the payment of ${usdg(out.price)} USDG to ${out.payTo} signed earlier for this purchase was sent again. ${first}${await this.outcome(r, out, SKEW_SECONDS)}`,
          );
        }
        // the probe, its body included, within REQUEST_TIMEOUT_MS: the wallet's other money calls wait for this one
        let probe: Response;
        try {
          probe = await this.fetchImpl(args.url, {
            ...init(),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
        } catch (error) {
          if (isAbort(error))
            throw new Refusal(
              `${host} did not answer within ${REQUEST_TIMEOUT_MS / 1000} s. Nothing was signed or paid.`,
            );
          throw error;
        }
        if (probe.status >= 300 && probe.status < 400) {
          const to = probe.headers.get("location");
          return guarded(
            `The URL answered a redirect (HTTP ${probe.status}), not followed: nothing was paid.${to ? `\n${fenced(to.slice(0, 500), "redirect target")}` : ""}`,
          );
        }
        if (probe.status !== 402) {
          let text = "";
          let unread = false;
          try {
            ({ text } = await readCapped(probe));
          } catch {
            unread = true;
          }
          return guarded(
            `No payment asked (HTTP ${probe.status}). Response:\n${fenced(text.slice(0, 2000), "response body")}${unread ? `\n${UNREAD}` : ""}`,
          );
        }
        // the 402 (the PAYMENT-REQUIRED header, else a v2 body), and its requirement: exact USDG on Robinhood Chain by
        // EIP-3009, on USDG's own EIP-712 domain, to a 0x payTo
        const http = new x402HTTPClient(new x402Client());
        let body: { x402Version?: unknown; accepts?: unknown } | undefined;
        try {
          const { text } = await readCapped(probe);
          body = text ? JSON.parse(text) : undefined;
        } catch {
          body = undefined;
        }
        let required: ReturnType<typeof http.getPaymentRequiredResponse> | null;
        try {
          required = http.getPaymentRequiredResponse(n => probe.headers.get(n), body);
        } catch {
          required =
            body && body.x402Version === 2 && Array.isArray(body.accepts)
              ? (body as ReturnType<typeof http.getPaymentRequiredResponse>)
              : null;
        }
        const requirement =
          required && required.x402Version === 2 ? pickUsdgRequirement(required.accepts) : null;
        if (!required || !requirement)
          return "Error: the URL asks for no USDG payment on Robinhood Chain (x402 v2 exact, EIP-3009).";
        const price = BigInt(requirement.amount);
        if (price > maxPrice)
          return `Error: the URL asks ${usdg(price)} USDG, above maxPrice ${args.maxPrice}. Nothing was paid.`;
        const payTo = String(requirement.payTo);
        // the client that signs (usdgClient): USDG on Robinhood Chain only, at most the probed price, an authorization
        // valid at most 600 s; asked before anything is borrowed whether it signs this requirement (a refusal at signing
        // time must never come after a loan)
        const client = usdgClient(walletProvider.toSigner(), price);
        try {
          (
            client as unknown as { selectPaymentRequirements(v: number, r: unknown[]): unknown }
          ).selectPaymentRequirements(2, [requirement]);
        } catch {
          return "Error: x402 would not sign the requirement this URL asks for. Nothing was borrowed or paid.";
        }
        const balance = (await walletProvider.readContract({
          address: USDG,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [me],
        })) as bigint;
        if (balance < price) {
          const params = (await walletProvider.readContract({
            address: PRIORS_POOL,
            abi: POOL_ABI,
            functionName: "getParams",
          })) as { minLoan: bigint; maxTerm: bigint };
          const gap = price - balance;
          const amount = gap > params.minLoan ? gap : params.minLoan;
          if (auto && !autoHere)
            return `Error: the wallet holds ${usdg(balance)} USDG, short of ${usdg(price)}, and auto-borrow borrows only to pay ${[...auto.hosts].join(", ")}. Nothing was borrowed or paid.`;
          if (amount > maxBorrow) {
            return `Error: the wallet holds ${usdg(balance)} USDG, short of ${usdg(price)}; borrowing ${usdg(amount)} (the pool's minimum loan is ${usdg(params.minLoan)}) is above ${auto ? `the most this call may borrow, ${usdg(maxBorrow)}` : `maxBorrow ${args.maxBorrow || "0"}`}. Nothing was paid.`;
          }
          // auto: the day's room is taken here, before any await, so two calls running at once never both pass the
          // limit; it is given back whenever the borrow stops before its transaction is sent (refused, a read failing,
          // the wallet's control at the pool refused or unread) and when its receipt says it reverted (it moved
          // nothing); a borrow whose sending began otherwise stays counted (its answer may be lost: the safe direction)
          let reserved: { day: string; amount: bigint } | null = null;
          let sending = false;
          if (auto) {
            const today = utcDay();
            if (this.borrowedToday.day !== today) this.borrowedToday = { day: today, amount: 0n };
            if (this.borrowedToday.amount + amount > auto.perDay)
              return `Error: the wallet holds ${usdg(balance)} USDG, short of ${usdg(price)}, and auto-borrow's limit of ${usdg(auto.perDay)} USDG a day has ${usdg(auto.perDay - this.borrowedToday.amount)} left in this process, less than ${usdg(amount)}. Nothing was borrowed or paid.`;
            this.borrowedToday.amount += amount;
            reserved = { day: today, amount };
          }
          // auto: 14 days, brought down to the pool's maxTerm; otherwise the term asked, as before
          const termDays =
            auto && params.maxTerm !== undefined && BigInt(days) * 86400n > BigInt(params.maxTerm)
              ? Number(BigInt(params.maxTerm) / 86400n)
              : days;
          const loan = await this.borrowAmount(
            walletProvider,
            args.agentId,
            amount,
            termDays,
            auto
              ? (fee: bigint) => this.autopayCovers(walletProvider, args.agentId, amount + fee)
              : undefined,
            "borrowed or paid",
            () => {
              sending = true; // the borrow's transaction is sent right after this
            },
          ).catch((error: unknown) => {
            if (
              reserved &&
              (!sending || error instanceof Reverted) &&
              this.borrowedToday.day === reserved.day
            )
              this.borrowedToday.amount -= reserved.amount;
            throw error;
          });
          borrowed = `Borrowed ${usdg(loan.amount)} USDG first: loan #${loan.loanId}, fee ${usdg(loan.fee)}, due ${loan.dueAt} (transaction ${loan.hash}). ${auto ? "Auto-borrow: Autopay repays it from this wallet in its window, the last hours before it is due; keep its due in the wallet by then." : "Repay it with repay_priors_loan before then."}\n`;
        }
        // the one signature for this purchase: the requirement probed (checked against maxPrice, and borrowed for), kept
        // before it leaves, and from then on only sent again (resend: once the payment may be out, a dropped connection
        // or a timeout is an answer, never an error that loses it)
        const payload = await client.createPaymentPayload({ ...required, accepts: [requirement] });
        const validBefore = Number(
          (payload.payload as { authorization?: { validBefore?: unknown } }).authorization
            ?.validBefore,
        );
        const signed: Signed = {
          paymentHeaders: http.encodePaymentSignatureHeader(payload),
          validBefore: Number.isSafeInteger(validBefore) ? validBefore : now + MAX_VALIDITY_SECONDS,
          price,
          payTo,
          borrowed,
        };
        this.unsettled.set(purchase, signed);
        const r = await resend(args.url, signed.paymentHeaders, {
          ...RESEND,
          init: init(),
          fetchImpl: this.fetchImpl,
        });
        if (r.response.ok) this.unsettled.delete(purchase);
        return guarded(`${borrowed}${await this.outcome(r, signed, SKEW_SECONDS)}`);
      });
    } catch (error) {
      if (error instanceof Refusal) return guarded(`${borrowed}Error: ${error.message}`);
      if (error instanceof BorrowUnconfirmed)
        return guarded(`Error: ${error.message}. Nothing was signed or paid.`);
      return guarded(
        `${borrowed}Error paying ${unfenced(args.url)} with Priors credit: ${unfenced(String(error))}`,
      );
    }
  }

  /**
   * Checks if the action provider supports the given network: Robinhood Chain only.
   *
   * @param network - The network to check.
   * @returns True on Robinhood Chain (chain id 4663).
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && String(network.chainId) === ROBINHOOD_CHAIN_ID;

  /**
   * Auto-borrow's condition, read before the borrow is sent: this wallet is the agent's declared wallet, its Autopay
   * plan is on and set under the agent's current owner and key, not held or paused, its limit per loan is at least
   * `due`, and its USDG approval to AutoRepay covers `due` on top of the agent's open loans it already repays (those
   * within its limit). Throws a Refusal saying what to turn on otherwise.
   *
   * @param walletProvider - The wallet provider.
   * @param agentId - The agent id.
   * @param due - The new loan's principal plus fee, atomic USDG.
   */
  private async autopayCovers(walletProvider: EvmWalletProvider, agentId: number, due: bigint) {
    const me = walletProvider.getAddress() as Hex;
    const id = BigInt(agentId);
    const read = (
      address: Hex,
      abi: typeof REGISTRY_ABI | typeof AUTOREPAY_ABI | typeof erc20Abi,
      functionName: string,
      args: unknown[] = [],
    ) =>
      walletProvider.readContract({
        address,
        abi,
        functionName,
        args,
      } as never) as Promise<unknown>;
    const [wallet, owner, plan, epoch, held, pausedUntil, allowance] = (await Promise.all([
      read(REGISTRY, REGISTRY_ABI, "getAgentWallet", [id]),
      read(REGISTRY, REGISTRY_ABI, "ownerOf", [id]),
      read(AUTOREPAY, AUTOREPAY_ABI, "planOf", [me, id]),
      read(AUTOREPAY, AUTOREPAY_ABI, "epochOf", [id]),
      read(AUTOREPAY, AUTOREPAY_ABI, "held", [me]),
      read(AUTOREPAY, AUTOREPAY_ABI, "pausedUntil"),
      read(USDG, erc20Abi, "allowance", [me, AUTOREPAY]),
    ])) as [
      string,
      string,
      readonly [number | bigint, string, boolean, boolean, boolean, number | bigint],
      readonly [number | bigint, boolean],
      boolean,
      bigint,
      bigint,
    ];
    const no = (why: string) =>
      new Refusal(
        `auto-borrow borrows only when Autopay covers the new loan (${usdg(due)} USDG due), and ${why}. Nothing was borrowed or paid. Turn Autopay on for this wallet with a limit of at least ${usdg(due)} USDG per loan (Go mode, or @priors/mcp's autopay_on).`,
      );
    const [cap, planOwner, on, , , planEpoch] = plan;
    if (!sameAddress(wallet, me))
      throw no(`this wallet is not agent #${agentId}'s declared wallet`);
    // AutoRepayV2 pays a wallet plan only from a declared wallet that is not the agent's owner (_walletPart: wallet !=
    // l.owner); register() declares its caller, so an agent minted from this wallet has no wallet plan that pays
    if (sameAddress(owner, me))
      throw new Refusal(
        `auto-borrow borrows only when Autopay covers the new loan (${usdg(due)} USDG due), and agent #${agentId}'s declared wallet is its owner's own address (this wallet): AutoRepay never repays from that address under a wallet plan, so no plan covers the loan. Nothing was borrowed or paid. Declare a key of the agent's own as its wallet (the registry's setAgentWallet) and turn Autopay on from that key, or repay by hand.`,
      );
    if (!on) throw no("Autopay is off for this wallet");
    if (!sameAddress(planOwner, owner) || BigInt(planEpoch) !== BigInt(epoch[0]))
      throw no("this wallet's Autopay plan was set under an earlier owner or key of the agent");
    if (held) throw no("Autopay is on hold for this wallet");
    if (BigInt(pausedUntil) > BigInt(Math.floor(Date.now() / 1000)))
      throw no("Autopay is paused by the Safe");
    if (BigInt(cap) < due) throw no(`Autopay's limit is ${usdg(BigInt(cap))} USDG per loan`);
    // what the agent's open loans already need from that approval: each active loan within the plan's limit
    const ids = (await walletProvider.readContract({
      address: PRIORS_POOL,
      abi: POOL_ABI,
      functionName: "loansOf",
      args: [id],
    })) as readonly bigint[];
    let owed = 0n;
    for (const loanId of ids) {
      const l = (await walletProvider.readContract({
        address: PRIORS_POOL,
        abi: POOL_ABI,
        functionName: "getLoan",
        args: [loanId],
      })) as { principal: bigint; fee: bigint; status: number };
      const loanDue = BigInt(l.principal) + BigInt(l.fee);
      if (Number(l.status) === LOAN_ACTIVE && loanDue <= BigInt(cap)) owed += loanDue;
    }
    if (BigInt(allowance) < owed + due)
      throw no(
        `Autopay may pull ${usdg(BigInt(allowance))} USDG from this wallet, and its open loans already need ${usdg(owed)} USDG`,
      );
  }

  /**
   * Before this wallet's money moves for agent `agentId` (a borrow into it, a repayment from it), Priors' own client
   * rule (needController): the wallet controls the agent at the pool AND is its current owner or its declared
   * ERC-8004 wallet. The pool lets an owner name any address its delegate with no word from that address, so being a
   * controller is no proof this wallet acts for that owner; the declared wallet is set only by that wallet's own
   * signature naming the owner, and a transfer clears it. Throws a Refusal (nothing sent) otherwise.
   *
   * @param walletProvider - The wallet provider.
   * @param agentId - The agent id.
   * @param did - What did not happen when refused ("repaid", "borrowed").
   * @returns The agent's current owner.
   */
  private async control(
    walletProvider: EvmWalletProvider,
    agentId: bigint,
    did: string,
  ): Promise<string> {
    const me = walletProvider.getAddress() as Hex;
    const read = (
      address: Hex,
      abi: typeof REGISTRY_ABI | typeof POOL_ABI,
      functionName: string,
      args: unknown[],
    ) =>
      walletProvider.readContract({
        address,
        abi,
        functionName,
        args,
      } as never) as Promise<unknown>;
    if (!(await read(PRIORS_POOL, POOL_ABI, "isController", [agentId, me])))
      throw new Refusal(
        `this wallet (${me}) does not control agent #${agentId} on the pool (it is neither its owner nor its delegate). Nothing was ${did}.`,
      );
    const holder = String(await read(REGISTRY, REGISTRY_ABI, "ownerOf", [agentId]));
    if (sameAddress(holder, me)) return holder;
    if (sameAddress(await read(REGISTRY, REGISTRY_ABI, "getAgentWallet", [agentId]), me))
      return holder;
    throw new Refusal(
      `this wallet (${me}) is neither agent #${agentId}'s owner (${holder}) nor its declared ERC-8004 wallet, and a pool delegate the owner named is no proof it acts for that owner. Nothing was ${did}. Declare this key as the agent's wallet (the registry's setAgentWallet, signed by this key), or use the owner's key.`,
    );
  }

  /**
   * What became of a payment sent: paid only on a 2xx answer. Anything else (a dropped connection, no answer in time,
   * a 5xx, a 402, a redirect) leaves it signed and sent, cashable by the seller until it expires, and a later call for
   * the purchase sends it again. A body that breaks off while it is read (a reset, the request's timeout) changes
   * neither: it is said, and a 2xx stays paid (the purchase is done, so a call again pays again: the answer says so).
   *
   * @param r - What resend answered.
   * @param s - The payment sent.
   * @param skew - SKEW_SECONDS, the margin kept past validBefore.
   * @returns The answer's words for it.
   */
  private async outcome(r: Sent, s: Signed, skew: number): Promise<string> {
    const res = r.response;
    // of the settlement header, only its transaction hash: the rest is the seller's words
    const tx = settledTx(
      res.headers.get("payment-response") || res.headers.get("x-payment-response"),
    );
    let text = "";
    let unread = false;
    try {
      ({ text } = await readCapped(res));
    } catch {
      unread = true;
    }
    text = text.slice(0, 2000);
    const body = text ? `\nResponse:\n${fenced(text, "response body")}` : "";
    const status = r.timedOut
      ? "no answer in time"
      : r.transportError
        ? "the connection was lost"
        : `HTTP ${res.status}`;
    if (res.ok)
      return `Paid ${usdg(s.price)} USDG to ${s.payTo} (${status})${tx ? `; settled in ${tx}` : ""}.${body}${unread ? `\n${UNREAD} This does not undo the payment, and calling again for this purchase pays again: ask the seller for the result instead.` : ""}`;
    const until = new Date((s.validBefore + skew) * 1000).toISOString();
    const redirect = res.status >= 300 && res.status < 400 ? ", a redirect, not followed" : "";
    return `The payment of ${usdg(s.price)} USDG to ${s.payTo} was signed and sent (${status}${redirect}), and the seller may still settle it until ${until}${tx ? ` (it names ${tx})` : ""}: do NOT call pay_x402_with_priors_credit again for this purchase (the same method, URL and body) before then. A later call for it sends this same payment again, never a new one.${body}${unread ? `\n${UNREAD}` : ""}`;
  }

  /**
   * Waits for this wallet's money call under way, if any, and holds the wallet until the release it returns is called:
   * one money call at a time per wallet (a payment, a borrow, a repayment). Two calls at once on a short wallet would
   * each read its balance short and each borrow the gap, and each pass auto-borrow's Autopay check on an approval that
   * covers one loan; the next call waits, then reads what the first did (a call for a purchase whose payment may still
   * settle then sends that payment again).
   *
   * @param walletProvider - The wallet the call moves money from.
   * @returns The release.
   */
  private async lockWallet(walletProvider: EvmWalletProvider): Promise<() => void> {
    const key = String(walletProvider.getAddress()).toLowerCase();
    const before = this.running.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const mine = before.then(() => held);
    this.running.set(key, mine);
    await before;
    return () => {
      release();
      if (this.running.get(key) === mine) this.running.delete(key);
    };
  }

  /**
   * Runs `fn` as this wallet's one money call (lockWallet).
   *
   * @param walletProvider - The wallet the call moves money from.
   * @param fn - The call.
   * @returns What the call answers.
   */
  private async onePerWallet<T>(
    walletProvider: EvmWalletProvider,
    fn: () => Promise<T>,
  ): Promise<T> {
    const release = await this.lockWallet(walletProvider);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Borrows `amount` atomic USDG for `days` from the agent's line into this wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param agentId - The agent id.
   * @param amount - Atomic USDG.
   * @param days - The term in days.
   * @param check - Called with the quoted fee before the borrow is sent; a throw refuses it.
   * @param did - What did not happen when the borrow is refused ("borrowed", "borrowed or paid").
   * @param onSend - Called right before the transaction is sent, once every check has passed.
   * @returns The loan. Throws Reverted when its receipt says it reverted, BorrowUnconfirmed when the wait for its
   * receipt fails once it was sent.
   */
  private async borrowAmount(
    walletProvider: EvmWalletProvider,
    agentId: number,
    amount: bigint,
    days: number,
    check?: (fee: bigint) => Promise<void>,
    did = "borrowed",
    onSend?: () => void,
  ) {
    const me = walletProvider.getAddress() as Hex;
    const term = BigInt(days * 86400);
    const [fee] = (await walletProvider.readContract({
      address: PRIORS_POOL,
      abi: POOL_ABI,
      functionName: "quoteFee",
      args: [BigInt(agentId), amount, term],
    })) as readonly [bigint, bigint, bigint, bigint];
    if (check) await check(fee);
    // the same rule as repay, before anything is sent: no key borrows here for an agent it would then be refused to
    // repay for
    await this.control(walletProvider, BigInt(agentId), did);
    onSend?.();
    const hash = await walletProvider.sendTransaction({
      to: PRIORS_POOL,
      data: encodeFunctionData({
        abi: POOL_ABI,
        functionName: "borrow",
        args: [BigInt(agentId), amount, term, me, fee],
      }),
    });
    // once sent, a lost answer may still have opened a loan: said with its hash, never dropped from the answer
    let receipt: Awaited<ReturnType<EvmWalletProvider["waitForTransactionReceipt"]>>;
    try {
      receipt = await walletProvider.waitForTransactionReceipt(hash);
    } catch (error) {
      throw new BorrowUnconfirmed(amount, hash, error);
    }
    mined(receipt, "borrow", hash);
    let loanId = "?";
    let dueAt = "?";
    for (const log of (receipt?.logs ?? []) as Array<{
      address: string;
      data: Hex;
      topics: [Hex, ...Hex[]];
    }>) {
      if (!sameAddress(log.address, PRIORS_POOL)) continue;
      try {
        const ev = decodeEventLog({ abi: POOL_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "Borrowed") {
          loanId = String(ev.args.loanId);
          dueAt = new Date(Number(ev.args.dueAt) * 1000).toISOString();
        }
      } catch {
        // another event of the pool
      }
    }
    return { amount, fee, hash, loanId, dueAt };
  }
}

export const priorsActionProvider = (fetchImpl?: typeof fetch, options?: PriorsOptions) =>
  new PriorsActionProvider(fetchImpl, options);
