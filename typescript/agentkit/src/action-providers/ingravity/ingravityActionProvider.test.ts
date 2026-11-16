/**
 * @file ingravityActionProvider.test.ts
 * @description Comprehensive unit tests for Ingravity Security Action Provider in Coinbase AgentKit.
 */

import {
  IngravityActionProvider,
  ingravityActionProvider,
  encodeErc8021Calldata,
} from "./ingravityActionProvider";
import {
  INGRAVITY_WORKER_URL,
  INGRAVITY_PAY_TO_WALLET,
  BASE_USDC_CONTRACT,
  ERC8021_BUILDER_CODE,
  ERC8021_SUFFIX_HEX,
} from "./constants";
import {
  FastPingSchema,
  TxFirewallSchema,
  TokenRugScannerSchema,
  DefiMathGuardSchema,
  AuditSoliditySchema,
  ProtocolDossierSchema,
  DeepExploitBountySchema,
} from "./schemas";

describe("IngravityActionProvider", () => {
  const MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  let mockWalletProvider: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockWalletProvider = {
      getAddress: jest.fn().mockResolvedValue(MOCK_WALLET_ADDRESS),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe("Constructor & Network Support", () => {
    it("should instantiate with default configuration", () => {
      const provider = ingravityActionProvider();
      expect(provider).toBeInstanceOf(IngravityActionProvider);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as any)).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as any)).toBe(false);
    });

    it("should allow custom workerUrl and payToWallet", () => {
      const customUrl = "https://custom-gateway.workers.dev";
      const customWallet = "0x000000000000000000000000000000000000dEaD";
      const provider = new IngravityActionProvider({
        workerUrl: customUrl,
        payToWallet: customWallet,
      });
      expect(provider).toBeDefined();
    });
  });

  describe("ERC-8021 Builder Code Attribution", () => {
    it("should append ERC-8021 suffix to calldata correctly", () => {
      const baseCalldata = "0xa9059cbb000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000f4240";
      const taggedCalldata = encodeErc8021Calldata(baseCalldata);
      expect(taggedCalldata.endsWith(ERC8021_SUFFIX_HEX.toLowerCase())).toBe(true);
    });

    it("should not double-append if suffix is already present", () => {
      const baseCalldata = "0x1234" + ERC8021_SUFFIX_HEX;
      const result = encodeErc8021Calldata(baseCalldata);
      expect(result).toBe("0x1234" + ERC8021_SUFFIX_HEX.toLowerCase());
    });

    it("should throw on invalid hex string", () => {
      expect(() => encodeErc8021Calldata("not-hex")).toThrow();
    });
  });

  describe("Zod Schemas Validation", () => {
    it("should validate FastPingSchema correctly", () => {
      const valid = FastPingSchema.parse({
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        chainId: 8453,
      });
      expect(valid.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(valid.chainId).toBe(8453);

      expect(() => FastPingSchema.parse({ address: "invalid-address" })).toThrow();
    });

    it("should validate TxFirewallSchema with default values", () => {
      const parsed = TxFirewallSchema.parse({
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });
      expect(parsed.data).toBe("0x");
      expect(parsed.value).toBe("0");
      expect(parsed.chainId).toBe(8453);
    });

    it("should validate TokenRugScannerSchema tiers", () => {
      const parsed = TokenRugScannerSchema.parse({
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        tier: "ESSENTIAL",
      });
      expect(parsed.tier).toBe("ESSENTIAL");
    });
  });

  describe("Fast-Ping Execution ($0.01 USDC x402 Flow)", () => {
    it("should handle 402 challenge, settle payment on Base, and return SAFE verdict", async () => {
      const provider = new IngravityActionProvider({
        workerUrl: INGRAVITY_WORKER_URL,
        payToWallet: INGRAVITY_PAY_TO_WALLET,
      });

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async (url: string, init: any) => {
        callCount++;
        if (callCount === 1) {
          // 1st call: returns HTTP 402 Payment Required
          return {
            ok: false,
            status: 402,
            headers: new Headers({
              "WWW-Authenticate": `x402 amount="0.01", payTo="${INGRAVITY_PAY_TO_WALLET}", asset="${BASE_USDC_CONTRACT}", network="eip155:8453"`,
            }),
            json: async () => ({
              error: "Payment Required",
              amount: "0.01",
              payTo: INGRAVITY_PAY_TO_WALLET,
              asset: BASE_USDC_CONTRACT,
              network: "eip155:8453",
            }),
            text: async () => "Payment Required",
          };
        } else {
          // 2nd call: returns HTTP 200 OK with safe verdict
          expect(init.headers["Authorization"]).toContain("x402");
          return {
            ok: true,
            status: 200,
            headers: new Headers({
              "X-Ingravity-Receipt-Token": "receipt-test-token-12345",
            }),
            json: async () => ({
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              verdict: "SAFE",
              isSafe: true,
              costUsdc: "0.01",
              timestamp: new Date().toISOString(),
            }),
            text: async () => "{}",
          };
        }
      });

      const response = await provider.fastPing(mockWalletProvider, {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        chainId: 8453,
      });

      const parsed = JSON.parse(response);
      expect(parsed.verdict).toBe("SAFE");
      expect(parsed.isSafe).toBe(true);
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
    });

    it("should enforce maxSpendUsdc guardrail and reject expensive calls", async () => {
      const provider = new IngravityActionProvider({
        maxSpendUsdc: 0.05, // Cap is $0.05
      });

      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 402,
          headers: new Headers(),
          json: async () => ({
            amount: "0.10", // Gateway asks for $0.10
            payTo: INGRAVITY_PAY_TO_WALLET,
            asset: BASE_USDC_CONTRACT,
            network: "eip155:8453",
          }),
          text: async () => "Payment Required",
        };
      });

      await expect(
        provider.txFirewall(mockWalletProvider, {
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          data: "0x",
        }),
      ).rejects.toThrow(/exceeding configured maxSpendUsdc limit of \$0.05/);

      // Verify no payment was attempted
      expect(mockWalletProvider.sendTransaction).not.toHaveBeenCalled();
    });

    it("should never leak verdict if wallet transaction fails (Anti-Bypass & Zero-Leak)", async () => {
      const provider = new IngravityActionProvider();

      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 402,
          headers: new Headers(),
          json: async () => ({
            amount: "0.01",
            payTo: INGRAVITY_PAY_TO_WALLET,
            asset: BASE_USDC_CONTRACT,
            network: "eip155:8453",
          }),
          text: async () => "Payment Required",
        };
      });

      // Wallet rejects signature / out of gas
      mockWalletProvider.sendTransaction.mockRejectedValueOnce(new Error("User rejected transaction"));

      await expect(
        provider.fastPing(mockWalletProvider, {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        }),
      ).rejects.toThrow("User rejected transaction");
    });
  });

  describe("Session Receipt Cache", () => {
    it("should reuse receipt token for subsequent identical calls without double payment", async () => {
      const provider = new IngravityActionProvider({
        enableReceiptCache: true,
      });

      let fetchCount = 0;
      global.fetch = jest.fn().mockImplementation(async (_url: string, init: any) => {
        fetchCount++;
        if (fetchCount === 1) {
          // 402 challenge
          return {
            ok: false,
            status: 402,
            headers: new Headers(),
            json: async () => ({
              amount: "0.01",
              payTo: INGRAVITY_PAY_TO_WALLET,
              asset: BASE_USDC_CONTRACT,
              network: "eip155:8453",
            }),
            text: async () => "Payment Required",
          };
        } else if (fetchCount === 2) {
          // Settled with receipt token
          return {
            ok: true,
            status: 200,
            headers: new Headers({
              "X-Ingravity-Receipt-Token": "cached-valid-receipt-token-777",
            }),
            json: async () => ({
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              verdict: "SAFE",
              receiptToken: "cached-valid-receipt-token-777",
            }),
            text: async () => "{}",
          };
        } else {
          // 3rd call: Worker accepts cached receipt directly!
          expect(init.headers["X-Ingravity-Receipt-Token"]).toBe("cached-valid-receipt-token-777");
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              verdict: "SAFE",
              fromCache: true,
            }),
            text: async () => "{}",
          };
        }
      });

      // First call (requires payment)
      await provider.fastPing(mockWalletProvider, {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledTimes(1);

      // Second identical call (should reuse receipt token, no new onchain tx)
      const secondResult = await provider.fastPing(mockWalletProvider, {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });

      expect(JSON.parse(secondResult).fromCache).toBe(true);
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledTimes(1); // Still only 1 tx!
    });
  });
});
