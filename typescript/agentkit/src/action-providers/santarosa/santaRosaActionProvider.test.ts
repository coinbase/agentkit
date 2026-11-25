import { santaRosaActionProvider, SantaRosaActionProvider } from "./santaRosaActionProvider";
import { SANTA_ROSA_ROUTER_BASE } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("SantaRosaActionProvider", () => {
  let provider: SantaRosaActionProvider;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = santaRosaActionProvider("0x8f7670EA615910D0A86320e84A611577F68E3908");

    mockWalletProvider = {
      getAddress: jest.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support base-mainnet", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "base-mainnet",
      };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should support base-sepolia", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "base-sepolia",
      };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should reject non-supported networks", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("constants and configuration", () => {
    it("should reference correct Santa Rosa Router contract on Base", () => {
      expect(SANTA_ROSA_ROUTER_BASE).toBe("0xcd4f88bca4e2653fd24f61b4ef3aaccd76310a57");
    });

    it("should instantiate correctly", () => {
      expect(provider).toBeInstanceOf(SantaRosaActionProvider);
      expect(provider.name).toBe("santarosa");
    });
  });

  describe("actions", () => {
    it("should generate ready-to-sign swap payload with 0.03% fee", async () => {
      const result = await provider.swap(mockWalletProvider, {
        tokenIn: "USDC",
        tokenOut: "WETH",
        amountIn: "1000000",
        slippageToleranceBps: 50,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe("ready_to_sign");
      expect(parsed.routerAddress).toBe(SANTA_ROSA_ROUTER_BASE);
      expect(parsed.feeBps).toContain("3 bps (0.03%)");
    });

    it("should quote leverage multiply with 0.10% fee", async () => {
      const result = await provider.quoteLeverageMultiply(mockWalletProvider, {
        flashLoanAmountUsd: 10000,
        leverageMultiplier: 3.0,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe("success");
      expect(parsed.feeBreakdown.totalFeeBps).toBe("10 bps (0.10%)");
      expect(parsed.feeBreakdown.morphoFlashLoanFee).toContain("0.00%");
    });

    it("should simulate debt rescue savings vs 5% liquidation penalty", async () => {
      const result = await provider.simulateRescueSavings(mockWalletProvider, {
        userAddress: "0x1111111111111111111111111111111111111111",
        currentDebtUsd: 50000,
        debtToRepayUsd: 25000,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe("success");
      expect(parsed.financialComparison.liquidationPenaltyAvoidedUsd).toBe(1250);
      expect(parsed.financialComparison.santaRosaFlatFeeUsd).toBe(62.5);
      expect(parsed.financialComparison.builderRevenueShareUsd).toBe(12.5);
    });
  });
});
