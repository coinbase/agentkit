import { BolyraActionProvider } from "./bolyraActionProvider";

// Mock @bolyra/sdk
jest.mock("@bolyra/sdk", () => ({
  createHumanIdentity: jest.fn(() => ({ commitment: "0x1234" })),
  createAgentCredential: jest.fn(() => ({ credential: "mock" })),
  proveHandshake: jest.fn(() => ({
    humanProof: { pi_a: ["1", "2"], pi_b: [["3", "4"], ["5", "6"]], pi_c: ["7", "8"] },
    agentProof: { pi_a: ["9", "10"], pi_b: [["11", "12"], ["13", "14"]], pi_c: ["15", "16"] },
    sessionNonce: "12345",
  })),
  verifyHandshake: jest.fn(() => ({
    verified: true,
    agentNullifier: "0xabcd",
    humanNullifier: "0xef01",
    scopeCommitment: "0x5678",
    provenPermissions: ["read_data", "financial_small"],
  })),
  serializeEnvelope: jest.fn(() => '{"version":"1.0","humanProof":{},"agentProof":{},"sessionNonce":"12345"}'),
  deserializeEnvelope: jest.fn((s: string) => JSON.parse(s)),
}));

const mockWalletProvider = {
  getAddress: jest.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
  getNetwork: jest.fn().mockReturnValue({ networkId: "base-sepolia" }),
} as any;

describe("BolyraActionProvider", () => {
  let provider: BolyraActionProvider;

  beforeEach(() => {
    provider = new BolyraActionProvider({ operatorSecret: BigInt(42) });
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw when operatorSecret is missing", () => {
      expect(() => new BolyraActionProvider({} as any)).toThrow("requires operatorSecret");
    });

    it("should accept bigint secret", () => {
      const p = new BolyraActionProvider({ operatorSecret: BigInt(99) });
      expect(p).toBeDefined();
    });

    it("should accept hex string secret", () => {
      const p = new BolyraActionProvider({ operatorSecret: "0xff" });
      expect(p).toBeDefined();
    });
  });

  describe("supportsNetwork", () => {
    it("should support all networks (off-chain ZKP)", () => {
      expect(provider.supportsNetwork({ networkId: "base-sepolia" })).toBe(true);
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" })).toBe(true);
      expect(provider.supportsNetwork({})).toBe(true);
    });
  });

  describe("createIdentityProof", () => {
    it("should create a proof with valid permissions", async () => {
      const result = await provider.createIdentityProof(mockWalletProvider, {
        permissions: ["read_data", "financial_small"],
        expirySeconds: 3600,
      });

      expect(result).toContain("Identity proof created");
      expect(result).toContain("read_data, financial_small");
      expect(result).toContain("Expires:");
    });

    it("should reject invalid permissions", async () => {
      const result = await provider.createIdentityProof(mockWalletProvider, {
        permissions: ["invalid_perm"],
        expirySeconds: 3600,
      });

      expect(result).toContain("Invalid permissions");
    });
  });

  describe("verifyIdentityProof", () => {
    it("should verify a valid proof envelope", async () => {
      const envelope = '{"version":"1.0","humanProof":{},"agentProof":{},"sessionNonce":"12345"}';
      const result = await provider.verifyIdentityProof(mockWalletProvider, {
        proofEnvelope: envelope,
      });

      expect(result).toContain("Verification PASSED");
      expect(result).toContain("Agent nullifier");
    });

    it("should report failure for invalid proof", async () => {
      const sdk = require("@bolyra/sdk");
      sdk.verifyHandshake.mockReturnValueOnce({ verified: false });

      const result = await provider.verifyIdentityProof(mockWalletProvider, {
        proofEnvelope: '{"version":"1.0","humanProof":{},"agentProof":{},"sessionNonce":"bad"}',
      });

      expect(result).toContain("Verification FAILED");
    });

    it("should pass when required permissions are present", async () => {
      const envelope = '{"version":"1.0","humanProof":{},"agentProof":{},"sessionNonce":"12345"}';
      const result = await provider.verifyIdentityProof(mockWalletProvider, {
        proofEnvelope: envelope,
        requiredPermissions: ["read_data"],
      });

      expect(result).toContain("Verification PASSED");
      expect(result).toContain("Required permissions verified");
    });

    it("should fail when required permissions are missing", async () => {
      const envelope = '{"version":"1.0","humanProof":{},"agentProof":{},"sessionNonce":"12345"}';
      const result = await provider.verifyIdentityProof(mockWalletProvider, {
        proofEnvelope: envelope,
        requiredPermissions: ["financial_unlimited"],
      });

      expect(result).toContain("INSUFFICIENT PERMISSIONS");
      expect(result).toContain("Missing: financial_unlimited");
    });
  });

  describe("SDK not installed", () => {
    it("should return error when @bolyra/sdk is missing", async () => {
      jest.resetModules();
      jest.mock("@bolyra/sdk", () => {
        throw new Error("Cannot find module '@bolyra/sdk'");
      });
      const { BolyraActionProvider: FreshProvider } = require("./bolyraActionProvider");
      const p = new FreshProvider({ operatorSecret: BigInt(42) });

      const result = await p.createIdentityProof(mockWalletProvider, {
        permissions: ["read_data"],
        expirySeconds: 3600,
      });

      expect(result).toContain("@bolyra/sdk is required");
    });
  });
});
