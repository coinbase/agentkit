import { QHooksClient } from "./client";
import { validTrade, tamperedTrades, fixtureFetch } from "./trade-fixture.cjs";
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
