import { SelfPaidActionProvider, selfPaidActionProvider } from "./selfPaidActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const MOCK_RECIPIENT_ADDRESS = "0x2222222222222222222222222222222222222222";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

describe("SelfPaidActionProvider", () => {
  let provider: SelfPaidActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = selfPaidActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_WALLET_ADDRESS),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      readContract: jest.fn().mockResolvedValue(0n),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet EVM network", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(true);
    });

    it("does not support non-EVM or unsupported networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
        } as Network),
      ).toBe(false);
    });
  });

  describe("check_yield_rates", () => {
    it("returns formatted live APYs for Aave V3 and Morpho", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: {
            aave: { supplyAPY: 0.0485 },
            morpho: { netApy: 0.0612 },
          },
          bestProtocol: "morpho",
          recoveryEstimateDays: { "3x": 195, "5x": 117, "10x": 58 },
        }),
      });

      const res = await provider.checkYieldRates(mockWallet, {});
      expect(res).toContain("4.85% APY");
      expect(res).toContain("6.12% APY");
      expect(res).toContain("MORPHO");
    });
  });

  describe("quote_zero_cost_payment", () => {
    it("returns a detailed zero-cost payment quote", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amountToPay: 10,
          feeAmount: 0.1,
          yieldDepositAmount: 31.21,
          totalRequiredAmount: 41.31,
          selectedProtocol: "morpho",
          estimatedAPY: 0.06,
          estimatedRecoveryDays: 196,
        }),
      });

      const res = await provider.quoteZeroCostPayment(mockWallet, {
        amount: 10,
        protocol: "auto",
        collateralMultiplier: 3,
        bufferPercentage: 3,
      });

      expect(res).toContain("10 USDC");
      expect(res).toContain("31.21 USDC");
      expect(res).toContain("MORPHO");
    });
  });

  describe("prepare_zero_cost_payment", () => {
    it("prepares the 4-call atomic batch and Safe Multisig JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            feeAmount: 0.1,
            yieldDepositAmount: 3.12,
            protocol: "aave",
            totalRequiredAmount: 4.22,
            estimatedRecoveryDays: 210,
          },
          transactions: [
            { step: 1, name: "DEVELOPER_FEE", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x01", description: "Fee" },
            { step: 2, name: "PAYMENT", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x02", description: "Pay" },
          ],
        }),
      });

      const res = await provider.prepareZeroCostPayment(mockWallet, {
        recipient: MOCK_RECIPIENT_ADDRESS,
        amount: 1,
        protocol: "aave",
        collateralMultiplier: 3,
        bufferPercentage: 3,
      });

      expect(res).toContain("Safe Multisig JSON Payload");
      expect(res).toContain(MOCK_RECIPIENT_ADDRESS);
    });
  });

  describe("send_zero_cost_payment", () => {
    it("executes the payment sequence on Base Mainnet", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            feeAmount: 0.1,
            yieldDepositAmount: 3.12,
            protocol: "aave",
            totalRequiredAmount: 4.22,
            estimatedRecoveryDays: 210,
          },
          transactions: [
            { step: 1, name: "DEVELOPER_FEE", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x01" },
            { step: 2, name: "PAYMENT", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x02" },
            {
              step: 3,
              name: "APPROVE_POOL",
              to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              data: "0x095ea7b3000000000000000000000000a238dd80c259a72e81d7e4664a9801593f98d1c500000000000000000000000000000000000000000000000000000000002f9b80",
            },
            {
              step: 4,
              name: "SUPPLY_YIELD",
              to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
              data: "0x617ba037",
            },
          ],
        }),
      });

      const res = await provider.sendZeroCostPayment(mockWallet, {
        recipient: MOCK_RECIPIENT_ADDRESS,
        amount: 1,
        protocol: "aave",
        collateralMultiplier: 3,
        bufferPercentage: 3,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(4);
      expect(res).toContain("Zero-Cost Payment Successfully Executed on Base!");
      expect(res).toContain(MOCK_TX_HASH);
    });
  });

  describe("get_treasury_status & redeem_collateral", () => {
    it("fetches treasury balances and prepares collateral withdrawal", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: {
            liquidUsdc: "12.50",
            aaveYieldUsdc: "30.00",
            morphoYieldUsdc: "0.00",
            totalYieldUsdc: "30.00",
            totalAccruedYieldUsdc: "0.45",
          },
        }),
      });

      const treasuryRes = await provider.getTreasuryStatus(mockWallet, {});
      expect(treasuryRes).toContain("30.00 USDC");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transaction: {
            to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            data: "0x69328dec",
            value: "0",
          },
        }),
      });

      const redeemRes = await provider.redeemCollateral(mockWallet, {
        protocol: "aave",
        execute: false,
      });
      expect(redeemRes).toContain("Prepared Collateral Withdrawal (AAVE)");
    });
  });
});
