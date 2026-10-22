import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  DevxTokenCheckActionProvider,
  devxTokenCheckActionProvider,
  tokenCheckPaymentPolicy,
  usdcToAtomic,
} from "./devxTokenCheckActionProvider";
import { BASE_USDC_ADDRESS, DEVX_TOKEN_CHECK_PAY_TO } from "./constants";

const DEGEN = "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
const TOKEN = "0x1111111111111111111111111111111111111111";

const REQUIREMENT = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "10000",
  asset: BASE_USDC_ADDRESS,
  payTo: DEVX_TOKEN_CHECK_PAY_TO,
  maxTimeoutSeconds: 120,
  extra: { name: "USD Coin", version: "2" },
};

const DANGER_RESULT = {
  operation_id: "op-1",
  status: "paid",
  result: {
    verdict: "danger",
    risk_score: 90,
    confidence: 0.9,
    token: { symbol: "HONEY" },
    reasons: [{ severity: "critical", code: "sell_reverts", message: "Simulated sell reverts" }],
    honeypot: { buy_tax_pct: 0, sell_tax_pct: null, sell_ok: false },
  },
};

const DEMO_RESULT = {
  result: {
    verdict: "caution",
    risk_score: 12,
    confidence: 0.95,
    token: { symbol: "DEGEN" },
    reasons: [{ severity: "medium", code: "pausable", message: "Transfers can be paused" }],
  },
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
const unb64 = (value: string) => JSON.parse(Buffer.from(value, "base64").toString("utf8"));

/**
 * Installs a fake Token Check server on global fetch.
 *
 * @param requirement - The payment requirement the server asks for.
 * @returns The jest mock.
 */
function mockServer(requirement: Record<string, unknown> = REQUIREMENT) {
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url.includes("/v1/token/demo")) {
      return new Response(JSON.stringify(DEMO_RESULT), { status: 200 });
    }
    if (request.headers.get("PAYMENT-SIGNATURE")) {
      return new Response(JSON.stringify(DANGER_RESULT), {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": b64({ success: true, transaction: "0xabc", network: "eip155:8453" }),
        },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": b64({
          x402Version: 2,
          resource: { url: request.url },
          accepts: [requirement],
        }),
      },
    });
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

/**
 * Creates a mock EVM wallet provider backed by a random, unfunded key.
 *
 * @param networkId - The wallet network id.
 * @returns The mock wallet provider and its address.
 */
function mockWallet(networkId = "base-mainnet") {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = {
    toSigner: jest.fn(() => account),
    getNetwork: jest.fn(() => ({ protocolFamily: "evm", networkId, chainId: "8453" })),
    getAddress: jest.fn(() => account.address),
  } as unknown as EvmWalletProvider;
  return { wallet, address: account.address };
}

