import { insumerActionProvider, InsumerActionProvider } from "./insumerActionProvider";
import { INSUMER_API_KEY_MISSING_ERROR } from "./constants";

const MOCK_API_KEY = "insr_live_0123456789abcdef0123456789abcdef01234567";

const MOCK_ATTEST_RESPONSE = {
  ok: true,
  data: {
    attestation: {
      id: "ATST-A1B2C",
      pass: false,
      results: [
        { condition: 0, label: "USDC >= 1000", type: "token_balance", met: true, chainId: 1 },
        { condition: 1, label: "Bored Ape holder", type: "nft_ownership", met: false, chainId: 1 },
      ],
      passCount: 1,
      failCount: 1,
      attestedAt: "2026-02-28T12:00:00.000Z",
      expiresAt: "2026-02-28T12:30:00.000Z",
    },
    sig: "MEYCIQDxABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx",
    kid: "insumer-attest-v1",
  },
  meta: {
    creditsRemaining: 97,
    creditsCharged: 1,
    version: "1.0",
    timestamp: "2026-02-28T12:00:00.000Z",
  },
};

const MOCK_TRUST_RESPONSE = {
  ok: true,
  data: {
    trust: {
      id: "TRST-A1B2C",
      wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      conditionSetVersion: "v1",
      dimensions: {
        stablecoins: { checks: [], passCount: 3, failCount: 4, total: 7 },
        governance: { checks: [], passCount: 2, failCount: 2, total: 4 },
        nfts: { checks: [], passCount: 0, failCount: 3, total: 3 },
        staking: { checks: [], passCount: 1, failCount: 2, total: 3 },
      },
      summary: {
        totalChecks: 17,
        totalPassed: 6,
        totalFailed: 11,
        dimensionsWithActivity: 3,
        dimensionsChecked: 4,
      },
      profiledAt: "2026-02-28T12:00:00.000Z",
      expiresAt: "2026-02-28T12:30:00.000Z",
    },
    sig: "MEYCIQDxABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx",
    kid: "insumer-attest-v1",
  },
  meta: {
    creditsRemaining: 47,
    creditsCharged: 3,
    version: "1.0",
    timestamp: "2026-02-28T12:00:00.000Z",
  },
};

const MOCK_BATCH_TRUST_RESPONSE = {
  ok: true,
  data: {
    results: [
      {
        trust: {
          id: "TRST-A1B2C",
          wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          conditionSetVersion: "v1",
          dimensions: {
            stablecoins: { checks: [], passCount: 3, failCount: 4, total: 7 },
            governance: { checks: [], passCount: 2, failCount: 2, total: 4 },
            nfts: { checks: [], passCount: 0, failCount: 3, total: 3 },
            staking: { checks: [], passCount: 1, failCount: 2, total: 3 },
          },
          summary: {
            totalChecks: 17,
            totalPassed: 6,
            totalFailed: 11,
            dimensionsWithActivity: 3,
            dimensionsChecked: 4,
          },
          profiledAt: "2026-02-28T12:00:00.000Z",
          expiresAt: "2026-02-28T12:30:00.000Z",
        },
        sig: "MEYCIQDx...",
        kid: "insumer-attest-v1",
      },
      {
        error: {
          wallet: "not-a-valid-address",
          message: "Invalid wallet address",
        },
      },
    ],
    summary: { requested: 2, succeeded: 1, failed: 1 },
  },
  meta: {
    creditsRemaining: 44,
    creditsCharged: 3,
    version: "1.0",
    timestamp: "2026-02-28T12:00:00.000Z",
  },
};

const MOCK_CODE_VALID_RESPONSE = {
  ok: true,
  data: {
    valid: true,
    code: "INSR-A7K3M",
    merchantId: "merchant123",
    discountPercent: 10,
    expiresAt: "2026-03-01T00:00:00.000Z",
    createdAt: "2026-02-28T12:00:00.000Z",
  },
  meta: { version: "1.0", timestamp: "2026-02-28T12:00:00.000Z" },
};

const MOCK_CODE_INVALID_RESPONSE = {
  ok: true,
  data: {
    valid: false,
    code: "INSR-ZZZZZ",
    reason: "not_found",
  },
  meta: { version: "1.0", timestamp: "2026-02-28T12:00:00.000Z" },
};

const MOCK_TEMPLATES_RESPONSE = {
  ok: true,
  data: {
    templates: {
      coinbase_verified_account: {
        provider: "Coinbase",
        description: "Coinbase Verified Account",
        chainId: 8453,
        chainName: "Base",
      },
      coinbase_verified_country: {
        provider: "Coinbase",
        description: "Coinbase Verified Country",
        chainId: 8453,
        chainName: "Base",
      },
    },
  },
  meta: { version: "1.0", timestamp: "2026-02-28T12:00:00.000Z" },
};

const MOCK_ERROR_RESPONSE = {
  ok: false,
  error: { code: 402, message: "Insufficient verification credits" },
};

