import { encodeFunctionData } from "viem";
import { SuperTokenFactoryAddress, SuperTokenFactoryABI } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { superfluidSuperTokenCreatorActionProvider } from "./superfluidSuperTokenCreatorActionProvider";

describe("SuperfluidSuperTokenCreatorActionProvider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_ERC20_CONTRACT = "0x1234567890123456789012345678901234567890";

  const MOCK_DECIMALS = 18;
  const MOCK_NAME = "TestToken";
  const MOCK_SYMBOL = "TT";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = superfluidSuperTokenCreatorActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      call: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue("0xmockhash" as `0x${string}`);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
    mockWallet.readContract.mockImplementation(async ({ address, functionName, args }) => {
      if (functionName === "decimals") return MOCK_DECIMALS;
      if (functionName === "name") return MOCK_NAME;
      if (functionName === "symbol") return MOCK_SYMBOL;

      throw new Error(`No mock for ${functionName}(${JSON.stringify(args)}) @ ${address}`);
    });
  });

  describe("create super token", () => {
    it("should successfully create a superfluid super token", async () => {
      const args = {
        erc20TokenAddress: MOCK_ERC20_CONTRACT,
      };

      await actionProvider.createSuperToken(mockWallet, args);

      const createSuperTokenData = encodeFunctionData({
        abi: SuperTokenFactoryABI,
        functionName: "createERC20Wrapper",
        args: [
          args.erc20TokenAddress,
          MOCK_DECIMALS,
          2, // upgradeable
          `Super ${MOCK_NAME}`,
          `${MOCK_SYMBOL}x`,
        ],
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: SuperTokenFactoryAddress,
        data: createSuperTokenData,
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("0xmockhash");
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
