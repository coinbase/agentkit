import { X402ActionProvider } from "./x402ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";

import * as utils from "./utils";
import { resolveFacilitatorUrl } from "./schemas";

// Mock external modules
jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");
jest.mock("./utils");
jest.mock("./schemas", () => ({
  ...jest.requireActual("./schemas"),
  resolveFacilitatorUrl: jest.fn(),
}));

// Create mock functions
const mockFetch = jest.fn();
const mockFetchWithPayment = jest.fn();

// Mock x402 client
const mockX402Client = {
  registerScheme: jest.fn(),
};

// Mock utils functions
const mockGetX402Networks = jest.fn();
const mockHandleHttpError = jest.fn();
const mockFormatPaymentOption = jest.fn();
const mockFetchAllDiscoveryResources = jest.fn();
const mockFilterByNetwork = jest.fn();
const mockFilterByDescription = jest.fn();
const mockFilterByX402Version = jest.fn();
const mockFilterByKeyword = jest.fn();
const mockFilterByMaxPrice = jest.fn();
const mockFormatSimplifiedResources = jest.fn();
const mockBuildUrlWithParams = jest.fn();
const mockResolveFacilitatorUrl = jest.fn();

// Setup mocks
jest
  .mocked(x402Client)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest
  .mocked(registerExactSvmScheme)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);

jest.mocked(utils.getX402Networks).mockImplementation(mockGetX402Networks);
jest.mocked(utils.handleHttpError).mockImplementation(mockHandleHttpError);
jest.mocked(utils.formatPaymentOption).mockImplementation(mockFormatPaymentOption);
jest.mocked(utils.fetchAllDiscoveryResources).mockImplementation(mockFetchAllDiscoveryResources);
jest.mocked(utils.filterByNetwork).mockImplementation(mockFilterByNetwork);
jest.mocked(utils.filterByDescription).mockImplementation(mockFilterByDescription);
jest.mocked(utils.filterByX402Version).mockImplementation(mockFilterByX402Version);
jest.mocked(utils.filterByKeyword).mockImplementation(mockFilterByKeyword);
jest.mocked(utils.filterByMaxPrice).mockImplementation(mockFilterByMaxPrice);
jest.mocked(utils.formatSimplifiedResources).mockImplementation(mockFormatSimplifiedResources);
jest.mocked(utils.buildUrlWithParams).mockImplementation(mockBuildUrlWithParams);
jest.mocked(resolveFacilitatorUrl).mockImplementation(mockResolveFacilitatorUrl);

// Mock global fetch
global.fetch = mockFetch;

// Mock wallet provider
const makeMockWalletProvider = (networkId: string) => {
  const mockProvider = Object.create(EvmWalletProvider.prototype);
  mockProvider.toSigner = jest.fn().mockReturnValue("mock-signer");
  mockProvider.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId });
  return mockProvider as EvmWalletProvider;
};

// Sample responses based on real examples
const MOCK_PAYMENT_INFO_RESPONSE = {
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
};

const MOCK_PAYMENT_PROOF = {
  transaction: "0xcbc385789d3744b52af5106c32809534f64adcbe097e050ec03d6b53fed5d305",
  network: "base-sepolia",
  payer: "0xa8c1a5D3C372C65c04f91f87a43F549619A9483f",
};

// Helper to create mock Response
const createMockResponse = (options: {
  status: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
}): Response => {
  const headersMap = new Map(Object.entries(options.headers ?? {}));
  return {
    status: options.status,
    statusText: options.statusText ?? "OK",
    ok: options.status >= 200 && options.status < 300,
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    },
    json: jest.fn().mockResolvedValue(options.data),
    text: jest.fn().mockResolvedValue(JSON.stringify(options.data)),
  } as unknown as Response;
};

