import { ngzActionProvider } from "./ngzActionProvider";

const mockReadContract = jest.fn();
const mockSendTransaction = jest.fn();

jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      readContract: mockReadContract,
    })),
  };
});

describe("NGZActionProvider", () => {
  const provider = ngzActionProvider();

  const mockWalletProvider = {
    sendTransaction: mockSendTransaction,
    getAddress: jest.fn().mockResolvedValue("0xabc123"),
    getNetwork: jest.fn().mockResolvedValue({ networkId: "base-sepolia" }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getLeaderboard ───────────────────────────────────────────────

  describe("getLeaderboard", () => {
    it("should return ranked leaderboard on success", async () => {
      mockReadContract.mockResolvedValueOnce([
        ["0xuser1", "0xuser2"],
        [
          {
            username: "benny",
            habitName: "No Pornography",
            category: 1,
            currentStreak: 30n,
            longestStreak: 30n,
            lastCheckIn: 1700000000n,
            startedAt: 1697000000n,
            totalCheckIns: 30n,
            totalRelapses: 0n,
            totalTipsReceived: 0n,
            registered: true,
          },
          {
            username: "alice",
            habitName: "No Smoking",
            category: 2,
            currentStreak: 14n,
            longestStreak: 20n,
            lastCheckIn: 1700000000n,
            startedAt: 1698000000n,
            totalCheckIns: 14n,
            totalRelapses: 1n,
            totalTipsReceived: 1000000000000000n,
            registered: true,
          },
        ],
      ]);

      const result = await provider.getLeaderboard({ limit: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
      expect(parsed.leaderboard[0].rank).toBe(1);
      expect(parsed.leaderboard[0].username).toBe("benny");
      expect(parsed.leaderboard[0].currentStreak).toBe(30);
      expect(parsed.leaderboard[1].username).toBe("alice");
    });

    it("should return empty list when no users registered", async () => {
      mockReadContract.mockResolvedValueOnce([[], []]);

      const result = await provider.getLeaderboard({ limit: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
      expect(parsed.leaderboard).toEqual([]);
    });

    it("should return error on contract failure", async () => {
      mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

      const result = await provider.getLeaderboard({ limit: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("RPC error");
    });
  });

  // ─── getUser ─────────────────────────────────────────────────────

  describe("getUser", () => {
    it("should return user stats for a registered address", async () => {
      mockReadContract.mockResolvedValueOnce({
        username: "benny",
        habitName: "No Pornography",
        category: 1,
        currentStreak: 30n,
        longestStreak: 30n,
        lastCheckIn: 1700000000n,
        startedAt: 1697000000n,
        totalCheckIns: 30n,
        totalRelapses: 0n,
        totalTipsReceived: 500000000000000n,
        registered: true,
      });

      const result = await provider.getUser({ address: "0xuser1" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.registered).toBe(true);
      expect(parsed.username).toBe("benny");
      expect(parsed.currentStreak).toBe(30);
      expect(parsed.totalRelapses).toBe(0);
    });

    it("should return registered: false for unknown address", async () => {
      mockReadContract.mockResolvedValueOnce({
        username: "",
        habitName: "",
        category: 0,
        currentStreak: 0n,
        longestStreak: 0n,
        lastCheckIn: 0n,
        startedAt: 0n,
        totalCheckIns: 0n,
        totalRelapses: 0n,
        totalTipsReceived: 0n,
        registered: false,
      });

      const result = await provider.getUser({ address: "0xunknown" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.registered).toBe(false);
    });

    it("should return error on contract failure", async () => {
      mockReadContract.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.getUser({ address: "0xuser1" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Network error");
    });
  });

  // ─── getWallOfShame ──────────────────────────────────────────────

  describe("getWallOfShame", () => {
    it("should return relapse events", async () => {
      mockReadContract.mockResolvedValueOnce([
        {
          user: "0xuser1",
          username: "benny",
          habitName: "No Pornography",
          streakLost: 25n,
          timestamp: 1700000000n,
          message: "I was weak",
        },
      ]);

      const result = await provider.getWallOfShame({ limit: 10, offset: 0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(1);
      expect(parsed.relapses[0].username).toBe("benny");
      expect(parsed.relapses[0].streakLost).toBe(25);
      expect(parsed.relapses[0].message).toBe("I was weak");
    });

    it("should return empty list when wall is clean", async () => {
      mockReadContract.mockResolvedValueOnce([]);

      const result = await provider.getWallOfShame({ limit: 10, offset: 0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
      expect(parsed.relapses).toEqual([]);
    });

    it("should return error on contract failure", async () => {
      mockReadContract.mockRejectedValueOnce(new Error("Timeout"));

      const result = await provider.getWallOfShame({ limit: 10, offset: 0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Timeout");
    });
  });

  // ─── checkIn ─────────────────────────────────────────────────────

  describe("checkIn", () => {
    it("should return transaction hash on success", async () => {
      mockSendTransaction.mockResolvedValueOnce("0xtxhash123");

      const result = await provider.checkIn({}, mockWalletProvider as never);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.transactionHash).toBe("0xtxhash123");
      expect(parsed.message).toContain("streak");
    });

    it("should return error when transaction fails", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("Insufficient gas"));

      const result = await provider.checkIn({}, mockWalletProvider as never);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Insufficient gas");
    });
  });

  // ─── tipUser ─────────────────────────────────────────────────────

  describe("tipUser", () => {
    it("should return transaction hash on successful tip", async () => {
      mockSendTransaction.mockResolvedValueOnce("0xtiphash456");

      const result = await provider.tipUser(
        {
          recipientAddress: "0x1234567890123456789012345678901234567890",
          amountInEth: "0.001",
          message: "Keep going!",
        },
        mockWalletProvider as never,
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.transactionHash).toBe("0xtiphash456");
      expect(parsed.message).toContain("0.001 ETH");
    });

    it("should return error when tip transaction fails", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("Insufficient balance"));

      const result = await provider.tipUser(
        {
          recipientAddress: "0x1234567890123456789012345678901234567890",
          amountInEth: "0.001",
          message: "",
        },
        mockWalletProvider as never,
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Insufficient balance");
    });
  });

  // ─── supportsNetwork ─────────────────────────────────────────────

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as never)).toBe(true);
    });

    it("should support base-sepolia", () => {
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as never)).toBe(true);
    });

    it("should not support other networks", () => {
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as never)).toBe(false);
    });
  });
});
