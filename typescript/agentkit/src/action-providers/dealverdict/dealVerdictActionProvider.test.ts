import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { dealVerdictActionProvider } from "./dealVerdictActionProvider";
import { isBuyAllowed, validateDealVerdictPayment } from "./utils";
import { DEAL_VERDICT_PAY_TO } from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetch = jest.fn();
const mockFetchWithPayment = jest.fn();
global.fetch = mockFetch;

jest
  .mocked(x402Client)
  .mockImplementation(() => ({}) as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => ({}) as unknown as InstanceType<typeof x402Client>);

const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const makeWalletProvider = () => {
  const wp = Object.create(EvmWalletProvider.prototype);
  wp.toSigner = jest
    .fn()
    .mockReturnValue({ address: "0x0000000000000000000000000000000000000001" });
  wp.readContract = jest.fn();
  wp.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" });
  return wp as EvmWalletProvider;
};

const paymentRequiredHeader = (overrides: Record<string, string> = {}) =>
  Buffer.from(
    JSON.stringify({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "10000",
          asset: USDC_ON_BASE,
          payTo: DEAL_VERDICT_PAY_TO,
          ...overrides,
        },
      ],
    }),
  ).toString("base64");

const mock402 = (header: string) => ({
  status: 402,
  ok: false,
  headers: { get: (name: string) => (name === "payment-required" ? header : null) },
  json: jest.fn(),
});

const mockCardResponse = (card: Record<string, unknown>) => ({
  status: 200,
  ok: true,
  headers: { get: () => null },
  json: jest.fn().mockResolvedValue(card),
});

const dealCard = (verdict: string) => ({
  product: "Apple AirPods Pro 2",
  url: null,
  verdict,
  inputPrice: 189,
  compareAtPrice: 249,
  lowestFound: { price: 149, sourceUrl: "https://example.com/airpods", store: "example.com" },
  typicalPrice: 219.99,
  savingsVsTypical: 30.99,
  sources: [],
  sourceCount: 3,
});

describe("DealVerdictActionProvider", () => {
  const provider = dealVerdictActionProvider();
  const walletProvider = makeWalletProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet only", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" } as Network),
      ).toBe(false);
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
        } as unknown as Network),
      ).toBe(false);
    });
  });

  describe("gate rule (isBuyAllowed)", () => {
    it("allows real_deal and fair, blocks everything else", () => {
      expect(isBuyAllowed({ verdict: "real_deal" })).toBe(true);
      expect(isBuyAllowed({ verdict: "fair" })).toBe(true);
      expect(isBuyAllowed({ verdict: "fake_discount" })).toBe(false);
      expect(isBuyAllowed({ verdict: "overpriced" })).toBe(false);
      expect(isBuyAllowed({ verdict: "unknown" })).toBe(false);
      expect(isBuyAllowed(null)).toBe(false);
      expect(isBuyAllowed(undefined)).toBe(false);
    });
  });

  describe("payment validation", () => {
    const good = [
      { scheme: "exact", network: "eip155:8453", amount: "10000", payTo: DEAL_VERDICT_PAY_TO },
    ];
    it("accepts the expected $0.01 Base ask", () => {
      expect(validateDealVerdictPayment(good)).toBeNull();
    });
    it("rejects a higher price, a wrong network, and a wrong recipient", () => {
      expect(validateDealVerdictPayment([{ ...good[0], amount: "20000" }])).toContain("exceeds");
      expect(validateDealVerdictPayment([{ ...good[0], network: "eip155:1" }])).toContain(
        "network",
      );
      expect(
        validateDealVerdictPayment([
          { ...good[0], payTo: "0x0000000000000000000000000000000000000002" },
        ]),
      ).toContain("recipient");
      expect(validateDealVerdictPayment([])).not.toBeNull();
      expect(validateDealVerdictPayment(undefined)).not.toBeNull();
    });
  });

  describe("checkDeal", () => {
    it("returns allowed:true for a real_deal verdict", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
      mockFetchWithPayment.mockResolvedValueOnce(mockCardResponse(dealCard("real_deal")));
      const result = JSON.parse(
        await provider.checkDeal(walletProvider, {
          product: "Apple AirPods Pro 2",
          price: 189,
          compareAtPrice: 249,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(true);
      expect(result.card.verdict).toBe("real_deal");
      // Paid call went to the constant endpoint with the documented body.
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://x402-web-reader.vercel.app/api/deal-verdict",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            product: "Apple AirPods Pro 2",
            price: 189,
            compareAtPrice: 249,
          }),
        }),
      );
    });

    it("returns allowed:false for fake_discount and overpriced", async () => {
      for (const verdict of ["fake_discount", "overpriced"]) {
        mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
        mockFetchWithPayment.mockResolvedValueOnce(mockCardResponse(dealCard(verdict)));
        const result = JSON.parse(
          await provider.checkDeal(walletProvider, { product: "Apple AirPods Pro 2", price: 189 }),
        );
        expect(result.allowed).toBe(false);
        expect(result.card.lowestFound.price).toBe(149);
      }
    });

    it("refuses to pay when the 402 asks for more than $0.01", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader({ amount: "999999" })));
      const result = JSON.parse(
        await provider.checkDeal(walletProvider, { product: "Apple AirPods Pro 2", price: 189 }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Refusing to pay");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses to pay a different recipient", async () => {
      mockFetch.mockResolvedValueOnce(
        mock402(paymentRequiredHeader({ payTo: "0x0000000000000000000000000000000000000002" })),
      );
      const result = JSON.parse(
        await provider.checkDeal(walletProvider, { product: "Apple AirPods Pro 2", price: 189 }),
      );
      expect(result.success).toBe(false);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("reports a 502 as an uncharged failure", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
      mockFetchWithPayment.mockResolvedValueOnce({
        status: 502,
        ok: false,
        headers: { get: () => null },
        json: jest.fn(),
      });
      const result = JSON.parse(
        await provider.checkDeal(walletProvider, { product: "Apple AirPods Pro 2", price: 189 }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("502");
    });

    it("reports a non-402 preflight failure without paying", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: { get: () => null },
        json: jest.fn(),
      });
      const result = JSON.parse(
        await provider.checkDeal(walletProvider, { product: "Apple AirPods Pro 2", price: 189 }),
      );
      expect(result.success).toBe(false);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });
  });
});
