import { x402BazaarActionProvider, X402BazaarActionProvider } from "./x402bazaarActionProvider";
import { TOKEN_VERDICT_URL } from "./constants";

const MOCK_TOKEN = "0x1234567890abcdef1234567890abcdef12345678";

const MOCK_VERDICT = {
  verdict: "CAUTION",
  confidence: "high",
  headline: "Tradeable but owner can raise sell tax",
  reasons: ["Owner can set sell tax up to 25%", "Liquidity not locked"],
  recommendedMaxSizeUsd: 250,
  cardUrl: "https://402.com.tr/brand/verdict?v=CAUTION",
  detail: {},
  receipt: null,
};

describe("X402BazaarActionProvider", () => {
  let provider: X402BazaarActionProvider;

  beforeEach(() => {
    provider = x402BazaarActionProvider();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("token_verdict_check (free tier)", () => {
    it("calls the free tier and returns the verdict", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: MOCK_VERDICT }),
      } as Response);

      const response = await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });

      expect(fetchMock).toHaveBeenCalled();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain(TOKEN_VERDICT_URL);
      expect(url).toContain(`address=${MOCK_TOKEN}`);
      expect(url).toContain("free=1");

      const parsed = JSON.parse(response);
      expect(parsed.success).toBe(true);
      expect(parsed.verdict.verdict).toBe("CAUTION");
      expect(parsed.verdict.recommendedMaxSizeUsd).toBe(250);
    });

    it("includes amountUsd in the query when provided", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: MOCK_VERDICT }),
      } as Response);

      await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN, amountUsd: 500 });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("amountUsd=500");
    });

    it("unwraps a raw (unwrapped) verdict response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_VERDICT,
      } as Response);

      const response = await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });
      const parsed = JSON.parse(response);
      expect(parsed.verdict.verdict).toBe("CAUTION");
    });

    it("returns a payment_required error on a 402 response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => "Payment Required",
      } as Response);

      const response = await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });
      const parsed = JSON.parse(response);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("Payment required");
    });

    it("returns an error on a non-ok response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);

      const response = await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });
      const parsed = JSON.parse(response);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("500");
    });

    it("handles a network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const response = await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });
      const parsed = JSON.parse(response);
      expect(parsed.error).toBe(true);
      expect(parsed.details).toContain("Network error");
    });
  });

  describe("multi-chain routing", () => {
    const okFetch = () =>
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: MOCK_VERDICT }),
      } as Response);

    it("routes an Arbitrum token to arb-token-verdict", async () => {
      const fetchMock = okFetch();
      await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN, chain: "arbitrum" });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("arb-token-verdict");
      expect(url).toContain(`address=${MOCK_TOKEN}`);
    });

    it("routes a Solana mint to sol-token-verdict with mint=", async () => {
      const fetchMock = okFetch();
      const mint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
      await provider.tokenVerdictCheck({} as never, { address: mint });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("sol-token-verdict");
      expect(url).toContain(`mint=${mint}`);
    });

    it("defaults a 0x token to Base token-verdict", async () => {
      const fetchMock = okFetch();
      await provider.tokenVerdictCheck({} as never, { address: MOCK_TOKEN });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("/token-verdict");
      expect(url).not.toContain("arb-token-verdict");
      expect(url).not.toContain("sol-token-verdict");
    });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet (evm)", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
          chainId: "8453",
        }),
      ).toBe(true);
    });

    it("does not support other EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
          chainId: "1",
        }),
      ).toBe(false);
    });

    it("does not support non-EVM networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" }),
      ).toBe(false);
    });
  });
});
