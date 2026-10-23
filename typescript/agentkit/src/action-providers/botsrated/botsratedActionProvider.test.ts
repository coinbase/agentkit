import { botsratedActionProvider } from "./botsratedActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { BASE_USDC, BOTSRATED_PAY_TO } from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));

const SELLER_PAY_TO = "0xe9030014F5DAe217d0A152f02A043567b16c1aBf";

// Trimmed from a real GET https://botsrated.com/v1/preflight response (2026-10-23).
const PREFLIGHT = {
  found: true,
  host: "blockrun.ai",
  latest_probe: {
    ts: "2026-10-23T13:06:35Z",
    url: "https://blockrun.ai/api/v1/chat/completions",
    status: 402,
    latency_ms: 1417,
    valid_402: true,
    live_amount: "2000",
    live_payTo: SELLER_PAY_TO,
    live_network: "eip155:8453",
    receipt_url:
      "https://botsrated.com/receipt/05889891d26734d55948?host=blockrun.ai&day=2026-10-23",
  },
  freshness: { last_probe_at: "2026-10-23T13:06:35Z", stale: false },
  listing: { price_usd: 0.002, payTo: SELLER_PAY_TO, network: "eip155:8453" },
  recent_window: { probes: 4, valid_402: 4, valid_402_rate: 1 },
  paid_tests_count: 1,
};

const CHECK_TERMS = {
  x402Version: 2,
  resource: { url: "https://botsrated.com/v1/check?host=blockrun.ai" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000",
      asset: BASE_USDC,
      payTo: BOTSRATED_PAY_TO,
      maxTimeoutSeconds: 300,
    },
  ],
};

// Otherwise acceptable Base USDC terms asking for Permit2 plus an ERC-20 approval of Permit2.
const PERMIT2_TERMS = {
  ...CHECK_TERMS,
  accepts: [
    {
      ...CHECK_TERMS.accepts[0],
      extra: { name: "USD Coin", version: "2", assetTransferMethod: "permit2" },
    },
  ],
  extensions: { erc20ApprovalGasSponsoring: { info: {}, schema: {} } },
};

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const quote402 = (terms = CHECK_TERMS) =>
  jsonResponse({}, 402, { "payment-required": btoa(JSON.stringify(terms)) });

