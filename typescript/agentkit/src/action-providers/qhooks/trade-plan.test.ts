import { QHooksClient } from "./client";
import { validTrade, tamperedTrades, fixtureFetch, rehash } from "./trade-fixture.cjs";
const request = {
  chain: "4663",
  token: "0x" + "1".repeat(40),
  trader: "0x" + "2".repeat(40),
  side: "buy",
  amountIn: "9007199254740993001",
};
for (const transport of ["mcp", "rest"] as const) {
  it(`validates native/ERC20 plans against independent reads over ${transport}`, async () => {
    for (const side of ["buy", "sell"])
      for (const chain of ["4663", "8453", "99901"]) {
        const input = { ...request, chain, side },
          plan = validTrade(input);
        let calls = 0;
        const client = new QHooksClient({
          transport,
          fetchImpl: fixtureFetch(plan, input, transport, () => calls++),
        });
        expect(await client.call("prepare_trade", input)).toEqual(plan);
        expect(calls).toBe(3);
      }
  });
  it(`rejects rehashed tampered plans before wallet calls over ${transport}`, async () => {
    for (const { plan } of tamperedTrades(request)) {
      let calls = 0;
      const client = new QHooksClient({
        transport,
        fetchImpl: fixtureFetch(plan, request, transport, () => calls++),
      });
      await expect(client.call("prepare_trade", request)).rejects.toMatchObject({
        code: "unsafe_trade_plan",
      });
      expect(calls).toBe(3);
    }
  });
}

// Router migration: retain v1 while accepting only the pinned v2 on Robinhood.
for (const transport of ["mcp", "rest"] as const) {
  it(`accepts pinned RH v2 and refuses it on Base over ${transport}`, async () => {
    const v1 = "0x79d211f5137d22b0fe3bfda81fbb8b7f53248bff";
    const v2 = "0x352a4a1d927ed21bddf5e22b1eed728714438bcd";
    for (const chain of ["4663", "8453"]) {
      for (const side of ["buy", "sell"]) {
        const input = { ...request, chain, side };
        const plan = JSON.parse(
          JSON.stringify(validTrade(input)).replaceAll(v1.slice(2), v2.slice(2)),
        );
        rehash(plan);
        const client = new QHooksClient({
          transport,
          fetchImpl: fixtureFetch(plan, input, transport, () => {}),
        });
        if (chain === "4663") expect(await client.call("prepare_trade", input)).toEqual(plan);
        else
          await expect(client.call("prepare_trade", input)).rejects.toMatchObject({
            code: "unsafe_trade_plan",
          });
      }
    }
  });
}
