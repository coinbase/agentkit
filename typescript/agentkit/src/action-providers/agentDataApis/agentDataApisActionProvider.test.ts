import { agentDataApisActionProvider } from "./agentDataApisActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment } from "@x402/fetch";

jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => ({})),
  wrapFetchWithPayment: jest.fn(),
}));
jest.mock("@x402/evm/exact/client", () => ({ registerExactEvmScheme: jest.fn() }));

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TOKEN = "0x95c7082fb200C77Cf0fF7849CC8cC8177e6f91BD";

/**
 * Builds a mock 402 response carrying an x402 v2 PAYMENT-REQUIRED header.
 *
 * @param amountAtomic - Price in USDC atomic units (6 decimals)
 * @returns A mock Response-like object
 */
function paymentRequired(amountAtomic: string) {
  const challenge = {
    x402Version: 2,
    accepts: [{ scheme: "exact", network: "eip155:8453", asset: BASE_USDC, amount: amountAtomic }],
  };
  return {
    ok: false,
    status: 402,
    headers: {
      get: (h: string) => (h === "payment-required" ? btoa(JSON.stringify(challenge)) : null),
    },
    text: jest.fn().mockResolvedValue("{}"),
  };
}

describe("AgentDataApisActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const walletProvider = {
    toSigner: jest.fn().mockReturnValue({ address: "0x0000000000000000000000000000000000000001" }),
    readContract: jest.fn(),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("supports only Base mainnet", () => {
    const provider = agentDataApisActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
      false,
    );
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
      false,
    );
  });

  it("pays and returns the token check when the price is within the limit", async () => {
    fetchMock.mockResolvedValueOnce(paymentRequired("10000")); // $0.01
    const paidFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ verdict: "caution", simulation: { sell_tax_pct: 9.95 } }),
    });
    (wrapFetchWithPayment as jest.Mock).mockReturnValue(paidFetch);

    const result = JSON.parse(
      await agentDataApisActionProvider().checkTokenRisk(walletProvider, {
        tokenAddress: TOKEN,
        chain: "ethereum",
      }),
    );

    expect(result.verdict).toBe("caution");
    expect(result.paid_usdc).toBe(0.01);
    expect(paidFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/token?address=${TOKEN}&chain=ethereum`),
    );
  });

  it("refuses to pay above the configured limit", async () => {
    fetchMock.mockResolvedValueOnce(paymentRequired("1000000")); // $1.00
    const result = await agentDataApisActionProvider({ maxPaymentUsdc: 0.05 }).checkTokenRisk(
      walletProvider,
      { tokenAddress: TOKEN, chain: "base" },
    );
    expect(result).toContain("above the configured limit");
    expect(wrapFetchWithPayment).not.toHaveBeenCalled();
  });

  it("refuses to pay when no USDC-on-Base option is offered", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      headers: { get: () => null },
      text: jest.fn().mockResolvedValue(""),
    });
    const result = await agentDataApisActionProvider().checkPaymentCounterparty(walletProvider, {
      address: "0x0000000000000000000000000000000000000002",
      chain: "base",
    });
    expect(result).toContain("not paying");
    expect(wrapFetchWithPayment).not.toHaveBeenCalled();
  });

  it("passes the counterparty name and entity type through as query parameters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ verdict: "review" }),
    });
    const provider = agentDataApisActionProvider();

    await provider.checkPaymentCounterparty(walletProvider, {
      address: "0x0000000000000000000000000000000000000002",
      chain: "base",
      counterpartyName: "Viktor Bout",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("name=Viktor+Bout"));

    await provider.screenSanctions(walletProvider, { name: "Sovcomflot", entityType: "entity" });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/v1/screen?name=Sovcomflot&type=entity"),
    );
  });

  it("returns an error string on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const result = await agentDataApisActionProvider().screenSanctions(walletProvider, {
      name: "Acme",
    });
    expect(result).toContain("network down");
  });
});
