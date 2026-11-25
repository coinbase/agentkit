import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { readLiteActionProvider } from "./readLiteActionProvider";
import { truncatePageMarkdown, validateReadLitePayment } from "./utils";
import { READ_LITE_PAY_TO } from "./constants";

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
const PAGE_URL = "https://example.com";

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
          amount: "5000",
          asset: USDC_ON_BASE,
          payTo: READ_LITE_PAY_TO,
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

const mockPageResponse = (page: Record<string, unknown>) => ({
  status: 200,
  ok: true,
  headers: { get: () => null },
  json: jest.fn().mockResolvedValue(page),
});

const samplePage = {
  url: PAGE_URL,
  title: "Example Domain",
  excerpt: "This domain is for use in documentation examples.",
  markdown: "# Example Domain\n\nThis domain is for use in documentation examples.",
  wordCount: 12,
};

describe("ReadLiteActionProvider", () => {
  const provider = readLiteActionProvider();
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

  describe("markdown truncation", () => {
    it("leaves short pages untouched and caps long ones", () => {
      expect(truncatePageMarkdown(samplePage)).toEqual(samplePage);
      const longPage = { ...samplePage, markdown: "x".repeat(40000) };
      const truncated = truncatePageMarkdown(longPage);
      expect(truncated.markdown).toHaveLength(32000);
      expect(truncated.markdownTruncated).toBe(true);
      expect(truncated.wordCount).toBe(12);
    });
  });

  describe("payment validation", () => {
    const good = [
      { scheme: "exact", network: "eip155:8453", amount: "5000", payTo: READ_LITE_PAY_TO },
    ];
    it("accepts the expected $0.005 Base ask", () => {
      expect(validateReadLitePayment(good)).toBeNull();
    });
    it("rejects a higher price, a wrong network, and a wrong recipient", () => {
      expect(validateReadLitePayment([{ ...good[0], amount: "6000" }])).toContain("exceeds");
      expect(validateReadLitePayment([{ ...good[0], network: "eip155:1" }])).toContain("network");
      expect(
        validateReadLitePayment([
          { ...good[0], payTo: "0x0000000000000000000000000000000000000002" },
        ]),
      ).toContain("recipient");
      expect(validateReadLitePayment([])).not.toBeNull();
      expect(validateReadLitePayment(undefined)).not.toBeNull();
    });
  });

  describe("readUrlLite", () => {
    it("returns the page markdown for a paid read", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
      mockFetchWithPayment.mockResolvedValueOnce(mockPageResponse(samplePage));
      const result = JSON.parse(await provider.readUrlLite(walletProvider, { url: PAGE_URL }));
      expect(result.success).toBe(true);
      expect(result.page.title).toBe("Example Domain");
      expect(result.page.markdown).toContain("# Example Domain");
      // Paid call went to the constant endpoint with the documented body.
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://x402-web-reader.vercel.app/api/read-lite",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ url: PAGE_URL }),
        }),
      );
    });

    it("refuses to pay when the 402 asks for more than $0.005", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader({ amount: "999999" })));
      const result = JSON.parse(await provider.readUrlLite(walletProvider, { url: PAGE_URL }));
      expect(result.success).toBe(false);
      expect(result.error).toContain("Refusing to pay");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses to pay a different recipient", async () => {
      mockFetch.mockResolvedValueOnce(
        mock402(paymentRequiredHeader({ payTo: "0x0000000000000000000000000000000000000002" })),
      );
      const result = JSON.parse(await provider.readUrlLite(walletProvider, { url: PAGE_URL }));
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
      const result = JSON.parse(await provider.readUrlLite(walletProvider, { url: PAGE_URL }));
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
      const result = JSON.parse(await provider.readUrlLite(walletProvider, { url: PAGE_URL }));
      expect(result.success).toBe(false);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });
  });
});
