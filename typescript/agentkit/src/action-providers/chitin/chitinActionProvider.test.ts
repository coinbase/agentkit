import { chitinActionProvider } from "./chitinActionProvider";

describe("ChitinActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = chitinActionProvider({
    apiUrl: "https://chitin.id/api/v1",
    certsApiUrl: "https://certs.chitin.id/api/v1",
    apiKey: "test-api-key",
  });

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("getSoulProfile", () => {
    it("should return the soul profile for a given agent name", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agentName: "kani-alpha",
          tokenId: 1,
          soulHash: "0xabc123",
          genesisStatus: "SEALED",
          soulAlignmentScore: 95,
        }),
      });

      const result = await provider.getSoulProfile({ name: "kani-alpha" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.profile.agentName).toEqual("kani-alpha");
      expect(parsed.profile.genesisStatus).toEqual("SEALED");
    });

    it("should return error for non-existent agent", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      const result = await provider.getSoulProfile({ name: "nonexistent" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("404");
    });
  });

  describe("resolveDID", () => {
    it("should return the DID document for a given agent name", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "did:chitin:kani-alpha",
          verificationMethod: [],
          service: [],
        }),
      });

      const result = await provider.resolveDID({ name: "kani-alpha" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.didDocument.id).toEqual("did:chitin:kani-alpha");
    });

    it("should return error for non-existent agent", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      const result = await provider.resolveDID({ name: "nonexistent" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("404");
    });
  });

  describe("verifyCert", () => {
    it("should return certificate verification result", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenId: 1,
          valid: true,
          issuer: "Chitin Protocol",
          revoked: false,
        }),
      });

      const result = await provider.verifyCert({ certId: "1" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.certificate.valid).toBe(true);
      expect(parsed.certificate.revoked).toBe(false);
    });

    it("should return error for invalid certificate", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Certificate not found",
      });

      const result = await provider.verifyCert({ certId: "999" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("404");
    });
  });

  describe("checkA2aReady", () => {
    it("should return A2A readiness status", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agentName: "kani-alpha",
          a2aReady: true,
          a2aEndpoint: "https://kani-alpha.example.com/a2a",
          a2aEndpointSource: "erc8004",
          soulIntegrity: "verified",
          genesisSealed: true,
          ownerVerified: true,
          soulValidity: "valid",
          trustScore: 95,
        }),
      });

      const result = await provider.checkA2aReady({ name: "kani-alpha" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.a2aStatus.a2aReady).toBe(true);
      expect(parsed.a2aStatus.soulIntegrity).toEqual("verified");
    });

    it("should return not-ready status for unverified agent", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agentName: "new-agent",
          a2aReady: false,
          a2aEndpoint: null,
          soulIntegrity: "pending",
          genesisSealed: false,
          ownerVerified: false,
          soulValidity: "not_linked",
          trustScore: 0,
        }),
      });

      const result = await provider.checkA2aReady({ name: "new-agent" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.a2aStatus.a2aReady).toBe(false);
    });
  });

  describe("registerSoul", () => {
    it("should complete the challenge-response registration flow", async () => {
      // Step 1: Challenge
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          challengeId: "ch_123",
          question: "What is SHA-256 of the string 'chitin:my-agent:1738975532'? Reply with hex.",
          nameAvailable: true,
          expiresAt: "2026-02-08T12:00:00Z",
        }),
      });

      // Step 2: Register
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          registrationId: "reg_abc123",
          claimUrl: "https://chitin.id/claim/reg_abc123",
          status: "pending_claim",
        }),
      });

      const result = await provider.registerSoul({
        name: "my-agent",
        systemPrompt: "You are a helpful assistant.",
        agentType: "personal",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.registration.claimUrl).toContain("chitin.id/claim");
    });

    it("should return error if name is not available", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          challengeId: "ch_456",
          question: "What is SHA-256 of the string 'chitin:taken:1738975532'?",
          nameAvailable: false,
          expiresAt: "2026-02-08T12:00:00Z",
        }),
      });

      const result = await provider.registerSoul({
        name: "taken",
        systemPrompt: "Test prompt",
        agentType: "personal",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("not available");
    });
  });

  describe("issueCert", () => {
    it("should issue a certificate", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenId: 2,
          txHash: "0xabc123",
          recipient: "0x1234567890abcdef1234567890abcdef12345678",
        }),
      });

      const result = await provider.issueCert({
        recipientAddress: "0x1234567890abcdef1234567890abcdef12345678",
        certType: "achievement",
        title: "First A2A Communication",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.certificate.tokenId).toEqual(2);
    });

    it("should require API key", async () => {
      const noKeyProvider = chitinActionProvider({ apiKey: undefined });

      // Clear CHITIN_API_KEY env var
      const origEnv = process.env.CHITIN_API_KEY;
      delete process.env.CHITIN_API_KEY;

      const result = await noKeyProvider.issueCert({
        recipientAddress: "0x1234567890abcdef1234567890abcdef12345678",
        certType: "achievement",
        title: "Test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("CHITIN_API_KEY");

      process.env.CHITIN_API_KEY = origEnv;
    });
  });

  describe("supportsNetwork", () => {
    it("should support all networks (read actions are network-agnostic)", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      ).toBe(true);
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet", chainId: "1" }),
      ).toBe(true);
    });
  });
});
