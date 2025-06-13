import { X402ActionProvider } from "./x402ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { AxiosError, AxiosResponse, AxiosRequestConfig, AxiosInstance } from "axios";
import axios from "axios";
import * as x402axios from "x402-axios";

// Mock modules
jest.mock("axios");
jest.mock("x402-axios");

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

// Override the mocked modules
(axios as jest.Mocked<typeof axios>).create = mockAxios.create;
(axios as jest.Mocked<typeof axios>).request = mockRequest;
(axios as jest.Mocked<typeof axios>).isAxiosError = mockAxios.isAxiosError;

// Mock x402-axios functions
jest.mocked(x402axios.withPaymentInterceptor).mockImplementation(mockWithPaymentInterceptor);
jest.mocked(x402axios.decodeXPaymentResponse).mockImplementation(mockDecodeXPaymentResponse);

// Mock wallet provider
const mockWalletProvider = {
  toSigner: jest.fn().mockReturnValue("mock-signer"),
} as unknown as EvmWalletProvider;

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

const MOCK_PAID_REQUEST_RESPONSE = {
  success: true,
  url: "https://www.x402.org/protected",
  method: "GET",
  status: 200,
  data: "<!DOCTYPE html><html>...</html>",
  paymentResponse: MOCK_PAYMENT_RESPONSE,
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

  describe("fetchPaymentInfo", () => {
    it("should successfully fetch payment info for 402 response", async () => {
      mockRequest.mockResolvedValue({
        status: 402,
        statusText: "Payment Required",
        data: MOCK_PAYMENT_INFO_RESPONSE.data,
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      expect(mockRequest).toHaveBeenCalledWith({
        url: "https://www.x402.org/protected",
        method: "GET",
        headers: undefined,
        validateStatus: expect.any(Function),
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentRequired).toBe(true);
      expect(parsedResult.status).toBe(402);
      expect(parsedResult.data).toEqual(MOCK_PAYMENT_INFO_RESPONSE.data);
    });

    it("should handle non-payment-protected endpoints", async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: { message: "No payment required" },
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://api.example.com/free",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentRequired).toBe(false);
      expect(parsedResult.status).toBe(200);
      expect(parsedResult.data).toEqual({ message: "No payment required" });
    });

    it("should handle 402 errors with payment details in headers", async () => {
      mockDecodeXPaymentResponse.mockReturnValue(MOCK_PAYMENT_RESPONSE);

      const error = new Error("Payment required") as AxiosError;
      error.isAxiosError = true;
      error.response = {
        status: 402,
        statusText: "Payment Required",
        headers: {
          "x-payment-response": "encoded-payment-data",
        },
        data: MOCK_PAYMENT_INFO_RESPONSE.data,
        config: {} as AxiosRequestConfig,
      } as AxiosResponse;

      mockRequest.mockRejectedValue(error);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      expect(mockDecodeXPaymentResponse).toHaveBeenCalledWith("encoded-payment-data");

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentRequired).toBe(true);
      expect(parsedResult.status).toBe(402);
      expect(parsedResult.paymentDetails).toEqual(MOCK_PAYMENT_RESPONSE);
    });

    it("should fallback to JSON.parse when decodeXPaymentResponse fails", async () => {
      const paymentDetailsJson = '{"amount": "10000"}';
      mockDecodeXPaymentResponse.mockImplementation(() => {
        throw new Error("Decode failed");
      });

      const error = new Error("Payment required") as AxiosError;
      error.isAxiosError = true;
      error.response = {
        status: 402,
        statusText: "Payment Required",
        headers: {
          "x-payment-response": paymentDetailsJson,
        },
        data: MOCK_PAYMENT_INFO_RESPONSE.data,
        config: {} as AxiosRequestConfig,
      } as AxiosResponse;

      mockRequest.mockRejectedValue(error);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentDetails).toEqual({ amount: "10000" });
    });

    it("should handle payment header parsing failures", async () => {
      mockDecodeXPaymentResponse.mockImplementation(() => {
        throw new Error("Decode failed");
      });

      const error = new Error("Payment required") as AxiosError;
      error.isAxiosError = true;
      error.response = {
        status: 402,
        statusText: "Payment Required",
        headers: {
          "x-payment-response": "invalid-json",
        },
        data: MOCK_PAYMENT_INFO_RESPONSE.data,
        config: {} as AxiosRequestConfig,
      } as AxiosResponse;

      mockRequest.mockRejectedValue(error);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentDetails.error).toBe("Failed to decode payment response");
      expect(parsedResult.paymentDetails.rawHeader).toBe("invalid-json");
    });

    it("should handle non-402 HTTP errors", async () => {
      const error = new Error("Server error") as AxiosError;
      error.isAxiosError = true;
      error.response = {
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        data: { error: "Internal server error" },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse;

      mockRequest.mockRejectedValue(error);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      expect(result).toContain("Error fetching payment info");
      expect(result).toContain("HTTP 500");
      expect(result).toContain("Internal server error");
    });

    it("should handle network errors", async () => {
      const error = new Error("Network error") as AxiosError;
      error.isAxiosError = true;
      error.request = {};

      mockRequest.mockRejectedValue(error);

      const result = await provider.fetchPaymentInfo(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      expect(result).toContain("Error fetching payment info");
      expect(result).toContain("Network error");
    });
  });

  describe("paidRequest", () => {
    it("should successfully make a paid request with payment response", async () => {
      mockDecodeXPaymentResponse.mockReturnValue(MOCK_PAYMENT_RESPONSE);

      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: MOCK_PAID_REQUEST_RESPONSE.data,
        headers: {
          "x-payment-response": "encoded-payment-response",
        },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      expect(mockWithPaymentInterceptor).toHaveBeenCalledWith(mockAxiosInstance, "mock-signer");

      expect(mockRequest).toHaveBeenCalledWith({
        url: "https://www.x402.org/protected",
        method: "GET",
        headers: undefined,
        data: undefined,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.status).toBe(200);
      expect(parsedResult.paymentResponse).toEqual(MOCK_PAYMENT_RESPONSE);
    });

    it("should handle successful request without payment", async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: { message: "Success" },
        headers: {},
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://api.example.com/free",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.status).toBe(200);
      expect(parsedResult.paymentResponse).toBe(null);
    });

    it("should fallback to JSON.parse when decodeXPaymentResponse fails", async () => {
      const paymentResponseJson = '{"transaction": "0x123"}';

      mockDecodeXPaymentResponse.mockImplementation(() => {
        throw new Error("Decode failed");
      });

      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: "Success",
        headers: {
          "x-payment-response": paymentResponseJson,
        },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentResponse).toEqual({ transaction: "0x123" });
    });

    it("should handle payment response parsing failures", async () => {
      mockDecodeXPaymentResponse.mockImplementation(() => {
        throw new Error("Decode failed");
      });

      mockRequest.mockResolvedValue({
        status: 200,
        statusText: "OK",
        data: "Success",
        headers: {
          "x-payment-response": "invalid-json",
        },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.paymentResponse.error).toBe("Failed to decode payment response");
      expect(parsedResult.paymentResponse.rawHeader).toBe("invalid-json");
    });

    it("should handle HTTP errors", async () => {
      const error = new Error("Bad request") as AxiosError;
      error.isAxiosError = true;
      error.response = {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        data: { error: "Invalid parameters" },
        config: {} as AxiosRequestConfig,
      } as AxiosResponse;

      mockRequest.mockRejectedValue(error);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "POST",
        body: { test: "data" },
      });

      expect(result).toContain("Error making paid request");
      expect(result).toContain("HTTP 400");
      expect(result).toContain("Invalid parameters");
    });

    it("should handle network errors", async () => {
      const error = new Error("Connection timeout") as AxiosError;
      error.isAxiosError = true;
      error.request = {};

      mockRequest.mockRejectedValue(error);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      expect(result).toContain("Error making paid request");
      expect(result).toContain("Network error");
      expect(result).toContain("Connection timeout");
    });

    it("should handle generic errors", async () => {
      const error = new Error("Something went wrong");

      mockRequest.mockRejectedValue(error);

      const result = await provider.paidRequest(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      expect(result).toContain("Error making paid request");
      expect(result).toContain("Something went wrong");
    });

    it("should pass through all request parameters", async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        data: "Success",
        headers: {},
      } as AxiosResponse);

      await provider.paidRequest(mockWalletProvider, {
        url: "https://api.example.com/endpoint",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { key: "value" },
      });

      expect(mockRequest).toHaveBeenCalledWith({
        url: "https://api.example.com/endpoint",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { key: "value" },
      });
    });
  });
});
