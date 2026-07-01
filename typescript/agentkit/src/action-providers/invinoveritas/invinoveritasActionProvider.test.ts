import {
  invinoveritasActionProvider,
  InvinoveritasActionProvider,
} from "./invinoveritasActionProvider";

const MOCK_API_KEY = "invinoveritas-test-key";

const MOCK_REVIEW_RESPONSE = {
  verdict: "approve",
  confidence: 0.9,
  summary: "Looks fine.",
  issues: [],
};

const MOCK_VERIFY_PROOF_RESPONSE = {
  valid: true,
  checks: {
    id_integrity: true,
    signature_valid: true,
    issued_by_invinoveritas: true,
    is_proof_event: true,
  },
};

describe("InvinoveritasActionProvider", () => {
  let provider: InvinoveritasActionProvider;

  beforeEach(() => {
    delete process.env.INVINOVERITAS_API_KEY;
    provider = invinoveritasActionProvider({ apiKey: MOCK_API_KEY });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.INVINOVERITAS_API_KEY;
  });

  describe("constructor", () => {
    it("should initialize with API key from constructor", () => {
      const customProvider = invinoveritasActionProvider({ apiKey: "custom-key" });
      expect(customProvider["apiKey"]).toBe("custom-key");
    });

    it("should initialize with API key from environment variable", () => {
      process.env.INVINOVERITAS_API_KEY = "env-key";
      const envProvider = invinoveritasActionProvider();
      expect(envProvider["apiKey"]).toBe("env-key");
    });

    it("should NOT throw when no API key is provided — verify_proof needs none, and review must degrade, not block construction", () => {
      expect(() => invinoveritasActionProvider()).not.toThrow();
    });

    it("should default baseUrl and timeoutMs when not provided", () => {
      const defaultProvider = invinoveritasActionProvider({ apiKey: "k" });
      expect(defaultProvider["baseUrl"]).toBe("https://api.babyblueviper.com");
      expect(defaultProvider["timeoutMs"]).toBe(20000);
    });
  });

  describe("review", () => {
    it("should return review_unavailable (not throw) when no API key is configured", async () => {
      const noKeyProvider = invinoveritasActionProvider();
      const response = await noKeyProvider.review({ artifact: "swap 1 ETH for USDC" });
      const parsed = JSON.parse(response);
      expect(parsed.verdict).toBe("review_unavailable");
    });

    it("should successfully fetch a review verdict", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_REVIEW_RESPONSE,
      } as Response);

      const response = await provider.review({
        artifact: "swap 1 ETH for USDC",
        artifactType: "onchain_action",
        sign: true,
      });
      const parsed = JSON.parse(response);

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.babyblueviper.com/review");
      expect(options).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${MOCK_API_KEY}`,
          }),
        }),
      );
      expect(JSON.parse(options!.body as string)).toEqual({
        artifact: "swap 1 ETH for USDC",
        artifact_type: "onchain_action",
        context: undefined,
        sign: true,
      });
      expect(parsed.verdict).toBe("approve");
      expect(parsed.confidence).toBe(0.9);
    });

    it("should default artifact_type to 'general' when not provided", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_REVIEW_RESPONSE,
      } as Response);

      await provider.review({ artifact: "rename a local variable" });

      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options!.body as string).artifact_type).toBe("general");
    });

    it("should degrade to review_unavailable on a non-ok HTTP response, not throw", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ detail: "Payment Required" }),
      } as Response);

      const response = await provider.review({ artifact: "swap 1 ETH for USDC" });
      const parsed = JSON.parse(response);
      expect(parsed.verdict).toBe("review_unavailable");
      expect(parsed.reason).toContain("402");
    });

    it("should degrade to review_unavailable on a network error, not throw", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

      const response = await provider.review({ artifact: "swap 1 ETH for USDC" });
      const parsed = JSON.parse(response);
      expect(parsed.verdict).toBe("review_unavailable");
    });

    it("should surface the proof and recompute_proof_at only when sign=true and a proof is returned", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ ...MOCK_REVIEW_RESPONSE, proof: { event: { id: "abc" } } }),
      } as Response);

      const response = await provider.review({ artifact: "swap 1 ETH for USDC", sign: true });
      const parsed = JSON.parse(response);
      expect(parsed.proof).toEqual({ event: { id: "abc" } });
      expect(parsed.recompute_proof_at).toBe("https://api.babyblueviper.com/verify-proof");
    });
  });

  describe("verifyProof", () => {
    it("should require either event or proofId", async () => {
      const response = await provider.verifyProof({});
      const parsed = JSON.parse(response);
      expect(parsed.valid).toBe(false);
      expect(parsed.error).toContain("Provide");
    });

    it("should work with NO API key configured — free, no-auth action", async () => {
      const noKeyProvider = invinoveritasActionProvider();
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_VERIFY_PROOF_RESPONSE,
      } as Response);

      const response = await noKeyProvider.verifyProof({ event: { id: "abc" } });
      const parsed = JSON.parse(response);

      const [, options] = fetchMock.mock.calls[0];
      expect((options!.headers as Record<string, string>)["Authorization"]).toBeUndefined();
      expect(parsed.valid).toBe(true);
    });

    it("should verify a proof event and return the result unmodified", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_VERIFY_PROOF_RESPONSE,
      } as Response);

      const response = await provider.verifyProof({ event: { id: "abc" } });
      expect(JSON.parse(response)).toEqual(MOCK_VERIFY_PROOF_RESPONSE);
    });

    it("should verify by proofId when event is not provided", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_VERIFY_PROOF_RESPONSE,
      } as Response);

      await provider.verifyProof({ proofId: "proof-123" });

      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options!.body as string)).toEqual({
        event: undefined,
        proof_id: "proof-123",
      });
    });

    it("should degrade to valid:false on a network error, not throw", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

      const response = await provider.verifyProof({ event: { id: "abc" } });
      const parsed = JSON.parse(response);
      expect(parsed.valid).toBe(false);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network — invinoveritas is API-only, no wallet operations", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" } as never)).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" } as never)).toBe(true);
    });
  });
});
