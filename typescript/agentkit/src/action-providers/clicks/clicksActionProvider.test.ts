import { encodeFunctionData, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { ClicksActionProvider } from "./clicksActionProvider";
import {
  CLICKS_SPLITTER_ADDRESS,
  CLICKS_YIELD_ROUTER_ADDRESS,
  USDC_BASE_ADDRESS,
  CLICKS_SPLITTER_ABI,
  CLICKS_YIELD_ROUTER_ABI,
  ERC20_APPROVE_ABI,
} from "./constants";

const MOCK_AMOUNT = "100";
const MOCK_AGENT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_SPLITTER_ADDRESS = "0x9876543210987654321098765432109876543210";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567 };

describe("Clicks Action Provider", () => {
  const actionProvider = new ClicksActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_AGENT_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockResolvedValue([
        MOCK_SPLITTER_ADDRESS,
        true,
        BigInt(100000000), // 100 USDC deposited
        BigInt(5000000), // 5 USDC earned
      ]),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("quickStart", () => {
    it("should successfully register and deposit via quick start", async () => {
      const args = { amount: MOCK_AMOUNT };
      const atomicAmount = parseUnits(MOCK_AMOUNT, 6);

      const response = await actionProvider.quickStart(mockWallet, args);

      // Should approve USDC first
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: USDC_BASE_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [CLICKS_SPLITTER_ADDRESS, atomicAmount],
        }),
      });

      // Should call quickStart
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: CLICKS_SPLITTER_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CLICKS_SPLITTER_ABI,
          functionName: "quickStart",
          args: [MOCK_AGENT_ADDRESS, atomicAmount],
        }),
      });

      expect(response).toContain("Successfully registered agent");
      expect(response).toContain(MOCK_AMOUNT);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle errors during quick start", async () => {
      const args = { amount: MOCK_AMOUNT };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Insufficient USDC balance"));

      const response = await actionProvider.quickStart(mockWallet, args);

      expect(response).toContain("Error during Clicks Protocol quick start");
    });
  });

  describe("deposit", () => {
    it("should successfully deposit USDC into yield router", async () => {
      const args = { amount: MOCK_AMOUNT };
      const atomicAmount = parseUnits(MOCK_AMOUNT, 6);

      const response = await actionProvider.deposit(mockWallet, args);

      // Should approve USDC for YieldRouter
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: USDC_BASE_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [CLICKS_YIELD_ROUTER_ADDRESS, atomicAmount],
        }),
      });

      // Should call deposit on YieldRouter
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: CLICKS_YIELD_ROUTER_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CLICKS_YIELD_ROUTER_ABI,
          functionName: "deposit",
          args: [atomicAmount],
        }),
      });

      expect(response).toContain("Deposited");
      expect(response).toContain(MOCK_AMOUNT);
    });

    it("should handle errors when depositing", async () => {
      const args = { amount: MOCK_AMOUNT };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to deposit"));

      const response = await actionProvider.deposit(mockWallet, args);

      expect(response).toContain("Error depositing to Clicks Yield Router");
    });
  });

  describe("withdraw", () => {
    it("should successfully withdraw USDC from yield router", async () => {
      const args = { amount: MOCK_AMOUNT };
      const atomicAmount = parseUnits(MOCK_AMOUNT, 6);

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: CLICKS_YIELD_ROUTER_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CLICKS_YIELD_ROUTER_ABI,
          functionName: "withdraw",
          args: [atomicAmount],
        }),
      });

      expect(response).toContain("Withdrawn");
      expect(response).toContain(MOCK_AMOUNT);
    });

    it("should handle errors when withdrawing", async () => {
      const args = { amount: MOCK_AMOUNT };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to withdraw"));

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toContain("Error withdrawing from Clicks Yield Router");
    });
  });

  describe("getInfo", () => {
    it("should successfully retrieve agent info", async () => {
      const response = await actionProvider.getInfo(mockWallet, {});

      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: CLICKS_SPLITTER_ADDRESS,
        abi: CLICKS_SPLITTER_ABI,
        functionName: "getAgentInfo",
        args: [MOCK_AGENT_ADDRESS],
      });

      expect(response).toContain("Registered: true");
      expect(response).toContain("100");
      expect(response).toContain("5");
    });

    it("should handle errors when getting info", async () => {
      mockWallet.readContract.mockRejectedValue(new Error("Contract read failed"));

      const response = await actionProvider.getInfo(mockWallet, {});

      expect(response).toContain("Error getting Clicks Protocol agent info");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });
      expect(result).toBe(true);
    });

    it("should return false for Base Sepolia", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      });
      expect(result).toBe(false);
    });

    it("should return false for other EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "ethereum",
      });
      expect(result).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "base-mainnet",
      });
      expect(result).toBe(false);
    });
  });
});
