import { encodeFunctionData, parseEther, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { GblinActionProvider } from "./gblinActionProvider";
import { GBLIN_ADDRESS, GBLIN_ABI } from "./constants";

const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567 };
const BPS = 10_000n;
const DEFAULT_SLIPPAGE_BPS = 100n;

describe("GBLIN Action Provider", () => {
  const actionProvider = new GblinActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x9876543210987654321098765432109876543210"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("buyGblin", () => {
    it("should buy GBLIN with ETH using a quote-derived minOut", async () => {
      const expectedOut = parseUnits("30", 18);
      const minOut = (expectedOut * (BPS - DEFAULT_SLIPPAGE_BPS)) / BPS;
      mockWallet.readContract.mockResolvedValueOnce([expectedOut, 0n, 0n]);

      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: GBLIN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: GBLIN_ABI,
          functionName: "buyGBLIN",
          args: [minOut],
        }),
        value: parseEther("0.1"),
      });
      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should reject a non-positive amount", async () => {
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0" });
      expect(response).toContain("must be greater than 0");
    });

    it("should handle a zero on-chain quote (stale oracles)", async () => {
      mockWallet.readContract.mockResolvedValueOnce([0n, 0n, 0n]);
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });
      expect(response).toContain("zero");
    });
  });

  describe("sellGblinForEth", () => {
    it("should redeem GBLIN for ETH using a quote-derived minOut", async () => {
      const atomic = parseUnits("5", 18);
      const expectedEth = parseEther("0.02");
      const minEthOut = (expectedEth * (BPS - DEFAULT_SLIPPAGE_BPS)) / BPS;
      mockWallet.readContract.mockResolvedValueOnce(expectedEth);

      const response = await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: GBLIN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: GBLIN_ABI,
          functionName: "sellGBLINForEth",
          args: [atomic, minEthOut],
        }),
      });
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle errors when redeeming", async () => {
      mockWallet.readContract.mockResolvedValueOnce(parseEther("0.02"));
      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed"));
      const response = await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });
      expect(response).toContain("Error redeeming GBLIN");
    });
  });

  describe("getGblinState", () => {
    it("should return live state as JSON", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(parseEther("0.0012")) // quoteSellGBLIN(1)
        .mockResolvedValueOnce(parseUnits("0.5", 18)); // totalSupply

      const response = await actionProvider.getGblinState(mockWallet, {});
      const parsed = JSON.parse(response);
      expect(parsed.contract).toBe(GBLIN_ADDRESS);
      expect(parsed.network).toBe("base-mainnet");
      expect(parsed).toHaveProperty("ethValuePerGblin");
      expect(parsed).toHaveProperty("totalSupply");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum" }),
      ).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "bitcoin", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });
});
