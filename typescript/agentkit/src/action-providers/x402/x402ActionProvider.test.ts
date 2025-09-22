import { X402ActionProvider } from "./x402ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { AxiosError, AxiosResponse, AxiosRequestConfig, AxiosInstance } from "axios";
import axios from "axios";
import * as x402axios from "x402-axios";
import * as x402Verify from "x402/verify";

// Mock external facilitator dependency
jest.mock("@coinbase/x402", () => ({
  facilitator: {},
}));

// Mock modules
jest.mock("axios");
jest.mock("x402-axios");
jest.mock("x402/verify");

// Create mock functions
const mockRequest = jest.fn();

// Create a complete mock axios instance
const mockAxiosInstance = {
  request: mockRequest,
  get: jest.fn(),
  delete: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  getUri: jest.fn(),
  defaults: {},
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
  },
} as unknown as AxiosInstance;

// Create a complete mock axios static
const mockAxios = {
  create: jest.fn().mockReturnValue(mockAxiosInstance),
  request: mockRequest,
  get: jest.fn(),
  delete: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  all: jest.fn(),
  spread: jest.fn(),
  isAxiosError: jest.fn(),
  isCancel: jest.fn(),
  CancelToken: {
    source: jest.fn(),
  },
  VERSION: "1.x",
} as unknown as jest.Mocked<typeof axios>;

const mockWithPaymentInterceptor = jest.fn().mockReturnValue(mockAxiosInstance);
const mockDecodeXPaymentResponse = jest.fn();
const mockUseFacilitator = jest.fn();

// Override the mocked modules
(axios as jest.Mocked<typeof axios>).create = mockAxios.create;
(axios as jest.Mocked<typeof axios>).request = mockRequest;
(axios as jest.Mocked<typeof axios>).isAxiosError = mockAxios.isAxiosError;

// Mock x402-axios functions
jest.mocked(x402axios.withPaymentInterceptor).mockImplementation(mockWithPaymentInterceptor);
jest.mocked(x402axios.decodeXPaymentResponse).mockImplementation(mockDecodeXPaymentResponse);
jest.mocked(x402Verify.useFacilitator).mockImplementation(mockUseFacilitator);

// Mock wallet provider
const makeMockWalletProvider = (networkId: string) =>
  ({
    toSigner: jest.fn().mockReturnValue("mock-signer"),
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId }),
  }) as unknown as EvmWalletProvider;

// Sample responses based on real examples
const MOCK_PAYMENT_INFO_RESPONSE = {
  paymentRequired: true,
  url: "https://www.x402.org/protected",
  status: 402,
  data: {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [
      {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        resource: "https://www.x402.org/protected",
        description: "Access to protected content",
        mimeType: "application/json",
        payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
        maxTimeoutSeconds: 300,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: {
          name: "USDC",
          version: "2",
        },
      },
    ],
  },
};

const MOCK_PAYMENT_RESPONSE = {
  success: true,
  transaction:
    "0xcbc385789d3744b52af5106c32809534f64adcbe097e050ec03d6b53fed5d305" as `0x${string}`,
  network: "base-sepolia" as const,
  payer: "0xa8c1a5D3C372C65c04f91f87a43F549619A9483f" as `0x${string}`,
};

