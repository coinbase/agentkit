import { validTrade } from "./trade-fixture.cjs";
// SPDX-License-Identifier: Apache-2.0
import { QHooksActionProvider } from "./qhooksActionProvider";
import { QHooksError } from "./client";
const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const request = {
  chain: "4663",
  token: address(1),
  trader: address(2),
  side: "buy",
  amountIn: "9007199254740993001",
};
/**
 * Create a controlled transport fixture with no wallet capability.
 *
 * @param options - Optional public referral attribution.
 * @param options.referrer - Nonzero public referral address when configured.
 * @returns Native provider and captured transport calls.
 */
function fixture(options: { referrer?: string } = { referrer: address(4) }) {
  const calls: {
    url: string;
    body: {
      id: number;
      params: { name: string; arguments: Record<string, unknown> };
    };
  }[] = [];
  const result = validTrade({ ...request, referrer: options.referrer });
  const fetchImpl = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    calls.push({ url: String(url), body });
    if (body.params.name === "prepare_trade")
      Object.assign(result, validTrade(body.params.arguments));
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result) }],
      },
    });
  }) as jest.MockedFunction<typeof fetch>;
  const provider = new QHooksActionProvider({
    ...options,
    fetchImpl,
  });
  return {
    calls,
    result,
    fetchImpl,
    provider,
    action: provider.getActions().find(a => a.name === "qhooks_prepare_trade")!,
  };
}
describe("QHooksActionProvider", () => {
  it("registers 31 fixed read/prepare tools without reading a wallet", () => {
    const f = fixture();
    const wallet = new Proxy(
      {},
      {
        get() {
          throw Error("wallet must not be read");
        },
      },
    );
    const actions = f.provider.getActions(wallet as never);
    expect(actions).toHaveLength(31);
    expect(
      actions.some(a =>
        /agreement_jar|prepare_tpsl|prepare_limit_order|orders_status|competition_standings/.test(
          a.name,
        ),
      ),
    ).toBe(false);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it("defaults both preparations to only getAddress, preserving explicit > option > wallet precedence", async () => {
    for (const [name, args] of [
      ["prepare_trade", request],
      ["prepare_launch", { name: "Moon Cat", ticker: "MCAT" }],
    ] as const) {
      for (const [option, explicit, expected, reads] of [
        [undefined, undefined, address(7), 1],
        [address(4), undefined, address(4), 0],
        [address(4), address(5), address(5), 0],
        [undefined, address(5), address(5), 0],
      ] as const) {
        const f = fixture({ referrer: option });
        const provider = f.provider;
        const getAddress = jest.fn(() => address(7));
        const wallet = new Proxy(
          {},
          {
            get(_target, key) {
              if (key === "getAddress") return getAddress;
              throw Error("Only the public address may be read");
            },
          },
        );
        const action = provider.getActions(wallet as never).find(a => a.name === "qhooks_" + name)!;
        expect(getAddress).not.toHaveBeenCalled();
        await action.invoke({
          ...args,
          ...(explicit ? { referrer: explicit } : {}),
        });
        expect(f.calls[0].body.params.arguments.referrer).toBe(expected);
        expect(getAddress).toHaveBeenCalledTimes(reads);
      }
    }
  });
  it("preserves exact plan values and fills only an absent referrer", async () => {
    const f = fixture();
    expect(JSON.parse(await f.action.invoke(request))).toEqual(f.result);
    expect(f.calls[0].body.params.arguments.referrer).toBe(address(4));
    await f.action.invoke({ ...request, referrer: address(5) });
    expect(f.calls[1].body.params.arguments.referrer).toBe(address(5));
    expect(f.calls.every(c => c.url === "https://qhooks.com/mcp")).toBe(true);
  });
  it("refuses invalid arguments/referral before transport", async () => {
    const f = fixture();
    await expect(f.action.invoke({ ...request, amountIn: 1 })).rejects.toBeInstanceOf(QHooksError);
    await expect(f.action.invoke({ ...request, referrer: address(0) })).rejects.toBeInstanceOf(
      QHooksError,
    );
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it("retains 429 as unavailable without retry/fallback", async () => {
    const f = fixture();
    f.fetchImpl.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
    );
    await expect(f.action.invoke(request)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 7,
    });
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
