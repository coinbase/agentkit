import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { kestrovaActionProvider, matchesPinnedTerms } from "./kestrovaActionProvider";
import { KESTROVA_PAYMENT_TERMS } from "./constants";

const BASE = KESTROVA_PAYMENT_TERMS["base-mainnet"];
const SOLANA = KESTROVA_PAYMENT_TERMS["solana-mainnet"];

/**
 * A 402 response carrying x402 v2 payment terms in the PAYMENT-REQUIRED header.
 *
 * @param accepts - The payment requirements
 * @param url - The resource URL
 * @returns A Response
 */
function paymentRequired(accepts: Record<string, unknown>[], url: string): Response {
  const body = {
    x402Version: 2,
    accepts,
    resource: { url, description: "scan", mimeType: "application/json" },
  };
  return new Response("{}", {
    status: 402,
    headers: {
      "content-type": "application/json",
      "payment-required": Buffer.from(JSON.stringify(body)).toString("base64"),
    },
  });
}

/**
 * Base mainnet exact terms as Kestrova publishes them, with optional overrides.
 *
 * @param overrides - Fields to change
 * @returns A payment requirement
 */
function baseTerms(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scheme: "exact",
    network: BASE.network,
    asset: BASE.asset,
    payTo: BASE.payTo,
    amount: "250000",
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2" },
    ...overrides,
  };
}

/**
 * A wallet provider stub on the given network (never used to sign for the free actions).
 *
 * @param networkId - AgentKit network id
 * @returns A WalletProvider
 */
function walletOn(networkId: string): WalletProvider {
  return { getNetwork: () => ({ networkId, protocolFamily: "evm" }) } as unknown as WalletProvider;
}

/**
 * An EvmWalletProvider backed by a throwaway local key: it signs locally only; fetch is mocked.
 *
 * @returns The wallet provider
 */
function localEvmWallet(): EvmWalletProvider {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider;
  Object.assign(wallet, {
    getNetwork: () => ({ networkId: "base-mainnet", protocolFamily: "evm", chainId: "8453" }),
    toSigner: () => account,
    readContract: jest.fn(),
  });
  return wallet;
}

describe("matchesPinnedTerms", () => {
  it("accepts exactly the published terms", () => {
    expect(matchesPinnedTerms(baseTerms(), BASE, "250000")).toBe(true);
    expect(matchesPinnedTerms(baseTerms({ payTo: BASE.payTo.toLowerCase() }), BASE, "250000")).toBe(
      true,
    );
  });

  it.each([
    ["another recipient", { payTo: "0x0000000000000000000000000000000000000001" }],
    ["another asset", { asset: "0x0000000000000000000000000000000000000002" }],
    ["another amount", { amount: "1000000" }],
    ["another network", { network: "eip155:84532" }],
    ["another scheme", { scheme: "upto" }],
  ])("refuses %s", (_label, overrides) => {
    expect(matchesPinnedTerms(baseTerms(overrides), BASE, "250000")).toBe(false);
  });

  it("compares Solana addresses exactly", () => {
    const sol = {
      scheme: "exact",
      network: SOLANA.network,
      asset: SOLANA.asset,
      payTo: SOLANA.payTo,
      amount: "1000000",
    };
    expect(matchesPinnedTerms(sol, SOLANA, "1000000")).toBe(true);
    expect(
      matchesPinnedTerms({ ...sol, payTo: SOLANA.payTo.toLowerCase() }, SOLANA, "1000000"),
    ).toBe(false);
  });
});

