import { PayCrowActionProvider } from "./paycrowActionProvider";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("PayCrowActionProvider", () => {
  let provider: PayCrowActionProvider;

  beforeEach(() => {
    provider = new PayCrowActionProvider();
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("should have the correct name", () => {
      expect(provider.name).toBe("paycrow");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(provider.supportsNetwork({} as any)).toBe(true);
    });
  });

  describe("trustGate", () => {
    it("should return trust score data on success", async () => {
      const mockResponse = {
        decision: "proceed",
        recommended_timelock: 30,
        max_amount: 100,
        score: 0.85,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.trustGate({ address: "0x1234" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.address).toBe("0x1234");
      expect(parsed.decision).toBe("proceed");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/trust?address=0x1234"),
      );
    });

    it("should include intendedAmount in query params when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ decision: "caution" }),
      });

      await provider.trustGate({ address: "0x1234", intendedAmount: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("amount=50"),
      );
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.trustGate({ address: "0x1234" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP 500");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.trustGate({ address: "0x1234" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Network error");
    });
  });

  describe("safePay", () => {
    it("should execute a safe payment on success", async () => {
      const mockResponse = {
        status: "released",
        escrowId: "esc_123",
        txHash: "0xabc",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.safePay({
        url: "https://api.example.com/service",
        sellerAddress: "0x5678",
        amountUsdc: 10,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe("released");
      expect(parsed.escrowId).toBe("esc_123");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid seller address",
      });

      const result = await provider.safePay({
        url: "https://api.example.com/service",
        sellerAddress: "invalid",
        amountUsdc: 10,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Invalid seller address");
    });
  });

  describe("escrowCreate", () => {
    it("should create an escrow on success", async () => {
      const mockResponse = {
        escrowId: "esc_456",
        txHash: "0xdef",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.escrowCreate({
        seller: "0x5678",
        amountUsdc: 25,
        timelockMinutes: 120,
        serviceUrl: "https://api.example.com/data",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.escrowId).toBe("esc_456");
      expect(parsed.txHash).toBe("0xdef");

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.seller).toBe("0x5678");
      expect(fetchBody.amount_usdc).toBe(25);
      expect(fetchBody.timelock_minutes).toBe(120);
      expect(fetchBody.service_url).toBe("https://api.example.com/data");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      });

      const result = await provider.escrowCreate({
        seller: "0x5678",
        amountUsdc: 25,
        timelockMinutes: 60,
        serviceUrl: "https://api.example.com/data",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP 500");
    });
  });

  describe("rateService", () => {
    it("should submit a rating on success", async () => {
      const mockResponse = {
        rated: true,
        newScore: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.rateService({
        escrowId: "esc_123",
        stars: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rated).toBe(true);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.escrow_id).toBe("esc_123");
      expect(fetchBody.stars).toBe(5);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Escrow not found",
      });

      const result = await provider.rateService({
        escrowId: "esc_invalid",
        stars: 3,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Escrow not found");
    });
  });
});