describe("InsumerActionProvider", () => {
  let provider: InsumerActionProvider;

  beforeEach(() => {
    provider = insumerActionProvider({ apiKey: MOCK_API_KEY });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.INSUMER_API_KEY;
  });

  describe("constructor", () => {
    it("should initialize with API key from config", () => {
      const customProvider = insumerActionProvider({ apiKey: "custom-key" });
      expect(customProvider["apiKey"]).toBe("custom-key");
    });

    it("should initialize with API key from environment variable", () => {
      process.env.INSUMER_API_KEY = "env-key";
      const envProvider = insumerActionProvider();
      expect(envProvider["apiKey"]).toBe("env-key");
    });

    it("should throw error if API key is not provided", () => {
      delete process.env.INSUMER_API_KEY;
      expect(() => insumerActionProvider()).toThrow(INSUMER_API_KEY_MISSING_ERROR);
    });
  });

  describe("verifyWallet", () => {
    it("should successfully verify wallet conditions", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_ATTEST_RESPONSE,
      } as Response);

      const response = await provider.verifyWallet({
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        conditions: [
          { type: "token_balance", contractAddress: "0xA0b8...", chainId: 1, threshold: 1000 },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/attest");
      expect((options as RequestInit).headers).toEqual(
        expect.objectContaining({ "X-API-Key": MOCK_API_KEY }),
      );
      expect(response).toContain("ATST-A1B2C");
      expect(response).toContain("SOME CONDITIONS FAILED");
      expect(response).toContain("USDC >= 1000: PASS");
      expect(response).toContain("Bored Ape holder: FAIL");
    });

    it("should handle API error response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_ERROR_RESPONSE,
      } as Response);

      const response = await provider.verifyWallet({
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        conditions: [{ type: "token_balance", contractAddress: "0xA0b8...", chainId: 1 }],
      });

      expect(response).toContain("InsumerAPI error");
      expect(response).toContain("Insufficient verification credits");
    });

    it("should handle network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const response = await provider.verifyWallet({
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        conditions: [{ type: "token_balance", contractAddress: "0xA0b8...", chainId: 1 }],
      });

      expect(response).toContain("Error verifying wallet");
      expect(response).toContain("Network error");
    });
  });

  describe("getWalletTrustProfile", () => {
    it("should successfully get trust profile", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_TRUST_RESPONSE,
      } as Response);

      const response = await provider.getWalletTrustProfile({
        wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/trust");
      expect(response).toContain("TRST-A1B2C");
      expect(response).toContain("stablecoins: 3/7 passed");
      expect(response).toContain("6/17 checks passed");
    });

    it("should handle API error response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_ERROR_RESPONSE,
      } as Response);

      const response = await provider.getWalletTrustProfile({
        wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });

      expect(response).toContain("InsumerAPI error");
    });

    it("should handle network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Connection refused"));

      const response = await provider.getWalletTrustProfile({
        wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });

      expect(response).toContain("Error getting trust profile");
      expect(response).toContain("Connection refused");
    });
  });

  describe("getBatchWalletTrustProfiles", () => {
    it("should successfully get batch trust profiles", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_BATCH_TRUST_RESPONSE,
      } as Response);

      const response = await provider.getBatchWalletTrustProfiles({
        wallets: [
          { wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
          { wallet: "not-a-valid-address" },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/trust/batch");
      expect(response).toContain("1/2 succeeded");
      expect(response).toContain("1 failed");
      expect(response).toContain("6/17 checks passed");
      expect(response).toContain("ERROR");
    });

    it("should handle API error response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_ERROR_RESPONSE,
      } as Response);

      const response = await provider.getBatchWalletTrustProfiles({
        wallets: [{ wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }],
      });

      expect(response).toContain("InsumerAPI error");
    });

    it("should handle network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Timeout"));

      const response = await provider.getBatchWalletTrustProfiles({
        wallets: [{ wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }],
      });

      expect(response).toContain("Error getting batch trust profiles");
    });
  });

  describe("validateDiscountCode", () => {
    it("should successfully validate a valid code", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_CODE_VALID_RESPONSE,
      } as Response);

      const response = await provider.validateDiscountCode({ code: "INSR-A7K3M" });

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/codes/INSR-A7K3M");
      expect((options as RequestInit).headers).not.toEqual(
        expect.objectContaining({ "X-API-Key": expect.anything() }),
      );
      expect(response).toContain("Valid: YES");
      expect(response).toContain("Discount: 10%");
    });

    it("should handle an invalid code", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_CODE_INVALID_RESPONSE,
      } as Response);

      const response = await provider.validateDiscountCode({ code: "INSR-ZZZZZ" });

      expect(response).toContain("Valid: NO");
      expect(response).toContain("Reason: not_found");
    });

    it("should not send API key for public endpoint", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_CODE_VALID_RESPONSE,
      } as Response);

      await provider.validateDiscountCode({ code: "INSR-A7K3M" });

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBeUndefined();
    });

    it("should handle network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const response = await provider.validateDiscountCode({ code: "INSR-A7K3M" });

      expect(response).toContain("Error validating code");
    });
  });

  describe("listComplianceTemplates", () => {
    it("should successfully list templates", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_TEMPLATES_RESPONSE,
      } as Response);

      const response = await provider.listComplianceTemplates({});

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/compliance/templates");
      expect(response).toContain("coinbase_verified_account");
      expect(response).toContain("Coinbase Verified Account");
      expect(response).toContain("Base");
    });

    it("should not send API key for public endpoint", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_TEMPLATES_RESPONSE,
      } as Response);

      await provider.listComplianceTemplates({});

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBeUndefined();
    });

    it("should handle API error response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_ERROR_RESPONSE,
      } as Response);

      const response = await provider.listComplianceTemplates({});

      expect(response).toContain("InsumerAPI error");
    });

    it("should handle network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("DNS resolution failed"));

      const response = await provider.listComplianceTemplates({});

      expect(response).toContain("Error listing templates");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for all networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "unknown" })).toBe(true);
    });
  });
});