describe("KestrovaActionProvider", () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it("runs the free preview without a wallet or payment", async () => {
    const preview = { counts: { High: 1 }, detectors: ["reentrancy-eth"] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(preview), { status: 200 }));
    const result = JSON.parse(
      await kestrovaActionProvider().scanPreview(walletOn("base-mainnet"), {
        sources: { "A.sol": "x" },
      }),
    );
    expect(result).toEqual(preview);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://kestrova-api.onrender.com/preview?src=agentkit");
    expect(JSON.parse(init.body)).toEqual({ sources: { "A.sol": "x" } });
    expect(init.headers["PAYMENT-SIGNATURE"]).toBeUndefined();
  });

  it("reports the price and whether the live terms match, without paying", async () => {
    fetchMock.mockResolvedValue(
      paymentRequired([baseTerms()], "https://kestrova-api.onrender.com/scan/findings"),
    );
    const result = JSON.parse(
      await kestrovaActionProvider().getScanPrice(walletOn("base-mainnet"), { tier: "findings" }),
    );
    expect(result.priceUsdc).toBe(0.25);
    expect(result.payable).toBe(true);
    expect(result.paymentOption.payTo).toBe(BASE.payTo);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flags tampered live terms as not payable", async () => {
    fetchMock.mockResolvedValue(
      paymentRequired([baseTerms({ payTo: "0x0000000000000000000000000000000000000009" })], "u"),
    );
    const result = JSON.parse(
      await kestrovaActionProvider().getScanPrice(walletOn("base-mainnet"), { tier: "findings" }),
    );
    expect(result.payable).toBe(false);
    expect(result.paymentOption).toBeNull();
  });

  it("refuses unsupported networks and prices above the cap before any request", async () => {
    const p = kestrovaActionProvider({ maxPaymentUsdc: 0.5 });
    const wrongNet = JSON.parse(
      await p.buyScan(walletOn("base-sepolia"), { sources: {}, tier: "findings" }),
    );
    expect(wrongNet.paid).toBe(false);
    const overCap = JSON.parse(await p.buyScan(localEvmWallet(), { sources: {}, tier: "full" }));
    expect(overCap.paid).toBe(false);
    expect(overCap.message).toContain("maxPaymentUsdc");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never signs terms that differ from the published ones", async () => {
    fetchMock.mockResolvedValue(
      paymentRequired([baseTerms({ payTo: "0x0000000000000000000000000000000000000009" })], "u"),
    );
    const result = JSON.parse(
      await kestrovaActionProvider().buyScan(localEvmWallet(), {
        sources: { "A.sol": "x" },
        tier: "findings",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.doNotPayAgain).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second request carrying a payment
  });

  it("pays exactly the published terms once and returns the findings", async () => {
    const url = "https://kestrova-api.onrender.com/scan/findings?src=agentkit";
    const findings = { tier: "findings", findings: [{ detector: "reentrancy-eth" }] };
    fetchMock
      .mockResolvedValueOnce(paymentRequired([baseTerms()], url))
      .mockResolvedValueOnce(new Response(JSON.stringify(findings), { status: 200 }));
    const result = JSON.parse(
      await kestrovaActionProvider().buyScan(localEvmWallet(), {
        sources: { "A.sol": "x" },
        tier: "findings",
      }),
    );
    expect(result.success).toBe(true);
    expect(result.result).toEqual(findings);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const paid = fetchMock.mock.calls[1][0] as Request;
    const header = paid.headers.get("payment-signature") ?? paid.headers.get("x-payment");
    expect(header).toBeTruthy();
    const payload = JSON.parse(Buffer.from(header as string, "base64").toString("utf8"));
    expect(payload.accepted.amount).toBe("250000");
    expect(payload.accepted.payTo).toBe(BASE.payTo);
    expect(payload.payload.authorization.to.toLowerCase()).toBe(BASE.payTo.toLowerCase());
    expect(payload.payload.authorization.value).toBe("250000");
  });

  it("tells the agent not to pay again when a payment was made but the outcome is unclear", async () => {
    fetchMock
      .mockResolvedValueOnce(paymentRequired([baseTerms()], "u"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" }), { status: 202 }));
    const result = JSON.parse(
      await kestrovaActionProvider().buyScan(localEvmWallet(), {
        sources: { "A.sol": "x" },
        tier: "findings",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.doNotPayAgain).toBe(true);
    expect(result.recovery).toContain("/scan/recover");
  });
});
