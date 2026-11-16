import { basedLoansActionProvider } from "./basedLoansActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

const WALLET = "0x1234567890AbcdEF1234567890aBcdef12345678";
const WETH = "0x4200000000000000000000000000000000000006";
const VIRTUAL = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";
const CORE = "0x00000000000000000000000000000000000000c0";

const mockClient = {
  ctx: {
    assets: new Map([
      [WETH.toLowerCase(), { address: WETH, symbol: "WETH" }],
      [VIRTUAL.toLowerCase(), { address: VIRTUAL, symbol: "VIRTUAL" }],
      ["0xdup1", { address: "0x00000000000000000000000000000000000000d1", symbol: "DUP" }],
      ["0xdup2", { address: "0x00000000000000000000000000000000000000d2", symbol: "DUP" }],
    ]),
  },
  getProtocolParams: jest.fn(),
  listMarkets: jest.fn(),
  getRiskReport: jest.fn(),
  quoteBorrow: jest.fn(),
  getBorrowerLoans: jest.fn(),
  getLenderPosition: jest.fn(),
  requestTokenListing: jest.fn(),
  buildBorrow: jest.fn(),
  buildBuyback: jest.fn(),
  buildDeposit: jest.fn(),
  buildSetLimits: jest.fn(),
  buildWithdraw: jest.fn(),
  buildClaimProceeds: jest.fn(),
  buildClaimCollateral: jest.fn(),
};

jest.mock("@basedloans/sdk", () => {
  /** Mirrors the SDK's typed error. */
  class BasedLoansError extends Error {
    /**
     * Creates the error.
     *
     * @param message - Error message
     * @param code - Error code
     */
    constructor(
      message: string,
      public code: string,
    ) {
      super(message);
    }
  }
  return {
    BasedLoansError,
    createBasedLoans: jest.fn(() => mockClient),
    explainError: jest.fn((e: Error) => ({ message: `explained: ${e.message}` })),
  };
});

const plan = (n: number) => ({
  summary: "Borrow 69.76 USDC against 0.05 WETH",
  warnings: ["Buy back by Dec 16, 2026"],
  steps: Array.from({ length: n }, (_, i) => ({
    description: i === n - 1 ? "Open the loan" : "Approve WETH",
    to: CORE,
    data: `0x0${i}`,
    value: "0",
  })),
});