describe("X402ActionProvider", () => {
  let provider: X402ActionProvider;

  beforeEach(() => {
    provider = new X402ActionProvider();
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockGetX402Networks.mockImplementation(network => [network.networkId]);
    mockBuildUrlWithParams.mockImplementation(url => url);
    mockHandleHttpError.mockImplementation((error, url) => {
      return JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : "Network error",
        url: url,
      });
    });
    mockFormatPaymentOption.mockResolvedValue("mocked payment option");
    mockResolveFacilitatorUrl.mockReturnValue("https://api.cdp.coinbase.com/platform/v2/x402");
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

    it("should support SVM networks", () => {
      const network: Network = { protocolFamily: "svm", networkId: "solana-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should not support non-EVM/SVM networks", () => {
      const network: Network = { protocolFamily: "bitcoin", networkId: "mainnet" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("makeHttpRequest", () => {
    it("should handle successful non-payment requests", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { message: "Success" },
          headers: { "content-type": "application/json" },
        }),
      );

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
      mockGetX402Networks.mockReturnValue(["base-sepolia"]);
      mockFormatPaymentOption.mockResolvedValue("10000 USDC on base-sepolia network");

      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: MOCK_PAYMENT_INFO_RESPONSE,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await provider.makeHttpRequest(makeMockWalletProvider("base-sepolia"), {
        url: "https://www.x402.org/protected",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("error_402_payment_required");
      expect(parsedResult.acceptablePaymentOptions).toEqual(MOCK_PAYMENT_INFO_RESPONSE.accepts);
      expect(parsedResult.nextSteps).toBeDefined();
    });

    it("should handle network errors", async () => {
      const error = new TypeError("fetch failed");
      mockFetch.mockRejectedValue(error);

      const result = await provider.makeHttpRequest(makeMockWalletProvider("base-sepolia"), {
        url: "https://api.example.com/endpoint",
        method: "GET",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe(true);
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("discoverX402Services", () => {
    it("should list services without filters", async () => {
      const mockResources = [
        {
          resource: "https://example.com/service1",
          x402Version: 1,
          accepts: [
            {
              asset: "0xUSDC",
              maxAmountRequired: "90000",
              network: "base-sepolia",
              scheme: "exact",
              description: "Test service 1",
            },
          ],
        },
      ];

      const mockSimplified = [
        {
          url: "https://example.com/service1",
          price: "0.09 USDC on base-sepolia",
          description: "Test service 1",
        },
      ];

      mockFetchAllDiscoveryResources.mockResolvedValue(mockResources);
      mockFilterByNetwork.mockReturnValue(mockResources);
      mockFilterByDescription.mockReturnValue(mockResources);
      mockFilterByX402Version.mockReturnValue(mockResources);
      mockFormatSimplifiedResources.mockResolvedValue(mockSimplified);
      mockGetX402Networks.mockReturnValue(["base-sepolia"]);

      const result = await provider.discoverX402Services(makeMockWalletProvider("base-sepolia"), {
        facilitator: "cdp",
        x402Versions: [1, 2],
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(1);
      expect(parsed.returned).toBe(1);
      expect(parsed.services.length).toBe(1);
    });

    it("should filter services by maxPrice", async () => {
      const mockResources = [
        {
          resource: "https://example.com/service1",
          x402Version: 1,
          accepts: [
            {
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              maxAmountRequired: "90000",
              network: "base-sepolia",
              scheme: "exact",
              description: "Test service 1",
            },
          ],
        },
        {
          resource: "https://example.com/service2",
          x402Version: 1,
          accepts: [
            {
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              maxAmountRequired: "150000",
              network: "base-sepolia",
              scheme: "exact",
              description: "Test service 2",
            },
          ],
        },
      ];

      const filteredResources = [mockResources[0]];
      const mockSimplified = [
        {
          url: "https://example.com/service1",
          price: "0.09 USDC on base-sepolia",
          description: "Test service 1",
        },
      ];

      mockFetchAllDiscoveryResources.mockResolvedValue(mockResources);
      mockFilterByNetwork.mockReturnValue(mockResources);
      mockFilterByDescription.mockReturnValue(mockResources);
      mockFilterByX402Version.mockReturnValue(mockResources);
      mockFilterByMaxPrice.mockResolvedValue(filteredResources);
      mockFormatSimplifiedResources.mockResolvedValue(mockSimplified);
      mockGetX402Networks.mockReturnValue(["base-sepolia"]);

      const result = await provider.discoverX402Services(makeMockWalletProvider("base-sepolia"), {
        facilitator: "cdp",
        maxUsdcPrice: 0.1,
        x402Versions: [1, 2],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.returned).toBe(1);
      expect(parsed.services[0].url).toBe("https://example.com/service1");
    });

    it("should handle errors from discovery", async () => {
      mockFetchAllDiscoveryResources.mockRejectedValue(new Error("boom"));

      const result = await provider.discoverX402Services(makeMockWalletProvider("base-sepolia"), {
        facilitator: "cdp",
        x402Versions: [1, 2],
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("Failed to list x402 services");
    });
  });

  describe("retryWithX402", () => {
    it("should successfully retry with payment", async () => {
      mockGetX402Networks.mockReturnValue(["base-sepolia"]);

      // Encode the payment proof as base64
      const encodedPaymentProof = btoa(JSON.stringify(MOCK_PAYMENT_PROOF));

      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { message: "Paid content" },
          headers: {
            "content-type": "application/json",
            "x-payment-response": encodedPaymentProof,
          },
        }),
      );

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

      expect(wrapFetchWithPayment).toHaveBeenCalledWith(fetch, mockX402Client);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.details.paymentProof).toEqual(MOCK_PAYMENT_PROOF);
    });

    it("should handle network errors during payment", async () => {
      const error = new TypeError("fetch failed");
      mockGetX402Networks.mockReturnValue(["base-sepolia"]);
      mockFetchWithPayment.mockRejectedValue(error);

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
    });
  });

  describe("makeHttpRequestWithX402", () => {
    it("should handle successful direct payment requests", async () => {
      // Encode the payment proof as base64
      const encodedPaymentProof = btoa(JSON.stringify(MOCK_PAYMENT_PROOF));

      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { message: "Paid content" },
          headers: {
            "content-type": "application/json",
            "x-payment-response": encodedPaymentProof,
          },
        }),
      );

      const result = await provider.makeHttpRequestWithX402(
        makeMockWalletProvider("base-sepolia"),
        {
          url: "https://www.x402.org/protected",
          method: "GET",
        },
      );

      expect(wrapFetchWithPayment).toHaveBeenCalledWith(fetch, mockX402Client);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual({ message: "Paid content" });
      expect(parsedResult.paymentProof).toEqual(MOCK_PAYMENT_PROOF);
    });

    it("should handle successful non-payment requests", async () => {
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { message: "Free content" },
          headers: { "content-type": "application/json" },
        }),
      );

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
      const error = new TypeError("fetch failed");
      mockFetchWithPayment.mockRejectedValue(error);

      const result = await provider.makeHttpRequestWithX402(
        makeMockWalletProvider("base-sepolia"),
        {
          url: "https://api.example.com/endpoint",
          method: "GET",
        },
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe(true);
    });
  });
});
