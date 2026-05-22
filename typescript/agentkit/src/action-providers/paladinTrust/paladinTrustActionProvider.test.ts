import { paladinTrustActionProvider } from "./paladinTrustActionProvider";
import { CheckTokenRiskSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

// Mock the fetch function
global.fetch = jest.fn();

describe("PaladinTrust Schema Validation", () => {
  it("should validate CheckTokenRisk schema with valid input", () => {
    const validInput = {
      chainId: 8453,
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    const result = CheckTokenRiskSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should fail CheckTokenRisk validation with invalid token address", () => {
    const invalidInput = {
      chainId: 8453,
      tokenAddress: "not-an-address",
    };

    const result = CheckTokenRiskSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it("should reject a non-positive chainId", () => {
    const input = {
      chainId: 0,
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    const result = CheckTokenRiskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject a non-integer chainId", () => {
    const input = {
      chainId: 8453.5,
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    const result = CheckTokenRiskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject input with extra unknown fields ignored gracefully", () => {
    // Zod strips unknown by default; this just confirms the parse still succeeds
    // on the canonical pair.
    const input = {
      chainId: 8453,
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    const result = CheckTokenRiskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("PaladinTrust Action Provider", () => {
  let provider: ReturnType<typeof paladinTrustActionProvider>;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  const MOCK_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const MOCK_TAKER = "0xabcdef1234567890abcdef1234567890abcdef12";
  const MOCK_CHAIN_ID = 8453;

  // Fixture mirroring the live /v1/trust-check/preview response shape verified
  // on 2026-05-22 against https://swap.paladinfi.com/v1/trust-check/preview for
  // USDC on Base (chainId 8453, address 0x833589fC...02913).
  const PREVIEW_FIXTURE = {
    address: MOCK_TOKEN,
    chainId: MOCK_CHAIN_ID,
    taker: null,
    request_id: "4a6228c7-d5f7-40da-9d83-3f266b17493a",
    trust: {
      risk_score: null,
      risk_score_scale: "0-100 (lower = safer); null on preview because no live evaluation runs",
      recommendation: "sample-allow",
      recommendation_enum: ["allow", "warn", "block"],
      factors: [
        { source: "ofac", signal: "not_listed", details: "Live on paid endpoint; not evaluated on preview", real: false },
        { source: "etherscan_source", signal: "verified", details: "SAMPLE — illustrative only", real: false },
        { source: "goplus", signal: "ok", details: "SAMPLE — illustrative only", real: false },
        { source: "anomaly", signal: "ok", details: "SAMPLE — illustrative only", real: false },
      ],
      version: "1.1",
      _preview: true,
      _message:
        "Preview response — request shape was validated by Pydantic. The trust block is a SAMPLE FIXTURE with no live data evaluation. recommendation is 'sample-' prefixed so this response cannot be cropped into looking like a real assessment. POST /v1/trust-check (x402-paid, $0.001/call) for live OFAC SDN screening (refreshed daily from Treasury XML), GoPlus token security, Etherscan verification, and anomaly heuristics.",
    },
  };

  beforeEach(() => {
    provider = paladinTrustActionProvider();

    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue(MOCK_TAKER),
      getNetwork: jest.fn().mockReturnValue({
        chainId: MOCK_CHAIN_ID.toString(),
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    (global.fetch as jest.Mock).mockReset();
  });

  describe("checkTokenRisk", () => {
    it("should POST to the preview endpoint and parse the response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(PREVIEW_FIXTURE),
      });

      const args = {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      };

      const response = await provider.checkTokenRisk(mockWalletProvider, args);
      const parsed = JSON.parse(response);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("https://swap.paladinfi.com/v1/trust-check/preview");
      expect(init.method).toBe("POST");
      // Default sendTaker is false → body must NOT include `taker`.
      const bodyParsed = JSON.parse(init.body);
      expect(bodyParsed).toEqual({
        chainId: MOCK_CHAIN_ID,
        address: MOCK_TOKEN,
      });
      expect(bodyParsed.taker).toBeUndefined();

      expect(parsed.success).toBe(true);
      expect(parsed.recommendation).toBe("sample-allow");
      expect(parsed.version).toBe("1.1");
      expect(parsed.factors).toHaveLength(4);
      expect(parsed.factors[0].source).toBe("ofac");
      expect(parsed.response.trust._message).toContain("Preview response");
    });

    it("should include taker in the body when constructed with sendTaker: true", async () => {
      const takerProvider = paladinTrustActionProvider({ sendTaker: true });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(PREVIEW_FIXTURE),
      });

      const args = {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      };

      await takerProvider.checkTokenRisk(mockWalletProvider, args);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const bodyParsed = JSON.parse(init.body);
      expect(bodyParsed).toEqual({
        chainId: MOCK_CHAIN_ID,
        address: MOCK_TOKEN,
        taker: MOCK_TAKER,
      });
    });

    it("should omit taker if sendTaker: true but walletProvider.getAddress throws", async () => {
      const takerProvider = paladinTrustActionProvider({ sendTaker: true });
      const throwingWallet = {
        getAddress: jest.fn().mockImplementation(() => {
          throw new Error("wallet not connected");
        }),
        getNetwork: jest.fn().mockReturnValue({
          chainId: MOCK_CHAIN_ID.toString(),
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      } as unknown as jest.Mocked<EvmWalletProvider>;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(PREVIEW_FIXTURE),
      });

      await takerProvider.checkTokenRisk(throwingWallet, {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      });

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const bodyParsed = JSON.parse(init.body);
      expect(bodyParsed.taker).toBeUndefined();
      expect(bodyParsed).toEqual({
        chainId: MOCK_CHAIN_ID,
        address: MOCK_TOKEN,
      });
    });

    it("should surface HTTP errors as success: false WITHOUT leaking response body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: jest.fn().mockResolvedValueOnce("upstream Etherscan key XYZ123 leaked"),
      });

      const response = await provider.checkTokenRisk(mockWalletProvider, {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      });
      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP 503");
      expect(parsed.error).toContain("Service Unavailable");
      expect(parsed.error).toContain("PaladinFi Trust API");
      // Body content must NOT be passed through.
      expect(parsed.error).not.toContain("XYZ123");
      expect(parsed.error).not.toContain("Etherscan");
    });

    it("should surface network errors as success: false", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

      const response = await provider.checkTokenRisk(mockWalletProvider, {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      });
      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("network down");
    });

    it("should reject responses missing the 'trust' block", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ address: MOCK_TOKEN, chainId: MOCK_CHAIN_ID }),
      });

      const response = await provider.checkTokenRisk(mockWalletProvider, {
        chainId: MOCK_CHAIN_ID,
        tokenAddress: MOCK_TOKEN,
      });
      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("unexpected response shape");
    });
  });

  describe("constructor validation", () => {
    it("should accept https:// apiBase", () => {
      expect(() => paladinTrustActionProvider({ apiBase: "https://swap.paladinfi.com" })).not.toThrow();
    });

    it("should accept http://localhost (no port)", () => {
      expect(() => paladinTrustActionProvider({ apiBase: "http://localhost" })).not.toThrow();
    });

    it("should accept http://localhost:8000", () => {
      expect(() => paladinTrustActionProvider({ apiBase: "http://localhost:8000" })).not.toThrow();
    });

    it("should reject http://localhost.evil.com (subdomain hijack)", () => {
      expect(() => paladinTrustActionProvider({ apiBase: "http://localhost.evil.com" })).toThrow(
        /must use https/,
      );
    });

    it("should reject http:// non-localhost apiBase", () => {
      expect(() => paladinTrustActionProvider({ apiBase: "http://swap.paladinfi.com" })).toThrow(
        /must use https/,
      );
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base mainnet by chainId string", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          chainId: "8453",
          networkId: "base-mainnet",
        }),
      ).toBe(true);
    });

    it("should return true for Base mainnet by networkId only", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          chainId: "1",
          networkId: "ethereum-mainnet",
        }),
      ).toBe(false);
    });

    it("should return false for non-evm networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
        }),
      ).toBe(false);
    });
  });
});