describe("BasedLoansActionProvider", () => {
  const provider = basedLoansActionProvider();
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    wallet = {
      getAddress: jest.fn().mockReturnValue(WALLET),
      sendTransaction: jest.fn().mockResolvedValueOnce("0xaaa").mockResolvedValueOnce("0xbbb"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });

    it("does not support other EVM networks or non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("read actions", () => {
    it("returns protocol info as JSON with bigints as strings", async () => {
      mockClient.getProtocolParams.mockResolvedValueOnce({ minLoan: 10n, feeBps: 150 });
      const result = JSON.parse(await provider.getProtocolInfo({}));
      expect(result).toEqual({ minLoan: "10", feeBps: 150 });
    });

    it("passes the market filter through", async () => {
      mockClient.listMarkets.mockResolvedValueOnce([]);
      await provider.listMarkets({ onlyWithFunds: true });
      expect(mockClient.listMarkets).toHaveBeenCalledWith({ onlyWithFunds: true });
    });

    it("resolves a symbol to its address, case-insensitively", async () => {
      mockClient.getRiskReport.mockResolvedValueOnce({ flags: [] });
      await provider.getRiskReport({ token: "weth" });
      expect(mockClient.getRiskReport).toHaveBeenCalledWith(WETH);
    });

    it("checksums a lowercase address", async () => {
      mockClient.quoteBorrow.mockResolvedValueOnce({ netUsdc: "69.76" });
      await provider.quoteBorrow({
        token: VIRTUAL.toLowerCase(),
        collateralAmount: "100",
        term: "short",
      });
      expect(mockClient.quoteBorrow).toHaveBeenCalledWith({
        asset: VIRTUAL,
        collateralAmount: "100",
        loanAmountUsdc: undefined,
        term: "short",
      });
    });

    it("explains unknown and ambiguous symbols", async () => {
      expect(await provider.getRiskReport({ token: "NOPE" })).toMatch(
        /^Error: Unknown token "NOPE".*request_token_listing/,
      );
      expect(await provider.getRiskReport({ token: "DUP" })).toMatch(
        /^Error: More than one token is called DUP/,
      );
      expect(mockClient.getRiskReport).not.toHaveBeenCalled();
    });

    it("looks up positions for the agent's own wallet", async () => {
      mockClient.getBorrowerLoans.mockResolvedValueOnce([]);
      mockClient.getLenderPosition.mockResolvedValueOnce({});
      await provider.getMyLoans(wallet, {});
      await provider.getMyLending(wallet, {});
      expect(mockClient.getBorrowerLoans).toHaveBeenCalledWith(WALLET);
      expect(mockClient.getLenderPosition).toHaveBeenCalledWith(WALLET);
    });

    it("checks token listings by address", async () => {
      mockClient.requestTokenListing.mockResolvedValueOnce({ supported: false, url: "https://x" });
      const result = JSON.parse(await provider.requestTokenListing({ token: WETH.toLowerCase() }));
      expect(mockClient.requestTokenListing).toHaveBeenCalledWith(WETH);
      expect(result.supported).toBe(false);
    });
  });

  describe("write actions", () => {
    it("sends every step in order and reports hashes and warnings", async () => {
      mockClient.buildBorrow.mockResolvedValueOnce(plan(2));
      const result = await provider.borrow(wallet, {
        token: "WETH",
        collateralAmount: "0.05",
        term: "short",
      });
      expect(mockClient.buildBorrow).toHaveBeenCalledWith({
        asset: WETH,
        collateralAmount: "0.05",
        loanAmountUsdc: undefined,
        term: "short",
        borrower: WALLET,
      });
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: CORE,
        data: "0x00",
        value: 0n,
      });
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: CORE,
        data: "0x01",
        value: 0n,
      });
      expect(result).toContain("Borrow 69.76 USDC against 0.05 WETH");
      expect(result).toContain("Note: Buy back by Dec 16, 2026");
      expect(result).toContain("Transactions: 0xaaa, 0xbbb");
    });

    it("stops at the first failed step", async () => {
      mockClient.buildBorrow.mockResolvedValueOnce(plan(2));
      wallet.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
      const result = await provider.borrow(wallet, {
        token: WETH,
        collateralAmount: "0.05",
        term: "short",
      });
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(result).toBe(
        'Error: step "Approve WETH" failed (tx 0xaaa). Completed before it: none.',
      );
    });

    it("builds buybacks for the agent's wallet", async () => {
      mockClient.buildBuyback.mockResolvedValueOnce(plan(1));
      await provider.buyback(wallet, { loanId: "199" });
      expect(mockClient.buildBuyback).toHaveBeenCalledWith({
        loanId: "199",
        paymentUsdc: undefined,
        borrower: WALLET,
      });
    });

    it("maps lending limits by symbol", async () => {
      mockClient.buildDeposit.mockResolvedValueOnce(plan(1));
      await provider.lend(wallet, {
        amountUsdc: "500",
        limits: [{ token: "WETH", limitUsdc: "500" }],
      });
      expect(mockClient.buildDeposit).toHaveBeenCalledWith({
        amountUsdc: "500",
        lender: WALLET,
        limits: [{ asset: WETH, limitUsdc: "500" }],
      });

      mockClient.buildSetLimits.mockResolvedValueOnce(plan(1));
      await provider.setLendingLimits(wallet, { limits: [{ token: "VIRTUAL", limitUsdc: "0" }] });
      expect(mockClient.buildSetLimits).toHaveBeenCalledWith({
        limits: [{ asset: VIRTUAL, limitUsdc: "0" }],
        lender: WALLET,
      });
    });

    it("passes withdraw and claim options through", async () => {
      mockClient.buildWithdraw.mockResolvedValue(plan(1));
      mockClient.buildClaimProceeds.mockResolvedValue(plan(1));
      mockClient.buildClaimCollateral.mockResolvedValue(plan(1));
      wallet.sendTransaction.mockResolvedValue("0xccc");

      await provider.withdraw(wallet, { amountUsdc: "max", asMusdc: true });
      await provider.claimProceeds(wallet, { loanIds: ["1", "2"], mode: "redeploy" });
      await provider.claimCollateral(wallet, { loanIds: ["3"] });

      expect(mockClient.buildWithdraw).toHaveBeenCalledWith({
        amountUsdc: "max",
        lender: WALLET,
        asMusdc: true,
      });
      expect(mockClient.buildClaimProceeds).toHaveBeenCalledWith({
        loanIds: ["1", "2"],
        mode: "redeploy",
      });
      expect(mockClient.buildClaimCollateral).toHaveBeenCalledWith({ loanIds: ["3"] });
    });

    it("returns readable errors instead of throwing", async () => {
      mockClient.buildBorrow.mockRejectedValueOnce(new Error("execution reverted: 0x1234"));
      const result = await provider.borrow(wallet, {
        token: WETH,
        collateralAmount: "0.05",
        term: "short",
      });
      expect(result).toBe("Error: explained: execution reverted: 0x1234");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });
  });
});
