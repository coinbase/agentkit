import { encodeFunctionData, PublicClient, http } from "viem";
import * as viem from "viem";
import { GDAv1ForwarderAddress, GDAv1ForwarderABI } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreatePoolArgs, superfluidPoolActionProvider } from "./superfluidPoolActionProvider";

describe("SuperfluidPoolActionProvider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_ERC20_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_CHAIN_ID = "8453";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = superfluidPoolActionProvider();

  let mockPublicClient: Pick<PublicClient, "simulateContract">;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      call: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockPublicClient = {
      simulateContract: jest.fn().mockResolvedValue({
        request: {},
        result: [true, "0xDeCc403f23881285E05Df2BbC7Ebb9a88Dd8A554"] as const,
      }),
    };

    // make your class's createPublicClient(...) return the mock
    jest.spyOn(viem, "createPublicClient").mockReturnValue(mockPublicClient as PublicClient);

    // optional: stub http() to avoid creating a real transport
    jest.spyOn(viem, "http").mockReturnValue(http());

    mockWallet.sendTransaction.mockResolvedValue("0xmockhash" as `0x${string}`);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  describe("create pool", () => {
    it("should successfully create a superfluid pool", async () => {
      const args = {
        erc20TokenAddress: MOCK_ERC20_CONTRACT,
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

      expect(mockPublicClient.simulateContract).toHaveBeenCalledWith({
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
      // make simulateContract throw (or sendTransaction reject)
      (mockPublicClient.simulateContract as jest.Mock).mockRejectedValueOnce(
        new Error("sim failed"),
      );

      const args = {
        erc20TokenAddress: MOCK_ERC20_CONTRACT,
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
