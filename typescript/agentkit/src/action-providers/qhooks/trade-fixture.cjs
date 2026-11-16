const { createHash } = require("node:crypto");
const ZERO = "0x" + "0".repeat(40);
const ROUTERS = {
  1: ["0x000000000004444c5dc75cb358380d2e3de08a90", "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff"],
  56: ["0x28e2ea090877bf75740558f6bfb36a5ffee9e9df", "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff"],
  4663: [
    "0x8366a39cc670b4001a1121b8f6a443a643e40951",
    "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
  ],
  8453: [
    "0x498581ff718922c3f8e6a244956af099b2652b2b",
    "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
  ],
  42161: [
    "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
    "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff",
  ],
  99901: [
    "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1",
    "0xff208831ed6f0c4e3e3224effa45fae7906dc6c2",
  ],
};
const word = n => BigInt(n).toString(16).padStart(64, "0");
const addressWord = a => a.slice(2).toLowerCase().padStart(64, "0");
function rehash(plan) {
  const text = JSON.stringify([
    "qhooks.trade-plan.v1",
    String(plan.chainId),
    plan.trader.toLowerCase(),
    plan.transactions.map(tx => [
      String(tx.chainId),
      tx.to.toLowerCase(),
      tx.data.toLowerCase(),
      BigInt(tx.value).toString(),
      tx.from === undefined ? null : tx.from.toLowerCase(),
    ]),
  ]);
  plan.integrity = {
    schema: "qhooks.trade-plan.v1",
    algorithm: "sha256",
    hash: "0x" + createHash("sha256").update(text).digest("hex"),
  };
  return plan;
}
function validTrade(input, { payToken = ZERO, now = Date.now() } = {}) {
  const chain = String(input.chain),
    [manager, router] = ROUTERS[chain];
  const amount = BigInt(input.amountIn),
    buy = input.side === "buy",
    slippage = input.slippageBps ?? 100;
  const token = input.token.toLowerCase(),
    trader = input.trader.toLowerCase(),
    counter = payToken.toLowerCase();
  const [c0, c1] = BigInt(token) < BigInt(counter) ? [token, counter] : [counter, token];
  const inputCurrency = buy ? counter : token,
    zeroForOne = inputCurrency === c0;
  const gross = 2000000n,
    net = gross - (buy ? 0n : gross / 100n),
    minimum = (net * BigInt(10000 - slippage)) / 10000n;
  const deadline = Math.floor(now / 1000) + 600;
  // Canonical current single-hop encoding, independently checked against the real SDK in the offline integration test.
  const fields = [
    addressWord(manager),
    word(288),
    word(amount),
    word(minimum),
    addressWord(ZERO),
    word(buy ? 1 : 0),
    word(100),
    word(deadline),
    addressWord(input.referrer ?? ZERO),
    word(1),
    word(32),
    addressWord(c0),
    addressWord(c1),
    word(3000),
    word(60),
    addressWord(ZERO),
    word(zeroForOne ? 1 : 0),
    word(224),
    word(0),
  ];
  const transactions = [];
  if (inputCurrency !== ZERO)
    transactions.push({
      chainId: Number(chain),
      to: inputCurrency,
      data: "0x095ea7b3" + addressWord(router) + word(amount),
      value: "0x0",
    });
  transactions.push({
    chainId: Number(chain),
    to: router,
    data: "0xf5ec7c4b" + fields.join(""),
    value: inputCurrency === ZERO ? "0x" + amount.toString(16) : "0x0",
  });
  return rehash({
    chain,
    chainId: Number(chain),
    token,
    side: input.side,
    trader,
    inputCurrency,
    amountIn: String(input.amountIn),
    minOut: minimum.toString(),
    slippageBps: slippage,
    deadline,
    transactions,
    quote: {
      chainId: chain,
      trader,
      poolId: "0x" + "3".repeat(64),
      zeroForOne,
      amountIn: (amount - (buy ? amount / 100n : 0n)).toString(),
      amountOut: gross.toString(),
      grossAmountOut: gross.toString(),
      netAmountOut: net.toString(),
      routerFeeBps: 100,
      source: "V4Quoter",
    },
    partial: true,
    costUsd: null,
    notes: ["Fixture only; no wallet execution"],
  });
}
const setWord = (plan, index, n) => {
  const tx = plan.transactions.at(-1),
    start = 10 + index * 64;
  tx.data = tx.data.slice(0, start) + word(n) + tx.data.slice(start + 64);
};
function tamperedTrades(input) {
  const valid = validTrade(input),
    cases = [];
  const add = (name, mutate, hash = true) => {
    const plan = structuredClone(valid);
    mutate(plan);
    if (hash) rehash(plan);
    cases.push({ name, plan });
  };
  add("wrong envelope chain", p => (p.chain = "56"));
  add("wrong transaction chain", p => (p.transactions[0].chainId = 56));
  add("missing transaction chain", p => delete p.transactions[0].chainId);
  add("wrong target with recomputed hash", p => (p.transactions[0].to = "0x" + "9".repeat(40)));
  add("wrong trader", p => (p.trader = "0x" + "8".repeat(40)));
  add("wrong quote trader", p => (p.quote.trader = "0x" + "8".repeat(40)));
  add("wrong tx from", p => (p.transactions[0].from = "0x" + "8".repeat(40)));
  add("different encoded amount", p => setWord(p, 2, BigInt(input.amountIn) + 1n));
  add("different encoded minimum", p => setWord(p, 3, 1));
  add("zero net quote", p => (p.quote.netAmountOut = "0"));
  add("changed platform fee", p => setWord(p, 6, 101));
  add("different manager", p => setWord(p, 0, 1));
  add("different referral", p => setWord(p, 8, 7));
  add("expired deadline", p => (p.deadline = 1));
  add("excessive deadline", p => (p.deadline += 3600));
  add("unknown selector", p => (p.transactions.at(-1).data = "0x12345678"));
  add(
    "Permit2 call is not emitted by this protocol",
    p => (p.transactions.at(-1).to = "0x000000000022d473030f116ddee9f6b43ac78ba3"),
  );
  add("extra transaction envelope field", p => (p.transactions[0].gas = "0xffffffffffff"));
  add(
    "unexpected native value",
    p => (p.transactions.at(-1).value = "0x" + (BigInt(input.amountIn) + 1n).toString(16)),
  );
  add("missing integrity", p => delete p.integrity, false);
  add("digest mismatch", p => (p.integrity.hash = "0x" + "0".repeat(64)), false);
  const approval = validTrade(input, { payToken: "0x4200000000000000000000000000000000000006" });
  for (const [name, mutate] of [
    [
      "unlimited approval",
      p => (p.transactions[0].data = p.transactions[0].data.slice(0, 74) + word((1n << 256n) - 1n)),
    ],
    [
      "approval to attacker spender",
      p =>
        (p.transactions[0].data =
          "0x095ea7b3" + addressWord("0x" + "9".repeat(40)) + word(input.amountIn)),
    ],
    ["ERC20 input with native value", p => (p.transactions.at(-1).value = "0x1")],
  ]) {
    const plan = structuredClone(approval);
    mutate(plan);
    rehash(plan);
    cases.push({ name, plan });
  }
  return cases;
}
module.exports = { validTrade, tamperedTrades, rehash };
