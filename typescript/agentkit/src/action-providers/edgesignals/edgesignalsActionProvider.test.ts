import { EdgeSignalsActionProvider, edgeSignalsActionProvider } from "./edgesignalsActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { SIGNALS_BASE_URL } from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetchWithPayment = jest.fn();

jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest.mocked(registerExactEvmScheme).mockImplementation(client => client);

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const MOCK_VERDICT = {
  product: "edge-signals-token-verdict",
  grade: "A",
  band: "SAFE",
  score: 92,
  reasons: ["Listed on a major DEX", "No honeypot flags"],
  disclaimer: "Not financial advice.",
  summary: "SAFE — grade A",
};

const makeMockWalletProvider = (network: Partial<Network> = {}) => {
  const mockProvider = Object.create(EvmWalletProvider.prototype);
  mockProvider.toSigner = jest.fn().mockReturnValue({ address: "0xabc" });
  mockProvider.readContract = jest.fn();
  mockProvider.getNetwork = jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId: "base-mainnet",
    chainId: "8453",
    ...network,
  });
  return mockProvider as EvmWalletProvider;
};

const createJsonResponse = (options: { status: number; data?: unknown; text?: string }): Response =>
  ({
    status: options.status,
    ok: options.status >= 200 && options.status < 300,
    json: jest.fn().mockResolvedValue(options.data),
    text: jest.fn().mockResolvedValue(options.text ?? JSON.stringify(options.data)),
  }) as unknown as Response;

describe("EdgeSignalsActionProvider", () => {
  let provider: EdgeSignalsActionProvider;
  let wallet: EvmWalletProvider;

  beforeEach(() => {
    provider = edgeSignalsActionProvider();
    wallet = makeMockWalletProvider();
    jest.clearAllMocks();
    jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
    jest.mocked(registerExactEvmScheme).mockImplementation(client => client);
  });

  describe("supportsNetwork", () => {
    it("should support Base mainnet by networkId", () => {
      const network: Network = { protocolFamily: "evm", networkId: "base-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should support Base mainnet by chainId", () => {
      const network: Network = { protocolFamily: "evm", chainId: "8453" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should not support Base Sepolia", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "base-sepolia",
        chainId: "84532",
      };
      expect(provider.supportsNetwork(network)).toBe(false);
    });

    it("should not support Ethereum mainnet", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
        chainId: "1",
      };
      expect(provider.supportsNetwork(network)).toBe(false);
    });

    it("should not support Solana", () => {
      const network: Network = { protocolFamily: "svm", networkId: "solana-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("getTokenVerdict", () => {
    it("should fetch and format a Token Verdict, paying via x402", async () => {
      mockFetchWithPayment.mockResolvedValue(
        createJsonResponse({ status: 200, data: MOCK_VERDICT }),
      );

      const result = await provider.getTokenVerdict(wallet, { token: USDC_BASE, chain: "base" });

      expect(wrapFetchWithPayment).toHaveBeenCalled();
      expect(registerExactEvmScheme).toHaveBeenCalled();
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        `${SIGNALS_BASE_URL}/v1/token-verdict?token=${USDC_BASE}&chain=base`,
        { method: "GET" },
      );
      expect(result).toContain("Token Verdict for");
      expect(result).toContain(USDC_BASE);
      expect(result).toContain("Grade: A");
      expect(result).toContain("Band: SAFE");
      expect(result).toContain("Score: 92/100");
      expect(result).toContain("Listed on a major DEX");
      expect(result).toContain("0.01 USDC");
      expect(result).toContain("Not financial advice.");
    });

    it("should default chain to base when omitted", async () => {
      mockFetchWithPayment.mockResolvedValue(
        createJsonResponse({ status: 200, data: MOCK_VERDICT }),
      );

      await provider.getTokenVerdict(wallet, { token: USDC_BASE, chain: "base" });

      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        expect.stringContaining("chain=base"),
        expect.anything(),
      );
    });

    it("should return an HTTP error message when the request fails", async () => {
      mockFetchWithPayment.mockResolvedValue(
        createJsonResponse({ status: 402, text: "Payment Required" }),
      );

      const result = await provider.getTokenVerdict(wallet, { token: USDC_BASE, chain: "base" });

      expect(result).toContain("Error fetching Token Verdict");
      expect(result).toContain("HTTP 402");
      expect(result).toContain("Payment Required");
    });

    it("should return a parse error when the response is not JSON", async () => {
      mockFetchWithPayment.mockResolvedValue({
        status: 200,
        ok: true,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        text: jest.fn().mockResolvedValue("not-json"),
      } as unknown as Response);

      const result = await provider.getTokenVerdict(wallet, { token: USDC_BASE, chain: "base" });

      expect(result).toContain("Failed to parse API response");
      expect(result).toContain("Invalid JSON");
    });

    it("should return a network error message when fetch throws", async () => {
      mockFetchWithPayment.mockRejectedValue(new Error("Network error"));

      const result = await provider.getTokenVerdict(wallet, { token: USDC_BASE, chain: "base" });

      expect(result).toContain("Error fetching Token Verdict");
      expect(result).toContain("Network error");
    });
  });
});
