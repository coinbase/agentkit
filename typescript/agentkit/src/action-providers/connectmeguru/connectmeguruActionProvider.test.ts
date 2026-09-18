import {
  ConnectMeGuruActionProvider,
  connectmeguruActionProvider,
} from "./connectmeguruActionProvider";

describe("ConnectMeGuruActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = connectmeguruActionProvider({
    baseUrl: "https://www.connectmeguru.com/api",
    patToken: "test_pat_token",
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("searchEsimPlans", () => {
    it("should return plans when API call is successful", async () => {
      const mockResponse = {
        success: true,
        totalCount: 1,
        plans: [
          {
            packageCode: "P4XU0X3CX",
            name: "Japan 1GB 7Days",
            dataAmount: 1,
            duration: 7,
            retailPrice: 3.85,
          },
        ],
      };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.searchEsimPlans({ country: "Japan" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.plans[0].packageCode).toBe("P4XU0X3CX");
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await provider.searchEsimPlans({ country: "Japan" });
      expect(result).toContain("Error searching eSIM plans");
      expect(result).toContain("500");
    });

    it("should handle network failure", async () => {
      fetchMock.mockRejectedValue(new Error("Network connection dropped"));

      const result = await provider.searchEsimPlans({ country: "Japan" });
      expect(result).toContain("Error searching eSIM plans");
      expect(result).toContain("Network connection dropped");
    });
  });

  describe("purchaseEsim", () => {
    it("should return invoice when checkout is successful", async () => {
      const mockInvoice = {
        status: "PENDING_PAYMENT",
        invoiceId: "CMG-INV-TEST-001",
        plan: {
          packageCode: "P4XU0X3CX",
          name: "Japan 1GB 7Days",
        },
        payment: {
          currency: "USDT",
          network: "polygon",
          expectedAmount: 3.850012,
          receivingAddress: "0x1234567890123456789012345678901234567890",
        },
      };

      fetchMock.mockResolvedValue({
        status: 402,
        ok: false,
        json: jest.fn().mockResolvedValue(mockInvoice),
      });

      const result = await provider.purchaseEsim({
        packageCode: "P4XU0X3CX",
        customerEmail: "agent@example.com",
        network: "polygon",
        currency: "USDT",
      });

      const parsed = JSON.parse(result);
      expect(parsed.invoiceId).toBe("CMG-INV-TEST-001");
      expect(parsed.payment.expectedAmount).toBe(3.850012);
    });

    it("should handle purchase failure", async () => {
      fetchMock.mockResolvedValue({
        status: 400,
        ok: false,
        json: jest.fn().mockResolvedValue({ error: "Invalid package code" }),
      });

      const result = await provider.purchaseEsim({
        packageCode: "INVALID",
        customerEmail: "agent@example.com",
        network: "polygon",
        currency: "USDT",
      });

      expect(result).toContain("Error purchasing eSIM");
      expect(result).toContain("Invalid package code");
    });
  });

  describe("checkOrderStatus", () => {
    it("should return fulfilled eSIM details when completed", async () => {
      const mockOrder = {
        status: "COMPLETED",
        invoiceId: "CMG-INV-TEST-001",
        esim: {
          iccid: "8985200000000000001",
          lpaString: "LPA:1$smdp.io$MATCHING-ID",
          qrCodeUrl: "https://qr.connectmeguru.com/esim.png",
        },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOrder),
      });

      const result = await provider.checkOrderStatus({
        invoiceId: "CMG-INV-TEST-001",
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe("COMPLETED");
      expect(parsed.esim.iccid).toBe("8985200000000000001");
    });

    it("should handle order not found error", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: jest.fn().mockResolvedValue({ error: "Invoice not found" }),
      });

      const result = await provider.checkOrderStatus({
        invoiceId: "NON_EXISTENT",
      });

      expect(result).toContain("Error checking order status");
      expect(result).toContain("Invoice not found");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