describe("X402ActionProvider", () => {
  let provider: X402ActionProvider;

  beforeEach(() => {
    provider = new X402ActionProvider();
    jest.clearAllMocks();

    // Setup mocks
    mockAxios.create.mockReturnValue(mockAxiosInstance);
    mockWithPaymentInterceptor.mockReturnValue(mockAxiosInstance);

    // Setup axios.isAxiosError mock
    jest
      .mocked(axios.isAxiosError)
      .mockImplementation((error: unknown): boolean =>
        Boolean(
          error &&
            typeof error === "object" &&
            ("isAxiosError" in error || "response" in error || "request" in error),
        ),
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      const network: Network = { protocolFamily: "evm", networkId: "base-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should support base-sepolia", () => {
      const network: Network = { protocolFamily: "evm", networkId: "base-sepolia" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should not support unsupported EVM networks", () => {
      const network: Network = { protocolFamily: "evm", networkId: "ethereum" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });

    it("should not support non-EVM networks", () => {
      const network: Network = { protocolFamily: "solana", networkId: "mainnet" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("makeHttpRequest", () => {
    it("should handle successful non-payment requests", async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        data: { message: "Success" },
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.makeHttpRequest(makeMockWalletProvider("base-sepolia"), {
        url: "https://api.example.com/free",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.status).toBe(200);
      expect(parsedResult.data).toEqual({ message: "Success" });
    });

    it("should handle 402 responses with payment options", async () => {
      mockRequest.mockResolvedValue({
        status: 402,
        data: MOCK_PAYMENT_INFO_RESPONSE.data,
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.makeHttpRequest(makeMockWalletProvider("base-sepolia"), {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("error_402_payment_required");
      expect(parsedResult.acceptablePaymentOptions).toEqual(
        MOCK_PAYMENT_INFO_RESPONSE.data.accepts,
      );
      expect(parsedResult.nextSteps).toBeDefined();
    });

    it("should handle network errors", async () => {
      const error = new Error("Network error") as AxiosError;
      error.isAxiosError = true;
      error.request = {};

      mockRequest.mockRejectedValue(error);

      const result = await provider.makeHttpRequest(makeMockWalletProvider("base-sepolia"), {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe(true);
      expect(parsedResult.message).toContain("Network error");
    });
  });

  describe("listX402Services", () => {
    it("should list services without filters", async () => {
      const mockList = jest.fn().mockResolvedValue({
        items: [
          {
            resource: "https://example.com/service1",
            metadata: { category: "test" },
            accepts: [
              {
                asset: "0xUSDC",
                maxAmountRequired: "90000",
                network: "base-sepolia",
                scheme: "exact",
                description: "Test service 1",
                outputSchema: { type: "object" },
                extra: { name: "USDC" },
              },
            ],
          },
        ],
      });

      mockUseFacilitator.mockReturnValue({ list: mockList });

      const result = await provider.discoverX402Services(
        makeMockWalletProvider("base-sepolia"),
        {},
      );
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(1);
      expect(parsed.returned).toBe(1);
      expect(parsed.items.length).toBe(1);
    });

    it("should filter services by asset and maxPrice", async () => {
      const mockList = jest.fn().mockResolvedValue({
        items: [
          {
            resource: "https://example.com/service1",
            metadata: { category: "test" },
            accepts: [
              {
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Real USDC address for base-sepolia
                maxAmountRequired: "90000", // 0.09 USDC (should pass 0.1 filter)
                network: "base-sepolia",
                scheme: "exact",
                description: "Test service 1",
                outputSchema: { type: "object" },
                extra: { name: "USDC" },
              },
            ],
          },
          {
            resource: "https://example.com/service2",
            metadata: { category: "test" },
            accepts: [
              {
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Real USDC address for base-sepolia
                maxAmountRequired: "150000", // 0.15 USDC (should fail 0.1 filter)
                network: "base-sepolia",
                scheme: "exact",
                description: "Test service 2",
                outputSchema: { type: "object" },
                extra: { name: "USDC" },
              },
            ],
          },
          {
            resource: "https://example.com/service3",
            metadata: { category: "test" },
            accepts: [
              {
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Real USDC address for base-sepolia
                maxAmountRequired: "50000", // 0.05 USDC (should pass 0.1 filter)
                network: "base-sepolia",
                scheme: "exact",
                description: "Test service 3",
                outputSchema: { type: "object" },
                extra: { name: "USDC" },
              },
            ],
          },
        ],
      });

      mockUseFacilitator.mockReturnValue({ list: mockList });

      const result = await provider.discoverX402Services(makeMockWalletProvider("base-sepolia"), {
        maxUsdcPrice: 0.1,
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.returned).toBe(2);
      expect(parsed.items.map(item => item.resource)).toEqual(
        expect.arrayContaining(["https://example.com/service1", "https://example.com/service3"]),
      );
    });

    it("should handle errors from facilitator", async () => {
      const mockList = jest.fn().mockRejectedValue(new Error("boom"));
      mockUseFacilitator.mockReturnValue({ list: mockList });

      const result = await provider.discoverX402Services(
        makeMockWalletProvider("base-sepolia"),
        {},
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("Failed to list x402 services");
    });
  });

  describe("retryHttpRequestWithX402", () => {
    it("should successfully retry with payment", async () => {
      mockDecodeXPaymentResponse.mockReturnValue(MOCK_PAYMENT_RESPONSE);

      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: { message: "Paid content" },
        headers: {
          "x-payment-response": "encoded-payment-data",
        },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.retryWithX402(makeMockWalletProvider("base-sepolia"), {
        url: "https://www.x402.org/protected",
        method: "GET",
        selectedPaymentOption: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "10000",
          asset: "0x456",
        },
      });

      // Update expectation to accept the payment selector function
      expect(mockWithPaymentInterceptor).toHaveBeenCalledWith(
        mockAxiosInstance,
        "mock-signer",
        expect.any(Function),
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.details.paymentProof).toEqual({
        transaction: MOCK_PAYMENT_RESPONSE.transaction,
        network: MOCK_PAYMENT_RESPONSE.network,
        payer: MOCK_PAYMENT_RESPONSE.payer,
      });
    });

    it("should handle network errors during payment", async () => {
      const error = new Error("Network error") as AxiosError;
      error.isAxiosError = true;
      error.request = {};

      mockRequest.mockRejectedValue(error);

      const result = await provider.retryWithX402(makeMockWalletProvider("base-sepolia"), {
        url: "https://www.x402.org/protected",
        method: "GET",
        selectedPaymentOption: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "10000",
          asset: "0x456",
        },
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe(true);
      expect(parsedResult.message).toContain("Network error");
    });
  });

  describe("makeHttpRequestWithX402", () => {
    it("should handle successful direct payment requests", async () => {
      mockDecodeXPaymentResponse.mockReturnValue(MOCK_PAYMENT_RESPONSE);

      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: { message: "Paid content" },
        headers: {
          "x-payment-response": "encoded-payment-data",
        },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.makeHttpRequestWithX402(
        makeMockWalletProvider("base-sepolia"),
        {
          url: "https://www.x402.org/protected",
          method: "GET",
        },
      );

      expect(mockWithPaymentInterceptor).toHaveBeenCalledWith(mockAxiosInstance, "mock-signer");

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual({ message: "Paid content" });
      expect(parsedResult.paymentProof).toEqual({
        transaction: MOCK_PAYMENT_RESPONSE.transaction,
        network: MOCK_PAYMENT_RESPONSE.network,
        payer: MOCK_PAYMENT_RESPONSE.payer,
      });
    });

    it("should handle successful non-payment requests", async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: { message: "Free content" },
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.makeHttpRequestWithX402(
        makeMockWalletProvider("base-sepolia"),
        {
          url: "https://api.example.com/free",
          method: "GET",
        },
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual({ message: "Free content" });
      expect(parsedResult.paymentProof).toBeNull();
    });

    it("should handle network errors", async () => {
      const error = new Error("Network error") as AxiosError;
      error.isAxiosError = true;
      error.request = {};

      mockRequest.mockRejectedValue(error);

      const result = await provider.makeHttpRequestWithX402(
        makeMockWalletProvider("base-sepolia"),
        {
          url: "https://api.example.com/endpoint",
          method: "GET",
        },
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe(true);
      expect(parsedResult.message).toContain("Network error");
    });
  });
});
