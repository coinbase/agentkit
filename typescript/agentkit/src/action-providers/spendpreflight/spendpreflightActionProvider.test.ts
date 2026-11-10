import { WalletProvider } from "../../wallet-providers";
import { SpendPreflightActionProvider } from "./spendpreflightActionProvider";
import { createPreflightReviewer } from "./preflight";
import { offlineExample } from "./offlineExample";

jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));
const input = { challenge: { x402Version: 2 }, resource_url: "https://merchant.example/data" };
const wallet = new Proxy(
  {},
  {
    get: () => {
      throw new Error("wallet access forbidden");
    },
  },
) as WalletProvider;

describe("SpendPreflight preflight-only provider", () => {
  beforeEach(() => {
    jest.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("external fetch forbidden");
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("registers one disclosed action and never accesses a wallet", async () => {
    const actions = new SpendPreflightActionProvider().getActions(wallet);
    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe("SpendPreflightActionProvider_preflight_payment");
    expect(actions[0].description).toContain("our paid API");
    expect(actions[0].description).toContain("$0.02");
    expect(JSON.parse(await actions[0].invoke(input)).decision).toBe("hold");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("runs the offline example with no request or signer", async () => {
    expect(await offlineExample()).toEqual({
      decision: "hold",
      reasons: ["offline: screening client not configured"],
      payment: "not_attempted",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each(["allow", "hold", "block"])("preserves a valid %s and receipt", async decision => {
    const receipt = { id: "test", signature: "synthetic-not-verified" };
    const transport = jest
      .fn()
      .mockResolvedValue(Response.json({ decision, reasons: ["fixture"], receipt }));
    expect(await createPreflightReviewer({ screeningFetch: transport })(input)).toEqual({
      decision,
      reasons: ["fixture"],
      receipt,
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("uses a fixed API destination and snapshots operator rules", async () => {
    const transport = jest.fn().mockResolvedValue(Response.json({ decision: "hold", reasons: [] }));
    const rules = { max_per_payment_usd: 1 };
    const review = createPreflightReviewer({ screeningFetch: transport, rules });
    rules.max_per_payment_usd = 100;
    await review({ ...input, rules: { max_per_payment_usd: 999 } } as typeof input);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.spendpreflight.com/v1/preflight");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body).rules).toEqual({ max_per_payment_usd: 1 });
  });

  it.each([402, 500])("holds on HTTP %s without retry", async status => {
    const transport = jest.fn().mockResolvedValue(new Response(null, { status }));
    expect((await createPreflightReviewer({ screeningFetch: transport })(input)).decision).toBe(
      "hold",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([
    { decision: "allow", reasons: [] },
    { decision: "allow", reasons: "bad" },
    { decision: "safe", reasons: [] },
  ])("holds on incomplete/malformed result %j", async response => {
    const transport = jest.fn().mockResolvedValue(Response.json(response));
    expect((await createPreflightReviewer({ screeningFetch: transport })(input)).decision).toBe(
      "hold",
    );
  });

  it("holds on a rejected transport without retry", async () => {
    const transport = jest.fn().mockRejectedValue(new Error("timeout"));
    expect((await createPreflightReviewer({ screeningFetch: transport })(input)).decision).toBe(
      "hold",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects excessive input before the transport and bounds the response", async () => {
    const transport = jest.fn().mockResolvedValue(new Response("x".repeat(131073)));
    const review = createPreflightReviewer({ screeningFetch: transport });
    expect((await review({ ...input, challenge: { data: "x".repeat(65537) } })).decision).toBe(
      "hold",
    );
    expect(transport).not.toHaveBeenCalled();
    expect((await review(input)).decision).toBe("hold");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("holds on an invalid resource before requesting", async () => {
    const transport = jest.fn();
    expect(
      (
        await createPreflightReviewer({ screeningFetch: transport })({
          ...input,
          resource_url: "http://merchant.example",
        })
      ).decision,
    ).toBe("hold");
    expect(transport).not.toHaveBeenCalled();
  });
});
