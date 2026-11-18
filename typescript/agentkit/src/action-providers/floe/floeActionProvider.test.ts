import { type Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { FloeActionProvider } from "./floeActionProvider";
import { LENDING_MATCHER_ADDRESSES } from "./constants";
import { Network } from "../../network";

describe("Floe Action Provider", () => {
  const actionProvider = new FloeActionProvider("https://mock-api.test");
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const MOCK_NETWORK: Network = { protocolFamily: "evm", networkId: "base-mainnet" };
  const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
  const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
  const MOCK_RECEIPT = { status: 1, blockNumber: 123456 };
  const MOCK_SIGNATURE = "0xmocksignature";

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(MOCK_NETWORK),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe("supportsNetwork", () => {
    it("returns true for base-mainnet", () => {
      expect(actionProvider.supportsNetwork(MOCK_NETWORK)).toBe(true);
    });

    it("returns false for base-sepolia", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" }),
      ).toBe(false);
    });

    it("returns false for unsupported networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });

    it("returns false for non-evm networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "solana", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });

  describe("getMarkets", () => {
    it("returns formatted market data", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          markets: [
            { collateralSymbol: "USDC", loanSymbol: "USDC" },
          ],
        }),
      });

      const result = await actionProvider.getMarkets(mockWallet, {});
      expect(result).toContain("Floe Lending Markets");
      expect(result).toContain("USDC/USDC");
    });

    it("handles empty markets", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ markets: [] }),
      });

      const result = await actionProvider.getMarkets(mockWallet, {});
      expect(result).toContain("No active markets");
    });

    it("handles API errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await actionProvider.getMarkets(mockWallet, {});
      expect(result).toContain("Error fetching markets");
    });
  });

  describe("instantBorrow", () => {
    it("calls the correct API with auth headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ loanId: "42" }),
      });

      const result = await actionProvider.instantBorrow(mockWallet, {
        borrowAmount: "1000",
        collateralAmount: "10000",
        maxInterestRateBps: "800",
        duration: "1209600",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://mock-api.test/v1/credit/instant-borrow",
        expect.objectContaining({ method: "POST" }),
      );
      expect(result).toContain("Loan Created");
      expect(result).toContain("1000 USDC");
      expect(result).toContain("10000 USDC");
    });

    it("handles no liquidity", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "no_liquidity" }),
      });

      const result = await actionProvider.instantBorrow(mockWallet, {
        borrowAmount: "1000",
        collateralAmount: "10000",
        maxInterestRateBps: "800",
        duration: "1209600",
      });

      expect(result).toContain("No lenders available");
    });
  });

  describe("grantDelegation", () => {
    it("encodes setOperator correctly and sends transaction", async () => {
      const result = await actionProvider.grantDelegation(mockWallet, {
        facilitatorAddress: "0x58EDdE022FFDAD3Fb0Fb0E7D51eb05AaF66a31f1",
        borrowLimit: "10000",
        maxRateBps: "1500",
        expiryDays: "90",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: LENDING_MATCHER_ADDRESSES["base-mainnet"],
        }),
      );
      expect(result).toContain("Credit Delegation Granted");
      expect(result).toContain("10000 USDC");
      expect(result).toContain("15.00% APR");
      expect(result).toContain("90 days");
    });

    it("rejects unsupported networks", async () => {
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      } as Network);

      const result = await actionProvider.grantDelegation(mockWallet, {
        facilitatorAddress: "0x58EDdE022FFDAD3Fb0Fb0E7D51eb05AaF66a31f1",
        borrowLimit: "10000",
        maxRateBps: "1500",
        expiryDays: "90",
      });

      expect(result).toContain("not supported");
    });
  });

  describe("checkStatus", () => {
    it("returns formatted loan status", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          remainingPrincipal: "500000000",
          accruedInterest: "12500000",
          interestRateBps: 800,
          status: "active",
          timeToExpiry: "10 days",
        }),
      });

      const result = await actionProvider.checkStatus(mockWallet, { loanId: "42" });
      expect(result).toContain("Loan #42 Status");
      expect(result).toContain("8.00% APR");
      expect(result).toContain("active");
    });
  });

  describe("repay", () => {
    it("repays a loan successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await actionProvider.repay(mockWallet, { loanId: "42" });
      expect(result).toContain("Loan Repaid");
      expect(result).toContain("42");
      expect(result).toContain("Returned to your wallet");
    });

    it("handles repay failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "loan_not_found" }),
      });

      const result = await actionProvider.repay(mockWallet, { loanId: "999" });
      expect(result).toContain("Repay failed");
    });
  });

  describe("getBalance", () => {
    it("returns formatted credit balance", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creditLimit: "10000000000",
          creditUsed: "3200000000",
          creditAvailable: "6800000000",
          activeLoans: 1,
          delegationActive: true,
        }),
      });

      const result = await actionProvider.getBalance(mockWallet, {});
      expect(result).toContain("Credit Balance");
      expect(result).toContain("Active");
    });

    it("handles balance check failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "unauthorized" }),
      });

      const result = await actionProvider.getBalance(mockWallet, {});
      expect(result).toContain("Balance check failed");
    });
  });

  describe("checkHealth", () => {
    it("returns health with buffer when LTV data present", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "active",
          currentLtvBps: 8000,
          liquidationLtvBps: 8800,
        }),
      });

      const result = await actionProvider.checkHealth(mockWallet, { loanId: "42" });
      expect(result).toContain("Loan #42 Health");
      expect(result).toContain("🟢");
      expect(result).toContain("80.0%");
      expect(result).toContain("Buffer");
    });

    it("returns health without buffer when LTV data absent", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "overdue",
        }),
      });

      const result = await actionProvider.checkHealth(mockWallet, { loanId: "42" });
      expect(result).toContain("🔴");
      expect(result).toContain("overdue");
      expect(result).not.toContain("Buffer");
    });
  });

  describe("x402Fetch", () => {
    it("calls proxy endpoint with auth headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([["payment-response", "0xtxhash"]]),
        text: async () => '{"data": "premium content"}',
      });

      const result = await actionProvider.x402Fetch(mockWallet, {
        url: "https://api.example.com/data",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://mock-api.test/v1/proxy/fetch",
        expect.objectContaining({ method: "POST" }),
      );
      expect(result).toContain("x402 Response");
    });

    it("handles insufficient balance", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({ error: "insufficient_balance", available: "100", required: "500" }),
      });

      const result = await actionProvider.x402Fetch(mockWallet, {
        url: "https://api.example.com/data",
      });

      expect(result).toContain("Insufficient credit balance");
    });
  });
});
