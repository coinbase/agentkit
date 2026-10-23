import { encodeAbiParameters, encodeFunctionData, parseEther, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { GblinActionProvider } from "./gblinActionProvider";
import {
  GBLIN_ABI,
  GBLIN_ADDRESS,
  GBLIN_LENS_ADDRESS,
  GBLIN_ZAP_ABI,
  GBLIN_ZAP_ADDRESS,
} from "./constants";

const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: "success", blockNumber: 1234567n };
const MOCK_ADDRESS = "0x9876543210987654321098765432109876543210";
const BPS = 10_000n;
const DEFAULT_SLIPPAGE_BPS = 100n;
const VENUE = encodeAbiParameters([{ type: "uint24" }], [500]);

describe("GBLIN Action Provider", () => {
  const actionProvider = new GblinActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("buyGblin", () => {
    it("should buy GBLIN on the vault with a quote-derived minOut", async () => {
      const expectedOut = parseUnits("0.03", 18);
      const minOut = (expectedOut * (BPS - DEFAULT_SLIPPAGE_BPS)) / BPS;
      mockWallet.readContract
        .mockResolvedValueOnce(true) // isNavReliable
        .mockResolvedValueOnce([expectedOut, 0n, 0n]); // Lens.quoteBuy

      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });

      expect(mockWallet.readContract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          address: GBLIN_LENS_ADDRESS,
          functionName: "quoteBuy",
          args: [GBLIN_ADDRESS, parseEther("0.1")],
        }),
      );
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

    it("should report a reverted purchase as an error", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce([10n ** 16n, 0n, 0n]);
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });
      expect(response).toContain("reverted");
    });

    it("should reject a non-positive amount", async () => {
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0" });
      expect(response).toContain("must be greater than 0");
    });

    it("should not buy while the NAV is not reliable", async () => {
      mockWallet.readContract.mockResolvedValueOnce(false);
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });
      expect(response).toContain("not reliable");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle a zero on-chain quote", async () => {
      mockWallet.readContract.mockResolvedValueOnce(true).mockResolvedValueOnce([0n, 0n, 0n]);
      const response = await actionProvider.buyGblin(mockWallet, { ethAmount: "0.1" });
      expect(response).toContain("zero");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("sellGblinForEth", () => {
    const shares = parseUnits("5", 18);
    const expectedEth = parseEther("0.2");
    const minEthOut = (expectedEth * (BPS - DEFAULT_SLIPPAGE_BPS)) / BPS;
    const zapCall = {
      to: GBLIN_ZAP_ADDRESS as `0x${string}`,
      data: encodeFunctionData({
        abi: GBLIN_ZAP_ABI,
        functionName: "sellGBLINForEth",
        args: [shares, minEthOut, [VENUE, VENUE, VENUE], MOCK_ADDRESS],
      }),
    };

    it("should approve the Zap and redeem through it when the allowance is short", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(true) // isNavReliable
        .mockResolvedValueOnce(expectedEth) // Lens.quoteSell
        .mockResolvedValueOnce(3n) // Lens.basketLength
        .mockResolvedValueOnce(0n); // allowance

      const response = await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });

      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: GBLIN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: GBLIN_ABI,
          functionName: "approve",
          args: [GBLIN_ZAP_ADDRESS, shares],
        }),
      });
      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(2, zapCall);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should skip the approval when the allowance already covers the shares", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(expectedEth)
        .mockResolvedValueOnce(3n)
        .mockResolvedValueOnce(shares);

      await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(zapCall);
    });

    it("should not sell while the NAV is not reliable", async () => {
      mockWallet.readContract.mockResolvedValueOnce(false);
      const response = await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });
      expect(response).toContain("not reliable");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle errors when redeeming", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(expectedEth)
        .mockResolvedValueOnce(3n)
        .mockResolvedValueOnce(shares);
      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed"));
      const response = await actionProvider.sellGblinForEth(mockWallet, { gblinAmount: "5" });
      expect(response).toContain("Error redeeming GBLIN");
    });
  });

  describe("getGblinState", () => {
    it("should return live state as JSON", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(parseEther("0.04")) // Lens.quoteSell(1)
        .mockResolvedValueOnce(parseUnits("0.5", 18)) // totalSupply
        .mockResolvedValueOnce(true); // isNavReliable

      const response = await actionProvider.getGblinState(mockWallet, {});
      const parsed = JSON.parse(response);
      expect(parsed.contract).toBe(GBLIN_ADDRESS);
      expect(parsed.network).toBe("base-mainnet");
      expect(parsed.ethValuePerGblin).toBe("0.04");
      expect(parsed.totalSupply).toBe("0.5");
      expect(parsed.navReliable).toBe(true);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum" })).toBe(
        false,
      );
    });

    it("should return false for non-EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "bitcoin", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });
});
