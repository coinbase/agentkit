import { QHOOKS_SECURITY } from "./plan-security";
// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
type Policy = { manager: string; feeRouter: string | null; permit2: string };
// Pinned deployment policy from the published chain registry, never a remote plan.
const POLICIES: Readonly<Record<string, Readonly<Policy>>> = {
  "1": {
    manager: "0x000000000004444c5dc75cb358380d2e3de08a90",
    feeRouter: "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "56": {
    manager: "0x28e2ea090877bf75740558f6bfb36a5ffee9e9df",
    feeRouter: "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "143": {
    manager: "0x188d586ddcf52439676ca21a244753fa19f9ea8e",
    feeRouter: null,
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "4663": {
    manager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
    feeRouter: "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "8453": {
    manager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    feeRouter: "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "42161": {
    manager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
    feeRouter: "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  "99901": {
    manager: "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1",
    feeRouter: "0xff208831ed6f0c4e3e3224effa45fae7906dc6c2",
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
};
const ZERO = "0x" + "0".repeat(40);
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HEX = /^0x(?:[0-9a-f]{2})*$/i;
const UINT = /^(0|[1-9][0-9]*)$/;
const U128 = 1n << 128n;
/** Reject a plan before any transaction can be offered to a wallet. */
function fail(): never {
  throw new Error("QHooks unsigned trade plan does not match the request.");
}
const row = (value: unknown): Row =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : fail();
const addr = (value: unknown): string =>
  typeof value === "string" && ADDRESS.test(value) ? value.toLowerCase() : fail();
/**
 * Decode a canonical nonnegative decimal quantity.
 *
 * @param value - Untrusted wire quantity.
 * @param limit - Exclusive maximum.
 * @returns Exact integer value.
 */
function uint(value: unknown, limit = 1n << 256n): bigint {
  if (typeof value !== "string" || !UINT.test(value) || value.length > 78) fail();
  const n = BigInt(value);
  if (n >= limit) fail();
  return n;
}
/**
 * Decode a decimal or hexadecimal transaction value without number coercion.
 *
 * @param value - Untrusted wire quantity.
 * @returns Exact wei value.
 */
function valueOf(value: unknown): bigint {
  if (
    typeof value !== "string" ||
    !/^(?:0x[0-9a-f]+|0|[1-9][0-9]*)$/i.test(value) ||
    value.length > 78
  )
    fail();
  const n = BigInt(value);
  if (n >= 1n << 256n) fail();
  return n;
}
/**
 * Require a canonical selector and exact ABI word count.
 *
 * @param data - Untrusted calldata.
 * @param selector - Allowed selector.
 * @param count - Required word count.
 * @returns Lowercase ABI words.
 */
function words(data: unknown, selector: string, count: number): string[] {
  if (
    typeof data !== "string" ||
    !HEX.test(data) ||
    data.slice(0, 10).toLowerCase() !== selector ||
    data.length !== 10 + count * 64
  )
    fail();
  return Array.from({ length: count }, (_, i) =>
    data.slice(10 + i * 64, 74 + i * 64).toLowerCase(),
  );
}
const wordAddress = (word: unknown): string =>
  typeof word === "string" && /^0{24}[0-9a-f]{40}$/.test(word) ? "0x" + word.slice(24) : fail();
const number = (word: unknown): bigint =>
  typeof word === "string" && /^[0-9a-f]{64}$/.test(word) ? BigInt("0x" + word) : fail();
/**
 * Decode and range-check a sign-extended int24.
 *
 * @param word - ABI word.
 * @returns Signed integer.
 */
function signed24(word: unknown): bigint {
  let n = number(word);
  if (n >= 1n << 255n) n -= 1n << 256n;
  if (n < -(1n << 23n) || n >= 1n << 23n) fail();
  return n;
}
// This unsigned digest detects modification; request/ABI checks remain mandatory.
/**
 * Hash the canonical unsigned plan tuple; this does not authenticate its source.
 *
 * @param value - Parsed unsigned plan.
 * @returns Hex SHA-256 digest.
 */
export function tradePlanHash(value: unknown): string {
  const plan = row(value);
  if (!Array.isArray(plan.transactions)) fail();
  const tuple = [
    "qhooks.trade-plan.v1",
    String(plan.chainId),
    addr(plan.trader),
    plan.transactions.map((value: unknown) => {
      const tx = row(value);
      if (typeof tx.data !== "string" || !HEX.test(tx.data)) fail();
      return [
        String(tx.chainId),
        addr(tx.to),
        tx.data.toLowerCase(),
        valueOf(tx.value).toString(),
        tx.from === undefined ? null : addr(tx.from),
      ];
    }),
  ];
  return "0x" + createHash("sha256").update(JSON.stringify(tuple), "utf8").digest("hex");
}
/**
 * Bind every returned transaction to the original request and pinned router policy.
 *
 * @param value - Untrusted QHooks result.
 * @param originalRequest - Locally retained request after referrer defaults.
 * @param options - Clock override for deterministic verification.
 * @param options.now - Current time in milliseconds.
 * @param options.evidence - Independently read market identity and raw quote.
 */
export function validateTradePlan(
  value: unknown,
  originalRequest: unknown,
  { now = Date.now(), evidence }: { now?: number; evidence?: unknown } = {},
): void {
  const input = row(originalRequest),
    plan = row(value);
  const chain = typeof input.chain === "string" ? input.chain : fail();
  const policy = POLICIES[chain];
  if (!policy?.feeRouter) fail();
  const transactions = Array.isArray(plan.transactions) ? plan.transactions : fail();
  const destination = addr(row(transactions[transactions.length - 1]).to);
  const router =
    destination === policy.feeRouter ||
    (chain === "4663" && destination === "0x352a4a1d927ed21bddf5e22b1eed728714438bcd")
      ? destination
      : fail();
  const trader = addr(input.trader),
    token = addr(input.token);
  const amount = uint(input.amountIn, U128),
    slippage = input.slippageBps === undefined ? 100 : input.slippageBps;
  if (
    amount === 0n ||
    !["buy", "sell"].includes(String(input.side)) ||
    typeof slippage !== "number" ||
    !Number.isInteger(slippage) ||
    slippage < 0 ||
    slippage > 9999
  )
    fail();
  if (
    String(plan.chainId) !== chain ||
    String(plan.chain) !== chain ||
    addr(plan.trader) !== trader ||
    addr(plan.token) !== token ||
    plan.side !== input.side ||
    plan.amountIn !== input.amountIn ||
    plan.slippageBps !== slippage
  )
    fail();
  const minimum = uint(plan.minOut, U128),
    inputCurrency = addr(plan.inputCurrency),
    feeOnInput = input.side === "buy",
    q = row(plan.quote);
  if (
    String(q.chainId) !== chain ||
    addr(q.trader) !== trader ||
    typeof q.zeroForOne !== "boolean" ||
    q.routerFeeBps !== 100 ||
    q.source !== "V4Quoter"
  )
    fail();
  const gross = uint(q.grossAmountOut, U128),
    net = uint(q.netAmountOut, U128);
  if (
    minimum === 0n ||
    gross === 0n ||
    net !== gross - (feeOnInput ? 0n : (gross * 100n) / 10000n) ||
    minimum !== (net * BigInt(10000 - slippage)) / 10000n ||
    uint(q.amountOut, U128) !== gross ||
    uint(q.amountIn, U128) !== amount - (feeOnInput ? (amount * 100n) / 10000n : 0n)
  )
    fail();
  const deadline = plan.deadline;
  // Server deadlines are ten minutes; one minute accommodates local clock skew.
  if (
    typeof deadline !== "number" ||
    !Number.isSafeInteger(deadline) ||
    !Number.isFinite(now) ||
    deadline <= Math.floor(now / 1000) ||
    deadline > Math.floor(now / 1000) + 660
  )
    fail();
  if (
    !Array.isArray(plan.transactions) ||
    plan.transactions.length < 1 ||
    plan.transactions.length > 2
  )
    fail();
  const txs = plan.transactions.map((value: unknown) => row(value)),
    allowed = new Set([inputCurrency, router, policy.permit2]);
  for (const tx of txs) {
    if (
      Object.keys(tx).some(k => !["chainId", "to", "data", "value", "from"].includes(k)) ||
      String(tx.chainId) !== chain ||
      !allowed.has(addr(tx.to)) ||
      (tx.from !== undefined && addr(tx.from) !== trader) ||
      typeof tx.data !== "string" ||
      !HEX.test(tx.data)
    )
      fail();
    valueOf(tx.value);
  }
  if (txs.length === 2) {
    const approve = txs[0],
      w = words(approve.data, "0x095ea7b3", 2);
    if (
      inputCurrency === ZERO ||
      addr(approve.to) !== inputCurrency ||
      wordAddress(w[0]) !== router ||
      number(w[1]) !== amount ||
      valueOf(approve.value) !== 0n
    )
      fail();
  }
  const swap = txs[txs.length - 1],
    w = words(swap.data, "0xf5ec7c4b", 19);
  // Current single-hop ABI only; reject unknown selectors, Permit2 calls and hookData.
  if (
    addr(swap.to) !== router ||
    wordAddress(w[0]) !== policy.manager ||
    number(w[1]) !== 288n ||
    number(w[2]) !== amount ||
    number(w[3]) !== minimum ||
    wordAddress(w[4]) !== ZERO ||
    number(w[5]) !== (feeOnInput ? 1n : 0n) ||
    number(w[6]) !== 100n ||
    number(w[7]) !== BigInt(deadline) ||
    wordAddress(w[8]) !== addr(input.referrer ?? ZERO) ||
    number(w[9]) !== 1n ||
    number(w[10]) !== 32n ||
    number(w[13]) >= 1n << 24n ||
    signed24(w[14]) <= 0n ||
    number(w[16]) !== (q.zeroForOne ? 1n : 0n) ||
    number(w[17]) !== 224n ||
    number(w[18]) !== 0n
  )
    fail();
  const currency0 = wordAddress(w[11]),
    currency1 = wordAddress(w[12]);
  wordAddress(w[15]);
  const [currencyIn, currencyOut] = q.zeroForOne ? [currency0, currency1] : [currency1, currency0];
  if (
    BigInt(currency0) >= BigInt(currency1) ||
    currencyIn !== inputCurrency ||
    (feeOnInput ? currencyOut !== token : currencyIn !== token) ||
    valueOf(swap.value) !== (inputCurrency === ZERO ? amount : 0n)
  )
    fail();

  QHOOKS_SECURITY.checkTrade(
    plan,
    input,
    {
      currency0,
      currency1,
      fee: Number(number(w[13])),
      tickSpacing: Number(signed24(w[14])),
      hooks: wordAddress(w[15]),
    },
    evidence,
  );
  // swap outputs to msg.sender; no encoded trader/recipient is fabricated.
  const integrity = row(plan.integrity);
  if (
    integrity.schema !== "qhooks.trade-plan.v1" ||
    integrity.algorithm !== "sha256" ||
    typeof integrity.hash !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(integrity.hash) ||
    tradePlanHash(plan) !== integrity.hash
  )
    fail();
}
