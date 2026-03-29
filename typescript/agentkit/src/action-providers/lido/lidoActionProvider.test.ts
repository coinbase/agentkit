import { lidoActionProvider, LidoActionProvider } from "./lidoActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("../../utils", () => ({
  approve: jest.fn().mockResolvedValue("Approval successful"),
}));

describe("LidoActionProvider", () => {
  let provider: LidoActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = lidoActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash" as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 1, blockNumber: 123456 }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(true);
    });

    it("should not support ethereum-mainnet", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });

    it("should not support non-evm", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });

  describe("stakeEth", () => {
    it("should successfully stake ETH", async () => {
      // Mock getExpectedWstETH return
      mockWallet.readContract.mockResolvedValueOnce(BigInt("83000000000000000")); // ~0.083 wstETH for 0.1 ETH

      const result = await provider.stakeEth(mockWallet, {
        amount: "0.1",
        slippage: 0.005,
      });

      expect(result).toContain("Successfully staked 0.1 ETH");
      expect(result).toContain("0xmocktxhash");
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0x328de900860816d29D1367F6903a24D8ed40C997",
          value: BigInt("100000000000000000"),
        }),
      );
    });

    it("should handle errors", async () => {
      mockWallet.readContract.mockRejectedValueOnce(new Error("Contract call failed"));

      const result = await provider.stakeEth(mockWallet, {
        amount: "0.1",
        slippage: 0.005,
      });

      expect(result).toContain("Error staking ETH");
    });
  });

  describe("stakeWeth", () => {
    it("should successfully stake WETH with approval", async () => {
      mockWallet.readContract.mockResolvedValueOnce(BigInt("83000000000000000"));

      const result = await provider.stakeWeth(mockWallet, {
        amount: "0.1",
        slippage: 0.005,
      });

      expect(result).toContain("Successfully staked 0.1 WETH");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });
  });

  describe("checkBalance", () => {
    it("should return wstETH balance", async () => {
      mockWallet.readContract.mockResolvedValueOnce(BigInt("500000000000000000")); // 0.5 wstETH

      const result = await provider.checkBalance(mockWallet);

      expect(result).toContain("0.5");
      expect(result).toContain("wstETH Balance");
      expect(result).toContain("0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452");
    });

    it("should handle zero balance", async () => {
      mockWallet.readContract.mockResolvedValueOnce(BigInt(0));

      const result = await provider.checkBalance(mockWallet);

      expect(result).toContain("0 wstETH");
      expect(result).toContain("wstETH Balance");
    });
  });
});
