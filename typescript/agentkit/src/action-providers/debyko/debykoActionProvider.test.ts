import { EvmWalletProvider } from "../../wallet-providers";
import { DebykoActionProvider } from "./debykoActionProvider";
import { HistorySchema } from "./schemas";
import { BASE_USDC } from "./payment";

const PAY_TO = "0x17b2c55872338727660aa77776a4056a1a3158ec";
const SIGNER = "0x1111111111111111111111111111111111111111";
const OTHER_ASSET = "0x0000000000000000000000000000000000000002";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("DebykoActionProvider", () => {
  it("signs a 402 within the cap and retries", async () => {
    const signs = { n: 0 };
    const calls: Call[] = [];
    install(call => {
      calls.push(call);
      if (calls.length === 1) {
        return challenge([offer("5000"), offer("9000000"), offer("5000", "eip155:1")]);
      }
      return json(200, { listings: [] });
    });

    const result = await provider().snapshots(wallet(signs), {
      where: "base in (BTC)",
      layers: ["mark"],
    });

    expect(signs.n).toEqual(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toEqual("https://api.debyko.com/v2/snapshots");
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    expect(calls[0].headers.get("authorization")).toBeNull();
    const signature = calls[1].headers.get("payment-signature");
    expect(signature).toBeTruthy();
    const signed = JSON.stringify(JSON.parse(Buffer.from(signature!, "base64").toString("utf8")));
    expect(signed).toMatch(/"value":"5000"/);
    expect(signed.includes("9000000")).toBe(false);
    expect(signed.includes("eip155:1")).toBe(false);
    expect(JSON.parse(result)).toEqual({ listings: [] });
  });

  it("refuses an amount above the cap without signing", async () => {
    const signs = { n: 0 };
    let calls = 0;
    install(() => {
      calls += 1;
      return challenge([offer("60000")]);
    });

    const result = await provider().snapshots(wallet(signs), { where: "base = BTC" });

    expect(signs.n).toEqual(0);
    expect(calls).toEqual(1);
    expect(result).toMatch(/refused before signing/);
  });

  it("refuses a PAYMENT-REQUIRED it cannot read without signing", async () => {
    const signs = { n: 0 };
    install(() => challenge([offer("5000")], "%%%not-a-header%%%"));

    const result = await provider().snapshots(wallet(signs), {});

    expect(signs.n).toEqual(0);
    expect(result).toMatch(/could not be read/);
  });

  it("refuses an offer whose amount cannot be checked without signing", async () => {
    const signs = { n: 0 };
    install(() => challenge([offer("0.06")]));

    const result = await provider().snapshots(wallet(signs), {});

    expect(signs.n).toEqual(0);
    expect(result).toMatch(/refused before signing/);
  });

  it("refuses a wrong network without signing", async () => {
    const signs = { n: 0 };
    install(() => challenge([offer("5000", "eip155:1")]));

    const result = await provider().snapshots(wallet(signs), {});

    expect(signs.n).toEqual(0);
    expect(result).toMatch(/refused before signing/);
  });

  it("refuses a wrong asset without signing", async () => {
    const signs = { n: 0 };
    install(() => challenge([offer("5000", "eip155:8453", OTHER_ASSET)]));

    const result = await provider().snapshots(wallet(signs), {});

    expect(signs.n).toEqual(0);
    expect(result).toMatch(/refused before signing/);
  });

  it("returns a DEBYKO error with code, message and hint", async () => {
    const signs = { n: 0 };
    const body = {
      errors: [
        {
          code: "DQL_UNKNOWN_FIELD",
          message: "No field named nope.",
          hint: "The field table lists the names.",
        },
      ],
    };
    install(() => json(400, body));

    const result = await provider().screen(wallet(signs), { query: "nope > 1" });

    expect(signs.n).toEqual(0);
    expect(JSON.parse(result)).toEqual(body);
  });

  it("sends a Bearer key and no payment header", async () => {
    const signs = { n: 0 };
    const calls: Call[] = [];
    install(call => {
      calls.push(call);
      return json(200, { instruments: [] });
    });

    const result = await provider("test-key").screen(wallet(signs), {
      query: "any(venues where funding > 0)",
      limit: 2,
    });

    expect(signs.n).toEqual(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toEqual("https://api.debyko.com/v2/screen");
    expect(calls[0].headers.get("authorization")).toEqual("Bearer test-key");
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    expect(JSON.parse(result)).toEqual({ instruments: [] });
  });

  it("returns a failed Bearer response and does not fall back to x402", async () => {
    const signs = { n: 0 };
    const calls: Call[] = [];
    const body = {
      errors: [
        {
          code: "UNAUTHENTICATED",
          message: "The key was not accepted.",
          hint: "Issue a new key and send it as Bearer.",
        },
      ],
    };
    install(call => {
      calls.push(call);
      return json(401, body);
    });

    const result = await provider("test-key").history(wallet(signs), {
      where: "base in (BTC)",
      layers: ["funding"],
      interval: "1h",
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-01T02:00:00Z",
    });

    expect(signs.n).toEqual(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toEqual("https://api.debyko.com/v2/snapshots/history");
    expect(calls[0].headers.get("authorization")).toEqual("Bearer test-key");
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    expect(JSON.parse(result)).toEqual(body);
  });

  it("returns the JSON when the 200 carries no settlement header", async () => {
    install(() => json(200, { listings: [{ venue: "X" }] }));
    const result = await provider().snapshots(wallet({ n: 0 }), { where: "base = BTC" });
    expect(JSON.parse(result)).toEqual({ listings: [{ venue: "X" }] });
  });

  it("parses a settlement header when one is present", async () => {
    const signs = { n: 0 };
    install(() => {
      const response = json(200, { listings: [] });
      response.headers.set(
        "payment-response",
        Buffer.from(JSON.stringify({ success: true, transaction: "0xabc" })).toString("base64"),
      );
      return response;
    });
    const withHeader = JSON.parse(await provider().snapshots(wallet(signs), {}));
    expect(withHeader.paymentResponse.transaction).toEqual("0xabc");
    expect(signs.n).toEqual(0);
  });

  it("requires exactly one history mode", () => {
    expect(() => HistorySchema.parse({ interval: "1h" })).toThrow();
    expect(() =>
      HistorySchema.parse({ at: ["2026-10-01T00:00:00Z"], from: "2026-10-01T00:00:00Z" }),
    ).toThrow();
    expect(() =>
      HistorySchema.parse({
        interval: "1h",
        from: "2026-10-01T00:00:00Z",
        to: "2026-10-01T02:00:00Z",
      }),
    ).not.toThrow();
  });

  it("supports Base when paying and any network when a key is set", () => {
    const base = { protocolFamily: "evm", networkId: "base-mainnet" };
    const solana = { protocolFamily: "svm", networkId: "solana-mainnet" };
    expect(provider().supportsNetwork(base as never)).toBe(true);
    expect(provider().supportsNetwork(solana as never)).toBe(false);
    expect(provider("test-key").supportsNetwork(solana as never)).toBe(true);
  });
});

interface Call {
  url: string;
  headers: Headers;
}

/**
 * Builds a provider, with a Bearer key when one is given.
 *
 * @param apiKey - Optional DEBYKO API key.
 * @returns The provider.
 */
function provider(apiKey?: string): DebykoActionProvider {
  return new DebykoActionProvider(apiKey ? { apiKey } : {});
}

/**
 * A wallet whose typed-data signature is counted and never talks to a chain.
 *
 * @param signs - Counter incremented on each signTypedData call.
 * @param signs.n - How many signatures have been made.
 * @returns A wallet stub.
 */
function wallet(signs: { n: number }): EvmWalletProvider {
  return {
    getName: () => "mock",
    getAddress: () => SIGNER,
    getNetwork: () => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
    toSigner: () => ({
      address: SIGNER,
      signTypedData: async () => {
        signs.n += 1;
        return `0x${"11".repeat(65)}`;
      },
    }),
    readContract: () => {
      throw new Error("readContract was called");
    },
  } as unknown as EvmWalletProvider;
}

/**
 * One exact payment offer.
 *
 * @param amount - Atomic amount.
 * @param network - CAIP-2 network. Defaults to Base.
 * @param asset - Token address. Defaults to native USDC.
 * @returns The offer object.
 */
function offer(amount: string, network = "eip155:8453", asset = BASE_USDC) {
  return {
    scheme: "exact",
    network,
    amount,
    asset,
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: { name: "USD Coin", version: "2" },
  };
}

/**
 * A 402 whose PAYMENT-REQUIRED header carries the given offers.
 *
 * @param accepts - Payment offers.
 * @param header - Header override, used when the test wants an unreadable value.
 * @returns The 402 response.
 */
function challenge(accepts: unknown[], header?: string): Response {
  const document = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: "https://api.debyko.com/v2/snapshots",
      description: "DEBYKO /v2/snapshots",
      mimeType: "application/json",
    },
    accepts,
  };
  return new Response(JSON.stringify(document), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "payment-required":
        header ?? Buffer.from(JSON.stringify(document), "utf8").toString("base64"),
    },
  });
}

/**
 * A JSON response.
 *
 * @param status - HTTP status.
 * @param body - JSON body.
 * @returns The response.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Stubs fetch. Calls to the AgentKit analytics host are answered and not recorded.
 *
 * @param handle - Responds to a DEBYKO call.
 */
function install(handle: (call: Call) => Response): void {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.includes("cca-lite.coinbase.com")) {
      return new Response("{}", { status: 200 });
    }
    return handle({ url: request.url, headers: request.headers });
  }) as typeof fetch;
}
