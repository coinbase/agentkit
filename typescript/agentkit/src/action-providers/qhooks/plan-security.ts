// SPDX-License-Identifier: Apache-2.0
// Independent read policy. A plan cannot supply its own market/price authority.
type SecurityRow = Record<string, unknown>;
type SecurityReadTool = "token_info" | "quote" | "deal_status";
type SecurityRead = (name: SecurityReadTool, args: SecurityRow) => Promise<unknown>;
type ContractIntent = {
  tool: string;
  contract: string;
  actor: string;
  asset: string | null;
  amount: bigint;
  native: bigint;
  source: SecurityRow;
  selectors: string[];
};
export const QHOOKS_SECURITY = (() => {
  const Z = `0x${"0".repeat(40)}`;
  const OTC = "0xbea24499f82f1e018a4dff5607b7c54141cbfbf8";
  const AGREEMENT = "0x9b6e579dd876c364bf232d2958d7cc45937809bf";
  const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
  const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
  const U128 = 1n << 128n;
  const fail = (): never => {
    throw Error("Independent QHooks plan validation failed.");
  };
  const row = (v: unknown): SecurityRow =>
    v !== null && typeof v === "object" && !Array.isArray(v) ? (v as SecurityRow) : fail();
  const addr = (v: unknown): string =>
    typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v) ? v.toLowerCase() : fail();
  const integer = (v: unknown, limit = U128): bigint => {
    if (typeof v !== "string" || !/^(0|[1-9][0-9]*)$/.test(v) || v.length > 78) fail();
    const n = BigInt(v as string);
    return n < limit ? n : fail();
  };
  const val = (v: unknown): bigint => {
    if (typeof v !== "string" || !/^(?:0x[0-9a-f]+|0|[1-9][0-9]*)$/i.test(v) || v.length > 78)
      fail();
    const n = BigInt(v as string);
    return n < 1n << 256n ? n : fail();
  };
  const array = (v: unknown, max: number): unknown[] =>
    Array.isArray(v) && v.length > 0 && v.length <= max ? v : fail();
  const asset = (v: unknown): string =>
    v === "ETH" ? Z : v === "WETH" ? WETH : v === "USDG" ? USDG : addr(v);
  const word = (data: string, i: number): string => data.slice(10 + i * 64, 74 + i * 64);
  const wa = (v: string): string => (/^0{24}[0-9a-f]{40}$/.test(v) ? `0x${v.slice(24)}` : fail());
  const wn = (v: string): bigint => (/^[0-9a-f]{64}$/.test(v) ? BigInt(`0x${v}`) : fail());
  /**
   * Select the same listed pool as prepare_trade using a separate token_info response.
   *
   * @param input - Original caller arguments.
   * @param value - Independent token metadata.
   * @returns Canonical pool key and exact quote arguments.
   */
  function marketFor(input: SecurityRow, value: unknown) {
    const meta = row(row(value).meta);
    const token = addr(input.token);
    const chain = String(input.chain);
    if (String(meta.chainId) !== chain || addr(meta.token) !== token) fail();
    const pools = array(meta.pools, 100).map(row);
    const p = pools.find(p => p.label === "launch") ?? pools[0];
    const k = row(p.key);
    const id = p.id ?? p.poolId;
    if (
      typeof id !== "string" ||
      !/^0x[0-9a-f]{64}$/i.test(id) ||
      !Number.isSafeInteger(k.fee) ||
      Number(k.fee) < 0 ||
      Number(k.fee) >= 2 ** 24 ||
      !Number.isSafeInteger(k.tickSpacing) ||
      Number(k.tickSpacing) <= 0 ||
      Number(k.tickSpacing) >= 2 ** 23
    )
      fail();
    const c0 = addr(k.currency0);
    const c1 = addr(k.currency1);
    const hooks = addr(k.hooks);
    if (
      BigInt(c0) >= BigInt(c1) ||
      ![c0, c1].includes(token) ||
      !["buy", "sell"].includes(String(input.side))
    )
      fail();
    const direction = input.side === "buy" ? c1 === token : c0 === token;
    const amount = integer(input.amountIn);
    const quoted = amount - (input.side === "buy" ? (amount * 100n) / 10000n : 0n);
    if (amount === 0n || quoted === 0n) fail();
    return {
      chainId: chain,
      poolId: (id as string).toLowerCase(),
      currency0: c0,
      currency1: c1,
      hooks,
      fee: Number(k.fee),
      tickSpacing: Number(k.tickSpacing),
      zeroForOne: direction,
      amountIn: quoted.toString(),
      trader: addr(input.trader),
    };
  }
  /**
   * Read pool identity and quote independently of the transaction plan.
   *
   * @param original - Original caller arguments.
   * @param read - Trusted client transport for read-only tools.
   * @returns Independent market identity and raw pool quote.
   */
  async function readTrade(original: unknown, read: SecurityRead) {
    const input = row(original);
    const market = await read("token_info", {
      chain: input.chain,
      token: input.token,
    });
    const key = marketFor(input, market);
    const quote = await read("quote", {
      chain: key.chainId,
      pool: key.poolId,
      zeroForOne: key.zeroForOne,
      amountIn: key.amountIn,
      trader: key.trader,
    });
    return { key, quote };
  }
  /**
   * Bind decoded calldata and its minimum to independent market evidence.
   *
   * @param planValue - Returned unsigned plan.
   * @param inputValue - Original caller arguments.
   * @param decoded - Pool key decoded from swap calldata.
   * @param evidenceValue - Result of the separate client reads.
   * Throws before a plan can reach the wallet on any mismatch.
   */
  function checkTrade(
    planValue: unknown,
    inputValue: unknown,
    decoded: unknown,
    evidenceValue: unknown,
  ) {
    const p = row(planValue);
    const input = row(inputValue);
    const d = row(decoded);
    const e = row(evidenceValue);
    const k = row(e.key);
    const q = row(e.quote);
    const pq = row(p.quote);
    if (
      String(k.chainId) !== String(input.chain) ||
      addr(k.trader) !== addr(input.trader) ||
      String(q.chainId) !== String(input.chain) ||
      q.poolId !== k.poolId ||
      pq.poolId !== k.poolId ||
      q.zeroForOne !== k.zeroForOne ||
      pq.zeroForOne !== k.zeroForOne ||
      q.amountIn !== k.amountIn ||
      addr(q.trader) !== addr(input.trader)
    )
      fail();
    for (const name of ["currency0", "currency1", "hooks"])
      if (addr(d[name]) !== addr(k[name])) fail();
    if (d.fee !== k.fee || d.tickSpacing !== k.tickSpacing) fail();
    if (
      q.stale === true ||
      q.refreshing === true ||
      q.state === "not_checked" ||
      q.partial === true
    )
      fail();
    const gross = integer(q.amountOut);
    const net = gross - (input.side === "sell" ? (gross * 100n) / 10000n : 0n);
    const s = input.slippageBps ?? 100;
    if (
      typeof s !== "number" ||
      !Number.isInteger(s) ||
      s < 0 ||
      s > 9999 ||
      gross === 0n ||
      integer(p.minOut) < (net * BigInt(10000 - s)) / 10000n
    )
      fail();
  }
  /**
   * Convert an original human amount without floating point or guessed precision.
   *
   * @param value - Original decimal string.
   * @param decimals - Verified asset precision.
   * @returns Positive exact raw amount.
   */
  function decimal(value: unknown, decimals: number): bigint {
    if (
      typeof value !== "string" ||
      value.length > 80 ||
      !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)
    )
      fail();
    const [a, b = ""] = (value as string).split(".");
    if (b.length > decimals) fail();
    const n =
      BigInt(a) * 10n ** BigInt(decimals) +
      BigInt((b + "0".repeat(decimals)).slice(0, decimals) || "0");
    return n > 0n && n < U128 ? n : fail();
  }
  /**
   * Derive RH contract targets and funding amounts from original intent.
   *
   * @param tool - Requested preparation or selected status action.
   * @param original - Original caller arguments.
   * @param read - Trusted client transport for deal or asset metadata.
   * @returns Locally bounded contract intent, never values taken from plan transactions.
   */
  async function contractIntent(
    tool: string,
    original: unknown,
    read: SecurityRead,
  ): Promise<ContractIntent> {
    const input = row(original);
    if (String(input.chain ?? "4663") !== "4663") fail();
    const otc = tool.startsWith("otc_") || tool === "deal_status";
    const contract = otc ? OTC : AGREEMENT;
    const create = ["agreement_create", "agreement_fund", "agreement_from_template"].includes(tool);
    const actor = addr(create ? input.payer : input.actor);
    if (actor === Z) fail();
    let selectedAsset: string | null = null;
    let amount = 0n;
    let native = 0n;
    let source: SecurityRow = {};
    let selectors: string[] = [];
    if (tool === "otc_create" || tool === "otc_accept") {
      if (tool === "otc_create") source = row(input.quote);
      else {
        const state = row(
          await read("deal_status", {
            chain: "4663",
            dealId: input.dealId,
            actor,
          }),
        );
        if (
          state.termsHash !== input.expectedTermsHash ||
          String(state.dealId) !== String(input.dealId)
        )
          fail();
        source = row(state.deal);
      }
      const buyer = addr(source.buyer);
      const seller = addr(source.seller);
      if (![buyer, seller].includes(actor) || (tool === "otc_create" && actor !== buyer)) fail();
      const funding = tool === "otc_accept" || input.fundNow === true;
      selectedAsset = addr(actor === buyer ? source.payAsset : source.sellToken);
      amount = funding ? integer(actor === buyer ? source.payAmount : source.sellAmount) : 0n;
      if (![Z, WETH, USDG].includes(addr(source.payAsset))) fail();
      native = selectedAsset === Z ? amount : 0n;
      selectors =
        tool === "otc_create" ? ["0xc4e30b79"] : [actor === buyer ? "0x8b11a927" : "0x3c9a5e94"];
    } else if (create) {
      selectedAsset = asset(input.asset);
      let dec = selectedAsset === USDG ? 6 : 18;
      if (![Z, WETH, USDG].includes(selectedAsset)) {
        const meta = row(
          row(await read("token_info", { chain: "4663", token: selectedAsset })).meta,
        );
        if (
          String(meta.chainId) !== "4663" ||
          addr(meta.token) !== selectedAsset ||
          !Number.isSafeInteger(meta.decimals) ||
          Number(meta.decimals) < 0 ||
          Number(meta.decimals) > 36
        )
          fail();
        dec = Number(meta.decimals);
      }
      let amounts: unknown[] = [];
      if (tool !== "agreement_from_template")
        amounts = array(input.tranches, 10).map(x => row(x).amount);
      else {
        const params = row(input.params);
        if (input.template === "milestones")
          amounts = array(params.milestones, 10).map(x => row(x).amount);
        else if (input.template === "time_release" && params.schedule !== undefined)
          amounts = array(params.schedule, 10).map(x => row(x).amount);
        else if (
          ["arbiter_escrow", "time_release", "optimistic", "panel"].includes(String(input.template))
        )
          amounts = [params.amount];
        else fail();
      }
      amount = amounts.reduce<bigint>((n, v) => n + decimal(v, dec), 0n);
      if (amount >= U128) fail();
      native = selectedAsset === Z ? amount : 0n;
      source = input;
      selectors = ["0xbd18467a"];
    } else if (tool === "agreement_attest") selectors = ["0xa3bb24cc"];
    else if (tool === "agreement_release") selectors = ["0x366a4120"];
    else if (tool === "agreement_refund") selectors = ["0x278ecde1"];
    else if (tool === "agreement_status")
      selectors = [
        "0x40e58ee5",
        "0x6581e3ea",
        "0x15ca8746",
        "0xac30e880",
        "0x366a4120",
        "0x278ecde1",
        "0xa3bb24cc",
        "0x51cff8d9",
      ];
    else if (tool === "deal_status")
      selectors = ["0x40e58ee5", "0x68d0cf17", "0x1402b17a", "0xe60e1301", "0x51cff8d9"];
    else fail();
    return {
      tool,
      contract,
      actor,
      asset: selectedAsset,
      amount,
      native,
      source,
      selectors,
    };
  }
  /**
   * Reject unpinned contract calls, approvals and native value before wallet review.
   *
   * @param value - Returned unsigned transaction plan.
   * @param original - Original caller arguments.
   * @param c - Independently derived local contract intent.
   * Throws on unexpected targets, amounts, actions or chain. See README for semantic review limits.
   */
  function checkContract(value: unknown, original: unknown, c: ContractIntent) {
    const p = row(value);
    const input = row(original);
    const txs = array(p.transactions ?? p.txs, 2).map(row);
    if (
      !["prepared", "approval_required", "unfunded_creation_prepared"].includes(String(p.status)) ||
      p.unsigned !== true ||
      (p.escrow !== undefined && addr(p.escrow) !== c.contract) ||
      (p.chainId === undefined &&
        p.chain === undefined &&
        txs.some(t => String(t.chainId) !== "4663")) ||
      (p.transactions !== undefined && p.txs !== undefined) ||
      String(input.chain ?? "4663") !== "4663" ||
      (p.chainId !== undefined && String(p.chainId) !== "4663") ||
      (p.chain !== undefined && String(p.chain) !== "4663") ||
      p.ok === false ||
      p.error
    )
      fail();
    for (const a of [p.actor, p.payer, p.trader])
      if (a !== undefined && addr(a) !== c.actor) fail();
    let approvals = 0;
    let actions = 0;
    for (const [i, t] of txs.entries()) {
      if (
        Object.keys(t).some(
          k => !["chainId", "to", "from", "data", "value", "label", "simulation"].includes(k),
        ) ||
        (t.chainId !== undefined && String(t.chainId) !== "4663") ||
        addr(t.from ?? p.actor ?? p.payer ?? p.trader) !== c.actor ||
        typeof t.data !== "string" ||
        !/^0x(?:[0-9a-f]{2})+$/i.test(t.data) ||
        row(t.simulation ?? {}).ok === false
      )
        fail();
      const to = addr(t.to);
      const data = (t.data as string).toLowerCase();
      const sel = data.slice(0, 10);
      const v = val(t.value ?? "0");
      if (sel === "0x095ea7b3") {
        if (
          i !== 0 ||
          ++approvals !== 1 ||
          c.amount === 0n ||
          c.asset === null ||
          c.asset === Z ||
          to !== c.asset ||
          data.length !== 138 ||
          wa(word(data, 0)) !== c.contract ||
          wn(word(data, 1)) !== c.amount ||
          v !== 0n
        )
          fail();
      } else {
        if (
          ++actions !== 1 ||
          i !== txs.length - 1 ||
          to !== c.contract ||
          !c.selectors.includes(sel) ||
          v !== c.native
        )
          fail();
        if (sel === "0xc4e30b79") {
          const q = c.source;
          if (
            data.length !== 522 ||
            wa(word(data, 0)) !== addr(q.seller) ||
            wa(word(data, 1)) !== addr(q.sellToken) ||
            wn(word(data, 2)) !== integer(q.sellAmount) ||
            wa(word(data, 3)) !== addr(q.payAsset) ||
            wn(word(data, 4)) !== integer(q.payAmount) ||
            wn(word(data, 5)) !== integer(String(q.expiry)) ||
            wn(word(data, 6)) !== integer(String(q.feeBps)) ||
            wn(word(data, 7)) !== (input.fundNow === true ? 1n : 0n)
          )
            fail();
        } else if (sel === "0xbd18467a") {
          if (
            data.length < 394 ||
            wa(word(data, 0)) !== addr(input.payee) ||
            wa(word(data, 1)) !== c.asset ||
            wn(word(data, 2)) !== c.amount ||
            (input.expiry !== undefined && wn(word(data, 3)) !== BigInt(String(input.expiry)))
          )
            fail();
        } else if (sel !== "0x51cff8d9") {
          const id = input.dealId ?? input.id;
          if (wn(word(data, 0)) !== integer(id)) fail();
          if (
            ["0xa3bb24cc", "0x366a4120"].includes(sel) &&
            wn(word(data, 1)) !== BigInt(String(input.tranche ?? 0))
          )
            fail();
          if (sel === "0x3c9a5e94" && wa(word(data, 1)) !== addr(input.payout ?? c.source.payout))
            fail();
        }
      }
    }
    if (p.status === "approval_required" ? approvals !== 1 || actions !== 0 : actions !== 1) fail();
  }
  return { readTrade, checkTrade, contractIntent, checkContract };
})();
