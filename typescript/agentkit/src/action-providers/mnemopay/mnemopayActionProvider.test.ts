import { MnemoPayActionProvider } from "./mnemopayActionProvider";

// Mock the @mnemopay/sdk module
const mockRemember = jest.fn();
const mockRecall = jest.fn();
const mockCharge = jest.fn();
const mockSettle = jest.fn();
const mockRefund = jest.fn();
const mockBalance = jest.fn();
const mockProfile = jest.fn();

jest.mock("@mnemopay/sdk", () => ({
  MnemoPayLite: jest.fn().mockImplementation(() => ({
    remember: mockRemember,
    recall: mockRecall,
    charge: mockCharge,
    settle: mockSettle,
    refund: mockRefund,
    balance: mockBalance,
    profile: mockProfile,
  })),
}));

const MOCK_CONFIG = {
  agentId: "test-agent",
  decayRate: 0.05,
};

describe("MnemoPayActionProvider", () => {
  let provider: MnemoPayActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new MnemoPayActionProvider(MOCK_CONFIG);
  });

  describe("Constructor", () => {
    it("should initialize with config values", () => {
      expect(() => new MnemoPayActionProvider(MOCK_CONFIG)).not.toThrow();
    });

    it("should initialize with default values", () => {
      expect(() => new MnemoPayActionProvider()).not.toThrow();
    });

    it("should use environment variables as fallback", () => {
      process.env.MNEMOPAY_AGENT_ID = "env-agent";
      process.env.MNEMOPAY_DECAY_RATE = "0.1";
      expect(() => new MnemoPayActionProvider()).not.toThrow();
      delete process.env.MNEMOPAY_AGENT_ID;
      delete process.env.MNEMOPAY_DECAY_RATE;
    });
  });

  describe("rememberOutcome", () => {
    it("should store a memory successfully", async () => {
      mockRemember.mockResolvedValue(undefined);

      const result = await provider.rememberOutcome({
        content: "Provider X delivered quality work",
        importance: 0.8,
        tags: ["provider", "quality"],
      });

      expect(result).toContain("Successfully stored memory");
      expect(result).toContain("Provider X delivered quality work");
      expect(result).toContain("0.8");
      expect(mockRemember).toHaveBeenCalledWith("Provider X delivered quality work", {
        importance: 0.8,
        tags: ["provider", "quality"],
      });
    });

    it("should use default importance when not provided", async () => {
      mockRemember.mockResolvedValue(undefined);

      const result = await provider.rememberOutcome({
        content: "Some memory",
      });

      expect(result).toContain("0.5");
      expect(mockRemember).toHaveBeenCalledWith("Some memory", {
        importance: 0.5,
        tags: [],
      });
    });

    it("should handle errors", async () => {
      mockRemember.mockRejectedValue(new Error("Storage failed"));

      const result = await provider.rememberOutcome({
        content: "Some memory",
      });

      expect(result).toContain("Error storing memory");
    });
  });

  describe("recallMemories", () => {
    it("should recall memories successfully", async () => {
      mockRecall.mockResolvedValue([
        { content: "Provider X is reliable", score: 0.95, tags: ["provider"] },
        { content: "Provider Y is slow", score: 0.72, tags: ["provider", "slow"] },
      ]);

      const result = await provider.recallMemories({
        query: "reliable providers",
        limit: 5,
      });

      expect(result).toContain("Recalled 2 memories");
      expect(result).toContain("Provider X is reliable");
      expect(result).toContain("0.950");
      expect(mockRecall).toHaveBeenCalledWith("reliable providers", 5);
    });

    it("should return message when no memories found", async () => {
      mockRecall.mockResolvedValue([]);

      const result = await provider.recallMemories({
        query: "nonexistent topic",
      });

      expect(result).toContain("No memories found");
    });

    it("should handle errors", async () => {
      mockRecall.mockRejectedValue(new Error("Recall failed"));

      const result = await provider.recallMemories({
        query: "test",
      });

      expect(result).toContain("Error recalling memories");
    });
  });

  describe("chargePayment", () => {
    it("should charge payment successfully", async () => {
      mockCharge.mockResolvedValue("tx-123-abc");

      const result = await provider.chargePayment({
        amount: 50,
        description: "Payment for design work",
      });

      expect(result).toContain("Payment charged successfully");
      expect(result).toContain("tx-123-abc");
      expect(result).toContain("50");
      expect(mockCharge).toHaveBeenCalledWith(50, "Payment for design work");
    });

    it("should handle errors", async () => {
      mockCharge.mockRejectedValue(new Error("Insufficient funds"));

      const result = await provider.chargePayment({
        amount: 50,
        description: "Payment",
      });

      expect(result).toContain("Error charging payment");
    });
  });

  describe("settlePayment", () => {
    it("should settle payment successfully", async () => {
      mockSettle.mockResolvedValue(undefined);

      const result = await provider.settlePayment({
        transactionId: "tx-123-abc",
      });

      expect(result).toContain("Payment settled successfully");
      expect(result).toContain("tx-123-abc");
      expect(result).toContain("+0.05");
      expect(mockSettle).toHaveBeenCalledWith("tx-123-abc");
    });

    it("should handle errors", async () => {
      mockSettle.mockRejectedValue(new Error("Transaction not found"));

      const result = await provider.settlePayment({
        transactionId: "invalid-tx",
      });

      expect(result).toContain("Error settling payment");
    });
  });

  describe("refundPayment", () => {
    it("should refund payment successfully", async () => {
      mockRefund.mockResolvedValue(undefined);

      const result = await provider.refundPayment({
        transactionId: "tx-123-abc",
      });

      expect(result).toContain("Payment refunded successfully");
      expect(result).toContain("tx-123-abc");
      expect(result).toContain("-0.05");
      expect(mockRefund).toHaveBeenCalledWith("tx-123-abc");
    });

    it("should handle errors", async () => {
      mockRefund.mockRejectedValue(new Error("Transaction not found"));

      const result = await provider.refundPayment({
        transactionId: "invalid-tx",
      });

      expect(result).toContain("Error refunding payment");
    });
  });

  describe("checkBalance", () => {
    it("should return balance successfully", async () => {
      mockBalance.mockReturnValue({ wallet: 150, reputation: 1.15 });

      const result = await provider.checkBalance({});

      expect(result).toContain("Agent Balance");
      expect(result).toContain("150");
      expect(result).toContain("1.15");
    });

    it("should handle errors", async () => {
      mockBalance.mockImplementation(() => {
        throw new Error("Balance error");
      });

      const result = await provider.checkBalance({});

      expect(result).toContain("Error checking balance");
    });
  });

  describe("agentProfile", () => {
    it("should return profile successfully", async () => {
      mockProfile.mockReturnValue({
        agentId: "test-agent",
        wallet: 150,
        reputation: 1.15,
        memoryCount: 42,
      });

      const result = await provider.agentProfile({});

      expect(result).toContain("Agent Profile");
      expect(result).toContain("test-agent");
    });

    it("should handle errors", async () => {
      mockProfile.mockImplementation(() => {
        throw new Error("Profile error");
      });

      const result = await provider.agentProfile({});

      expect(result).toContain("Error retrieving agent profile");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      const network = { protocolFamily: "evm", networkId: "base-mainnet" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(provider.supportsNetwork(network as any)).toBe(true);
    });
  });
});
