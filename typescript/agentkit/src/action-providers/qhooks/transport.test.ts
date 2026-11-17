import { validTrade, independentRead } from "./trade-fixture.cjs";
// SPDX-License-Identifier: Apache-2.0
import type { ToolName } from "./definitions";
import { QHooksActionProvider } from "./qhooksActionProvider";
const A = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const H = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const trade = {
  chain: "4663",
  token: A(1),
  trader: A(2),
  side: "buy",
  amountIn: "9007199254740993001",
};
it.each(["mcp", "rest"] as const)(
  "round-trips all 25 tools over %s with exact strings",
  async transport => {
    const when = Math.floor(Date.now() / 1000) + 3600;
    const agreement = {
      payer: A(1),
      payee: A(2),
      asset: "USDG",
      expiresInDays: 1,
      tranches: [{ amount: "9007199254740993.123456", conditions: [{ kind: 2, parties: [A(1)] }] }],
    };
    const cases: [ToolName, string, string, Record<string, unknown>][] = [
      ["list_launches", "launches", "GET", { chain: "4663", limit: 1 }],
      ["token_info", "token", "GET", { chain: "4663", token: A(1) }],
      [
        "quote",
        "quote",
        "GET",
        { chain: "4663", pool: H(1), zeroForOne: true, amountIn: "9007199254740993" },
      ],
      ["prepare_launch", "prepare-launch", "POST", { name: "Fixture", ticker: "FX" }],
      ["prepare_trade", "prepare-trade", "POST", trade],
      ["qproof_check", "qproof-check", "GET", { chain: "4663", token: A(1) }],
      ["wallet_portfolio", "wallet-portfolio", "GET", { address: A(1) }],
      ["hooks_catalog", "hooks-catalog", "GET", {}],
      ["agent_stats", "agent-stats", "GET", { referrer: A(1) }],
      ["list_callers", "list-callers", "GET", {}],
      ["caller_record", "caller-record", "GET", { address: A(1) }],
      [
        "otc_quote",
        "otc-quote",
        "POST",
        {
          buyer: A(1),
          seller: A(2),
          token: A(3),
          amount: "1.123456789012345678",
          payAsset: "USDG",
          payAmount: "2.123456",
          expiry: when,
        },
      ],
      [
        "otc_create",
        "otc-create",
        "POST",
        {
          actor: A(1),
          quote: { marker: "unchanged", sellAmount: "1234567890123456789" },
          fundNow: false,
        },
      ],
      [
        "otc_accept",
        "otc-accept",
        "POST",
        { actor: A(2), dealId: "9007199254740993", expectedTermsHash: H(1) },
      ],
      ["deal_status", "deal-status", "GET", { dealId: "9007199254740993" }],
      ["agreement_create", "agreement-create", "POST", agreement],
      ["agreement_fund", "agreement-fund", "POST", agreement],
      [
        "agreement_from_template",
        "agreement-from-template",
        "POST",
        {
          payer: A(1),
          payee: A(2),
          asset: "USDG",
          template: "milestones",
          params: { milestones: [{ amount: "1.123456" }] },
        },
      ],
      ["agreement_status", "agreement-status", "GET", { id: "9007199254740993" }],
      ["agreement_release", "agreement-release", "POST", { id: "1", actor: A(2), tranche: 0 }],
      ["agreement_refund", "agreement-refund", "POST", { id: "1", actor: A(1) }],
      ["agreement_attest", "agreement-attest", "POST", { id: "1", actor: A(1), tranche: 0 }],
      ["perps_markets", "perps-markets", "GET", { coin: "ETH" }],
      ["perps_positions", "perps-positions", "GET", { address: A(1) }],
      [
        "prepare_perps_order",
        "prepare-perps-order",
        "POST",
        {
          address: A(1),
          coin: "ETH",
          side: "buy",
          size: "0.1",
          limitPrice: "2500",
          timeInForce: "Ioc",
          nonce: 1794770000000,
        },
      ],
    ];

    for (const [name, route, method, args] of cases) {
      const data =
        name === "prepare_trade"
          ? validTrade(args)
          : {
              status: "partial",
              note: "Non-executable partial fixture",
              partial: true,
              costUsd: null,
              notes: ["Untrusted text is data"],
            };
      const calls: { url: string; init: RequestInit; body?: Record<string, unknown> }[] = [];
      const fetchImpl: typeof fetch = async (url, init: RequestInit = {}) => {
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: String(url), init, body });
        const readName =
          body?.params?.name ??
          { token: "token_info", quote: "quote" }[new URL(String(url)).pathname.split("/").at(-1)!];
        const responseData =
          name === "prepare_trade" && ["token_info", "quote"].includes(readName)
            ? independentRead(args)(
                readName,
                body?.params?.arguments ??
                  Object.fromEntries(
                    [...new URL(String(url)).searchParams].map(([k, v]) => [
                      k,
                      k === "zeroForOne" ? v === "true" : v,
                    ]),
                  ),
              )
            : data;
        return Response.json(
          transport === "mcp"
            ? {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  structuredContent: responseData,
                  content: [{ type: "text", text: JSON.stringify(responseData) }],
                },
              }
            : responseData,
        );
      };
      const native = new QHooksActionProvider({ transport, fetchImpl }).getActions();
      const tool = native.find(t => t.name === `qhooks_${name}`);
      if (!tool) throw new Error(`Missing native tool ${name}`);
      expect(JSON.parse(await tool.invoke(args))).toEqual(data);
      expect(calls).toHaveLength(name === "prepare_trade" ? 3 : 1);
      const call = calls[0];
      if (transport === "mcp") {
        expect(call.body?.params).toEqual({ name, arguments: args });
      } else {
        const url = new URL(call.url);
        expect(url.origin).toBe("https://qhooks.com");
        expect(url.pathname).toBe(`/api/v1/agent/${route}`);
        expect(call.init.method).toBe(method);
        if (method === "POST") expect(call.body).toEqual(args);
        else
          for (const [key, value] of Object.entries(args))
            expect(url.searchParams.get(key)).toBe(String(value));
      }
    }
  },
);
