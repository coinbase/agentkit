import { QHooksClient } from "./client";
import { validTrade, tamperedTrades } from "./trade-fixture.cjs";
const request = {
  chain: "4663",
  token: "0x" + "1".repeat(40),
  trader: "0x" + "2".repeat(40),
  side: "buy",
  amountIn: "9007199254740993001",
};
for (const transport of ["mcp", "rest"] as const) {
  it(`validates valid native and ERC20 trade plans over ${transport}`, async () => {
    for (const side of ["buy", "sell"])
      for (const chain of ["4663", "8453", "99901"]) {
        const input = { ...request, chain, side },
          data = validTrade(input);
        const client = new QHooksClient({
          transport,
          fetchImpl: async (_url, init) => {
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            return Response.json(
              transport === "mcp"
                ? {
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                      structuredContent: data,
                      content: [{ type: "text", text: JSON.stringify(data) }],
                    },
                  }
                : data,
            );
          },
        });
        expect(await client.call("prepare_trade", input)).toEqual(data);
      }
  });
  it(`rejects altered trade plans before returning wallet calls over ${transport}`, async () => {
    for (const { plan } of tamperedTrades(request)) {
      let calls = 0;
      const client = new QHooksClient({
        transport,
        fetchImpl: async (_url, init) => {
          calls++;
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          return Response.json(
            transport === "mcp"
              ? {
                  jsonrpc: "2.0",
                  id: body.id,
                  result: {
                    structuredContent: plan,
                    content: [{ type: "text", text: JSON.stringify(plan) }],
                  },
                }
              : plan,
          );
        },
      });
      await expect(client.call("prepare_trade", request)).rejects.toMatchObject({
        code: "unsafe_trade_plan",
      });
      expect(calls).toBe(1);
    }
  });
}