describe("DevxTokenCheckActionProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("supports EVM networks only", () => {
    const provider = devxTokenCheckActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
      false,
    );
  });

  it("converts USDC amounts", () => {
    expect(usdcToAtomic("0.01")).toBe(10_000n);
    expect(usdcToAtomic("1")).toBe(1_000_000n);
    expect(() => usdcToAtomic("0.0000001")).toThrow();
  });

  it("policy keeps only Base USDC to the DevX payee within the cap", () => {
    const policy = tokenCheckPaymentPolicy(10_000n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqs = (r: any) => policy(2, [r]).length;
    expect(reqs(REQUIREMENT)).toBe(1);
    expect(reqs({ ...REQUIREMENT, amount: "10001" })).toBe(0);
    expect(reqs({ ...REQUIREMENT, payTo: TOKEN })).toBe(0);
    expect(reqs({ ...REQUIREMENT, network: "eip155:1" })).toBe(0);
    expect(reqs({ ...REQUIREMENT, asset: TOKEN })).toBe(0);
  });

  it("pays via x402 and returns the verdict", async () => {
    const server = mockServer();
    const { wallet, address } = mockWallet();
    const out = JSON.parse(
      await new DevxTokenCheckActionProvider().checkTokenRisk(wallet, {
        tokenAddress: TOKEN,
        chain: null,
      }),
    );
    expect(out).toMatchObject({
      ok: true,
      source: "paid",
      verdict: "danger",
      chain: "base",
      paymentTransaction: "0xabc",
    });
    expect(server).toHaveBeenCalledTimes(2);
    const paid = new Request(server.mock.calls[1][0], server.mock.calls[1][1]);
    const signature = unb64(paid.headers.get("PAYMENT-SIGNATURE") as string);
    expect(signature.x402Version).toBe(2);
    expect(signature.payload.authorization.from.toLowerCase()).toBe(address.toLowerCase());
    expect(signature.payload.authorization.to.toLowerCase()).toBe(
      DEVX_TOKEN_CHECK_PAY_TO.toLowerCase(),
    );
    expect(signature.payload.authorization.value).toBe("10000");
  });

  it("refuses to pay a different payee or a higher price", async () => {
    for (const requirement of [
      { ...REQUIREMENT, payTo: TOKEN },
      { ...REQUIREMENT, amount: "20000" },
    ]) {
      const server = mockServer(requirement);
      const { wallet } = mockWallet();
      const result = await new DevxTokenCheckActionProvider().check(wallet, TOKEN, "base");
      expect(result).toMatchObject({ ok: false, error: "payment_refused" });
      expect(server).toHaveBeenCalledTimes(1);
    }
  });

  it("uses the free demo endpoint for demo tokens", async () => {
    const server = mockServer();
    const { wallet } = mockWallet();
    const result = await new DevxTokenCheckActionProvider().check(wallet, DEGEN, null);
    expect(result).toMatchObject({ ok: true, source: "demo", verdict: "caution", symbol: "DEGEN" });
    expect(server).toHaveBeenCalledTimes(1);
    expect(new Request(server.mock.calls[0][0]).url).toContain("/v1/token/demo");
  });

  it("never pays when demoOnly is set", async () => {
    const server = mockServer();
    const { wallet } = mockWallet();
    const result = await new DevxTokenCheckActionProvider({ demoOnly: true }).check(
      wallet,
      TOKEN,
      "base",
    );
    expect(result.error).toBe("payment_not_configured");
    expect(server).not.toHaveBeenCalled();
  });

  it("defaults the chain to the wallet network and validates addresses", async () => {
    const server = mockServer();
    const { wallet } = mockWallet("arbitrum-mainnet");
    await new DevxTokenCheckActionProvider().check(wallet, TOKEN, null);
    expect(new Request(server.mock.calls[0][0]).url).toContain("chain=arbitrum");
    const bad = await new DevxTokenCheckActionProvider().check(wallet, "0x1234", "base");
    expect(bad.error).toBe("invalid_input");
  });

  it("pre_swap_token_check blocks danger and allows caution by default", async () => {
    mockServer();
    const { wallet } = mockWallet();
    const provider = new DevxTokenCheckActionProvider();
    const blocked = JSON.parse(
      await provider.preSwapTokenCheck(wallet, { tokenAddress: TOKEN, chain: "base" }),
    );
    expect(blocked).toMatchObject({ proceed: false, verdict: "danger" });
    const allowed = JSON.parse(
      await provider.preSwapTokenCheck(wallet, { tokenAddress: DEGEN, chain: "base" }),
    );
    expect(allowed).toMatchObject({ proceed: true, verdict: "caution" });
    const strict = new DevxTokenCheckActionProvider({ blockOn: ["danger", "caution"] });
    expect(
      JSON.parse(await strict.preSwapTokenCheck(wallet, { tokenAddress: DEGEN, chain: "base" }))
        .proceed,
    ).toBe(false);
  });

  it("fails open by default and closed when configured", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const { wallet } = mockWallet();
    const open = JSON.parse(
      await new DevxTokenCheckActionProvider().preSwapTokenCheck(wallet, {
        tokenAddress: TOKEN,
        chain: "base",
      }),
    );
    expect(open.proceed).toBe(true);
    const closed = JSON.parse(
      await new DevxTokenCheckActionProvider({ failClosed: true }).preSwapTokenCheck(wallet, {
        tokenAddress: TOKEN,
        chain: "base",
      }),
    );
    expect(closed.proceed).toBe(false);
  });

  it("reports HTTP errors", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ error: "not_a_token" }), { status: 422 }),
    ) as unknown as typeof fetch;
    const { wallet } = mockWallet();
    const result = await new DevxTokenCheckActionProvider().check(wallet, TOKEN, "ethereum");
    expect(result).toMatchObject({ ok: false, error: "http_error", message: "not_a_token" });
  });
});
