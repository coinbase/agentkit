import { encodeFunctionData, PublicClient } from "viem";
import { GDAv1ForwarderAddress, GDAv1ForwarderABI } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreatePoolArgs, superfluidPoolActionProvider } from "./superfluidPoolActionProvider";

describe("SuperfluidPoolActionProvider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_ERC20_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_CHAIN_ID = "8453";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = superfluidPoolActionProvider();

  // We'll assert on this directly (easier typing than asserting through the PublicClient type)
  let simulateContractMock: jest.Mock;
  let mockPublicClient: PublicClient;

  beforeEach(() => {
    simulateContractMock = jest.fn().mockResolvedValue({
      request: {},
      result: [true, "0xDeCc403f23881285E05Df2BbC7Ebb9a88Dd8A554"] as const,
    });

    // Minimal PublicClient stub with just the method we use
    mockPublicClient = { simulateContract: simulateContractMock } as unknown as PublicClient;

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm" }),
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
      sendTransaction: jest.fn().mockResolvedValue("0xmockhash" as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
      readContract: jest.fn(),
      call: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("create pool", () => {
    it("should successfully create a superfluid pool", async () => {
      const args = {
        superTokenAddress: MOCK_ERC20_CONTRACT,
        chainId: MOCK_CHAIN_ID,
      };

      const config = {
        transferabilityForUnitsOwner: false,
        distributionFromAnyAddress: false,
      } as const;

      const createArgs = [
        MOCK_ERC20_CONTRACT,
        mockWallet.getAddress() as `0x${string}`,
        config,
      ] as const satisfies CreatePoolArgs;

      const data = encodeFunctionData({
        abi: GDAv1ForwarderABI,
        functionName: "createPool",
        args: createArgs,
      });

      await actionProvider.createPool(mockWallet, args);

      expect(simulateContractMock).toHaveBeenCalledWith({
        address: GDAv1ForwarderAddress,
        abi: GDAv1ForwarderABI,
        functionName: "createPool",
        args: createArgs,
        account: MOCK_ADDRESS,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: GDAv1ForwarderAddress,
        data,
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("0xmockhash");
    });

    it("should handle pool creation errors", async () => {
      simulateContractMock.mockRejectedValueOnce(new Error("sim failed"));

      const args = {
        superTokenAddress: MOCK_ERC20_CONTRACT,
        chainId: MOCK_CHAIN_ID,
      };

      const response = await actionProvider.createPool(mockWallet, args);
      expect(response).toContain("Error creating Superfluid pool:");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });
      expect(result).toBe(true);
    });

    it("should return false for non-base networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "any",
      });
      expect(result).toBe(false);
    });
  });
});