describe("BotsRatedActionProvider", () => {
  const fetchMock = jest.fn();
  const paidFetch = jest.fn();
  let hook: ((ctx: unknown) => Promise<unknown>) | undefined;
  let afterHook: (() => Promise<void>) | undefined;
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
    hook = undefined;
    afterHook = undefined;
    (x402Client as unknown as jest.Mock).mockImplementation(() => ({
      onBeforePaymentCreation: (h: (ctx: unknown) => Promise<unknown>) => {
        hook = h;
      },
      onAfterPaymentCreation: (h: () => Promise<void>) => {
        afterHook = h;
      },
    }));
    (wrapFetchWithPayment as jest.Mock).mockReturnValue(paidFetch);
    wallet = Object.create(EvmWalletProvider.prototype);
    wallet.getNetwork = jest
      .fn()
      .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" });
    wallet.toSigner = jest.fn().mockReturnValue({ address: "0x1" });
    wallet.getName = jest.fn().mockReturnValue("test_wallet");
    wallet.getAddress = jest.fn().mockReturnValue("0x1");
  });

  describe("preflight", () => {
    it("reports a payTo that matches what BotsRated observed", async () => {
      fetchMock.mockResolvedValue(jsonResponse(PREFLIGHT));
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, {
          url: "https://blockrun.ai/api/v1/chat/completions",
          payTo: SELLER_PAY_TO.toLowerCase(),
          network: "eip155:8453",
        }),
      );
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://botsrated.com/v1/preflight?url=https%3A%2F%2Fblockrun.ai%2Fapi%2Fv1%2Fchat%2Fcompletions",
      );
      expect(out.payToCheck).toBe("matches_observed");
      expect(out.lastProbe.receiptUrl).toContain("/receipt/");
    });

    it("flags a payTo BotsRated never saw for the host", async () => {
      fetchMock.mockResolvedValue(jsonResponse(PREFLIGHT));
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, {
          url: "blockrun.ai",
          payTo: "0x000000000000000000000000000000000000dEaD",
        }),
      );
      expect(out.payToCheck).toBe("not_seen");
    });

    it("does not treat a listing-only payTo as observed", async () => {
      const listed = "0x1111111111111111111111111111111111111111";
      fetchMock.mockResolvedValue(
        jsonResponse({ ...PREFLIGHT, listing: { ...PREFLIGHT.listing, payTo: listed } }),
      );
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, { url: "blockrun.ai", payTo: listed }),
      );
      expect(out.payToCheck).toBe("listing_only");
    });

    it("does not compare payTo across networks", async () => {
      fetchMock.mockResolvedValue(jsonResponse(PREFLIGHT));
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, {
          url: "blockrun.ai",
          payTo: "0x000000000000000000000000000000000000dEaD",
          network: "eip155:84532",
        }),
      );
      expect(out.payToCheck).toBe("not_compared");
    });

    it("returns covered=false for hosts BotsRated does not cover", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: "host_not_covered", charged: false } }, 404),
      );
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, { url: "x.example" }),
      );
      expect(out).toMatchObject({ covered: false, host: "x.example" });
    });

    it("returns an error object when BotsRated is unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));
      const out = JSON.parse(
        await botsratedActionProvider().preflight(wallet, { url: "x.example" }),
      );
      expect(out).toMatchObject({ error: true, details: "network down" });
    });
  });

  describe("paid_check", () => {
    it("is disabled without a spend limit and makes no request", async () => {
      delete process.env.BOTSRATED_MAX_SPEND_USDC;
      const out = JSON.parse(
        await botsratedActionProvider().paidCheck(wallet, { host: "blockrun.ai" }),
      );
      expect(out.message).toBe("Paid BotsRated checks are disabled");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("requires an EVM wallet on Base mainnet", async () => {
      wallet.getNetwork = jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia" });
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
          host: "blockrun.ai",
        }),
      );
      expect(out.error).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not pay when BotsRated answers the unpaid request with a 404", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: "host_not_covered", message: "not covered" } }, 404),
      );
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
          host: "x.example",
        }),
      );
      expect(out.message).toContain("nothing was paid");
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("rejects a quote to a different payTo", async () => {
      const bad = {
        ...CHECK_TERMS,
        accepts: [{ ...CHECK_TERMS.accepts[0], payTo: SELLER_PAY_TO }],
      };
      fetchMock.mockResolvedValue(quote402(bad));
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
          host: "blockrun.ai",
        }),
      );
      expect(out.message).toContain("quote rejected");
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("pays once, tracks spend and stops at the limit", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockImplementation(async () => jsonResponse({ host: "blockrun.ai", measured: {} }));
      const provider = botsratedActionProvider({ maxSpendUsdc: 0.0015 });

      const first = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(first).toMatchObject({ success: true, paidUsdc: 0.001, remainingUsdc: 0.0005 });
      expect(paidFetch).toHaveBeenCalledWith(
        "https://botsrated.com/v1/check?host=blockrun.ai",
        expect.anything(),
      );

      const second = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(second.message).toBe("BotsRated spend limit reached");
      expect(paidFetch).toHaveBeenCalledTimes(1);
    });

    it("keeps the reservation when a signed payment's request fails", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockImplementationOnce(async () => {
        await afterHook!(); // the payment was signed and may settle
        return jsonResponse({}, 500);
      });
      const provider = botsratedActionProvider({ maxSpendUsdc: 0.001 });
      const first = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(first).toMatchObject({ error: true, mayHaveBeenCharged: true, remainingUsdc: 0 });
      const second = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(second.message).toBe("BotsRated spend limit reached");
      expect(paidFetch).toHaveBeenCalledTimes(1);
    });

    it("keeps the reservation when a signed payment's request throws", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockImplementationOnce(async () => {
        await afterHook!();
        throw new Error("socket hang up");
      });
      const provider = botsratedActionProvider({ maxSpendUsdc: 0.001 });
      const out = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(out).toMatchObject({ error: true, mayHaveBeenCharged: true, remainingUsdc: 0 });
    });

    it("releases the reservation when the request fails before any payment is signed", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockResolvedValueOnce(jsonResponse({}, 500));
      paidFetch.mockResolvedValueOnce(jsonResponse({ host: "blockrun.ai" }));
      const provider = botsratedActionProvider({ maxSpendUsdc: 0.001 });
      const first = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(first).toMatchObject({ error: true, mayHaveBeenCharged: false });
      expect(JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" })).success).toBe(
        true,
      );
    });

    it("rejects a quote that also offers any other payment option", async () => {
      const foreign = { ...CHECK_TERMS.accepts[0], amount: "500000", payTo: SELLER_PAY_TO };
      fetchMock.mockResolvedValue(
        quote402({ ...CHECK_TERMS, accepts: [foreign, CHECK_TERMS.accepts[0]] }),
      );
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 1 }).paidCheck(wallet, {
          host: "blockrun.ai",
        }),
      );
      expect(out.message).toContain("quote rejected");
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("does not follow redirects on the quote or the paid request", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockImplementation(async () => jsonResponse({ host: "blockrun.ai" }));
      await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
        host: "blockrun.ai",
      });
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
      expect(paidFetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    });

    it("uses a free-quota answer without paying or counting it against the limit", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          host: "blockrun.ai",
          charged: false,
          free_quota: { route: "check", used: 1, limit: 100, remaining: 99 },
        }),
      );
      const provider = botsratedActionProvider({ maxSpendUsdc: 0.001 });
      const out = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(out).toMatchObject({
        success: true,
        paidUsdc: 0,
        charged: false,
        remainingUsdc: 0.001,
      });
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("refuses a quote above the published $0.001 price", async () => {
      fetchMock.mockResolvedValue(
        quote402({ ...CHECK_TERMS, accepts: [{ ...CHECK_TERMS.accepts[0], amount: "2000" }] }),
      );
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
          host: "blockrun.ai",
        }),
      );
      expect(out.message).toContain("quote rejected");
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("registers a hook that refuses any payment other than the validated quote", async () => {
      fetchMock.mockImplementation(async () => quote402());
      paidFetch.mockImplementation(async () => jsonResponse({}));
      await botsratedActionProvider({ maxSpendUsdc: 0.01 }).paidCheck(wallet, {
        host: "blockrun.ai",
      });
      expect(hook).toBeDefined();
      const ok = CHECK_TERMS.accepts[0];
      const ctx = (r: unknown, pr: unknown = CHECK_TERMS) => ({
        paymentRequired: structuredClone(pr),
        selectedRequirements: r,
      });
      expect(await hook!(ctx(ok))).toBeUndefined();
      expect(await hook!(ctx({ ...ok, amount: "1001" }))).toMatchObject({ abort: true });
      expect(await hook!(ctx({ ...ok, payTo: SELLER_PAY_TO }))).toMatchObject({ abort: true });
      // A re-served 402 is checked again in full before the scheme signs anything.
      expect(await hook!(ctx(PERMIT2_TERMS.accepts[0], PERMIT2_TERMS))).toMatchObject({
        abort: true,
      });
      expect(
        await hook!(ctx(ok, { ...CHECK_TERMS, extensions: PERMIT2_TERMS.extensions })),
      ).toMatchObject({ abort: true });
      const bazaar = ctx(ok, { ...CHECK_TERMS, extensions: { bazaar: {} } });
      expect(await hook!(bazaar)).toBeUndefined();
      expect(bazaar.paymentRequired).not.toHaveProperty("extensions");
    });
  });

  describe("paid_check quote hardening", () => {
    const ok = { ...CHECK_TERMS.accepts[0], extra: { name: "USD Coin", version: "2" } };
    const cases: Array<[string, unknown]> = [
      ["permit2 extra + approval extension", PERMIT2_TERMS],
      ["permit2 extra alone", { ...PERMIT2_TERMS, extensions: undefined }],
      ["approval extension alone", { ...CHECK_TERMS, extensions: PERMIT2_TERMS.extensions }],
      ["eip2612 extension", { ...CHECK_TERMS, extensions: { eip2612GasSponsoring: {} } }],
      [
        "bazaar plus approval",
        { ...CHECK_TERMS, extensions: { bazaar: {}, erc20ApprovalGasSponsoring: {} } },
      ],
      ["paymentFlow extra", { ...CHECK_TERMS, accepts: [{ ...ok, extra: { paymentFlow: "x" } }] }],
      ["long timeout", { ...CHECK_TERMS, accepts: [{ ...ok, maxTimeoutSeconds: 86400 }] }],
      ["string timeout", { ...CHECK_TERMS, accepts: [{ ...ok, maxTimeoutSeconds: "300" }] }],
      ["x402 v1", { ...CHECK_TERMS, x402Version: 1 }],
    ];
    it.each(cases)("rejects %s before any payment", async (_name, terms) => {
      fetchMock.mockResolvedValue(quote402(terms as typeof CHECK_TERMS));
      const provider = botsratedActionProvider({ maxSpendUsdc: 1 });
      const out = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(out.message).toContain("quote rejected");
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
      expect(paidFetch).not.toHaveBeenCalled();
    });

    it("accepts BotsRated's real 402 shape (EIP-3009 extra, bazaar discovery extension)", async () => {
      fetchMock.mockResolvedValue(
        quote402({ ...CHECK_TERMS, accepts: [ok], extensions: { bazaar: { info: {} } } } as never),
      );
      paidFetch.mockResolvedValue(jsonResponse({ host: "blockrun.ai" }));
      const out = JSON.parse(
        await botsratedActionProvider({ maxSpendUsdc: 1 }).paidCheck(wallet, {
          host: "blockrun.ai",
        }),
      );
      expect(out.success).toBe(true);
    });

    it("a re-served Permit2 402 never reaches a transaction-capable signer (real x402 client)", async () => {
      const actualFetch = jest.requireActual("@x402/fetch");
      const actualEvm = jest.requireActual("@x402/evm/exact/client");
      const { registerExactEvmScheme } = jest.requireMock("@x402/evm/exact/client");
      (x402Client as unknown as jest.Mock).mockImplementation(() => new actualFetch.x402Client());
      (registerExactEvmScheme as jest.Mock).mockImplementation(actualEvm.registerExactEvmScheme);
      (wrapFetchWithPayment as jest.Mock).mockImplementation(actualFetch.wrapFetchWithPayment);
      const signer = {
        address: "0x0000000000000000000000000000000000000001",
        signTypedData: jest.fn(),
        signTransaction: jest.fn(),
        getTransactionCount: jest.fn(),
      };
      wallet.toSigner = jest.fn().mockReturnValue(signer);
      wallet.readContract = jest.fn();
      // First (validated) quote is clean; the client's own fetch then gets the Permit2 quote.
      fetchMock
        .mockResolvedValueOnce(quote402())
        .mockImplementation(async () => quote402(PERMIT2_TERMS));
      const provider = botsratedActionProvider({ maxSpendUsdc: 1 });
      const out = JSON.parse(await provider.paidCheck(wallet, { host: "blockrun.ai" }));
      expect(out).toMatchObject({ error: true, mayHaveBeenCharged: false, remainingUsdc: 1 });
      expect(signer.signTypedData).not.toHaveBeenCalled();
      expect(signer.signTransaction).not.toHaveBeenCalled();
      expect(signer.getTransactionCount).not.toHaveBeenCalled();
      expect(wallet.readContract).not.toHaveBeenCalled();
    });
  });

  it("supports every network (preflight is network-independent)", () => {
    expect(botsratedActionProvider().supportsNetwork({ protocolFamily: "svm" })).toBe(true);
  });
});
