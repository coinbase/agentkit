import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { moneytoolsActionProvider } from "./moneytoolsActionProvider";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const WALLET = "0x64eB63904Cf9688AC5B3087A72AcF9C31a273169";
const TOKEN = "0x4200000000000000000000000000000000000006";

const quote = (amount: string, network = "eip155:8453") =>
  new Response(
    JSON.stringify({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network,
          amount,
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: WALLET,
        },
      ],
    }),
    { status: 402, headers: { "content-type": "application/json" } },
  );
const ok = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const makeWallet = (networkId = "base-mainnet") => {
  const w = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider;
  (w as unknown as Record<string, unknown>).getNetwork = () => ({
    networkId,
    protocolFamily: "evm",
  });
  (w as unknown as Record<string, unknown>).toSigner = () => ({ address: WALLET });
  (w as unknown as Record<string, unknown>).readContract = jest.fn();
  return w;
};

describe("MoneyToolsActionProvider", () => {
  const fetchMock = jest.fn();
  const paidFetchMock = jest.fn();
  global.fetch = fetchMock;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(x402Client).mockImplementation(() => ({}) as unknown as x402Client);
    jest.mocked(registerExactEvmScheme).mockImplementation(() => ({}) as unknown as x402Client);
    jest.mocked(wrapFetchWithPayment).mockReturnValue(paidFetchMock);
  });

  it("returns free-tier token info without paying", async () => {
    fetchMock.mockResolvedValueOnce(ok({ symbol: "WETH", decimals: 18 }));
    const res = JSON.parse(
      await moneytoolsActionProvider().tokenContractInfo(makeWallet(), {
        token: TOKEN,
        chain: "base",
      }),
    );
    expect(res.success).toBe(true);
    expect(res.data.symbol).toBe("WETH");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://tools.moneytools.dev/v1/token?token=${TOKEN}&chain=base`);
    expect(init.headers["X-MoneyTools-Free"]).toBe("1");
    expect(paidFetchMock).not.toHaveBeenCalled();
  });

  it("pays a 0.02 USDC wallet risk quote on base-mainnet", async () => {
    fetchMock.mockResolvedValueOnce(quote("20000"));
    paidFetchMock.mockResolvedValueOnce(ok({ riskScore: 5, grade: "A", sanctioned: false }));
    const res = JSON.parse(
      await moneytoolsActionProvider().walletRiskCard(makeWallet(), {
        address: WALLET,
        chain: "base",
      }),
    );
    expect(res.success).toBe(true);
    expect(res.data.grade).toBe("A");
    expect(paidFetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["X-MoneyTools-Free"]).toBeUndefined();
  });

  it("refuses a quote above maxPaymentUsdc", async () => {
    fetchMock.mockResolvedValueOnce(quote("50000"));
    const res = JSON.parse(
      await moneytoolsActionProvider({ maxPaymentUsdc: 0.02 }).walletRiskCard(makeWallet(), {
        address: WALLET,
        chain: "base",
      }),
    );
    expect(res.success).toBe(false);
    expect(res.paymentRequired).toBe(true);
    expect(res.error).toMatch(/exceeds maxPaymentUsdc/);
    expect(paidFetchMock).not.toHaveBeenCalled();
  });

  it("refuses a quote on another network", async () => {
    fetchMock.mockResolvedValueOnce(quote("5000", "eip155:1"));
    const res = JSON.parse(
      await moneytoolsActionProvider().tokenSafetyCheck(makeWallet(), {
        token: TOKEN,
        chain: "base",
        usd: 10,
      }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not USDC on Base/);
    expect(paidFetchMock).not.toHaveBeenCalled();
  });

  it("does not pay from a wallet that is not on base-mainnet", async () => {
    fetchMock.mockResolvedValueOnce(quote("20000"));
    const res = JSON.parse(
      await moneytoolsActionProvider().walletRiskCard(makeWallet("base-sepolia"), {
        address: WALLET,
        chain: "ethereum",
      }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/base-mainnet/);
  });

  it("surfaces API errors", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_address" }), { status: 400 }),
    );
    const res = JSON.parse(
      await moneytoolsActionProvider().tokenContractInfo(makeWallet(), {
        token: TOKEN,
        chain: "base",
      }),
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
    expect(res.error).toBe("invalid_address");
  });

  it("supports any network for reads", () => {
    expect(
      moneytoolsActionProvider().supportsNetwork({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      }),
    ).toBe(true);
  });
});
