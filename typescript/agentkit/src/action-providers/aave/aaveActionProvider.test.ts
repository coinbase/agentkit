import { encodeFunctionData, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { approve } from "../../utils";
import { AaveActionProvider } from "./aaveActionProvider";
import { AAVE_POOL_ABI, AAVE_POOL_ADDRESSES } from "./constants";

const MOCK_ASSET_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MOCK_ONBEHALFOF = "0x9876543210987654321098765432109876543210";
const MOCK_TO = "0x9876543210987654321098765432109876543210";
const MOCK_WHOLE_ASSETS = "1.5";
const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: "success", blockNumber: 1234567 };
const MOCK_DECIMALS = 6;

jest.mock("../../utils");
const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("Aave Action Provider", () => {
  const actionProvider = new AaveActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ONBEHALFOF),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockResolvedValue(MOCK_DECIMALS),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockApprove.mockResolvedValue("Approval successful");
  });

  describe("supply", () => {
    it("should successfully supply to Aave V3", async () => {
      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        onBehalfOf: MOCK_ONBEHALFOF,
      };

      const atomicAssets = parseUnits(MOCK_WHOLE_ASSETS, MOCK_DECIMALS);
      const poolAddress = AAVE_POOL_ADDRESSES["base-mainnet"];

      const response = await actionProvider.supply(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        MOCK_ASSET_ADDRESS,
        poolAddress,
        atomicAssets,
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: poolAddress,
        data: encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: "supply",
          args: [MOCK_ASSET_ADDRESS, atomicAssets, MOCK_ONBEHALFOF, 0],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Supplied ${MOCK_WHOLE_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
      expect(response).toContain(JSON.stringify(MOCK_RECEIPT));
    });

    it("should reject supply with zero assets amount", async () => {
      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: "0",
        onBehalfOf: MOCK_ONBEHALFOF,
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toBe("Error: Assets amount must be greater than 0");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should reject supply on an unsupported network", async () => {
      mockWallet.getNetwork.mockReturnValue({ protocolFamily: "evm", networkId: "ethereum" });

      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        onBehalfOf: MOCK_ONBEHALFOF,
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toBe("Error: Aave V3 is not supported on network ethereum");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle approval failure", async () => {
      mockApprove.mockResolvedValue("Error: Approval failed");

      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        onBehalfOf: MOCK_ONBEHALFOF,
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toContain("Error approving Aave V3 Pool as spender: Error: Approval failed");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle errors when supplying", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to supply"));

      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        onBehalfOf: MOCK_ONBEHALFOF,
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toContain("Error supplying to Aave V3: Error: Failed to supply");
    });
  });

  describe("withdraw", () => {
    it("should successfully withdraw from Aave V3", async () => {
      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        to: MOCK_TO,
      };

      const atomicAssets = parseUnits(MOCK_WHOLE_ASSETS, MOCK_DECIMALS);
      const poolAddress = AAVE_POOL_ADDRESSES["base-mainnet"];

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: poolAddress,
        data: encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: "withdraw",
          args: [MOCK_ASSET_ADDRESS, atomicAssets, MOCK_TO],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Withdrew ${MOCK_WHOLE_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
      expect(response).toContain(JSON.stringify(MOCK_RECEIPT));
    });

    it("should reject withdraw with zero assets amount", async () => {
      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: "0",
        to: MOCK_TO,
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toBe("Error: Assets amount must be greater than 0");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should reject withdraw on an unsupported network", async () => {
      mockWallet.getNetwork.mockReturnValue({ protocolFamily: "evm", networkId: "ethereum" });

      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        to: MOCK_TO,
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toBe("Error: Aave V3 is not supported on network ethereum");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle errors when withdrawing", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to withdraw"));

      const args = {
        assetAddress: MOCK_ASSET_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        to: MOCK_TO,
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toContain("Error withdrawing from Aave V3: Error: Failed to withdraw");
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

    it("should return true for Base Sepolia", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      });
      expect(result).toBe(true);
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
