import { encodeFunctionData, parseUnits } from "viem";
import { ISuperTokenAbi } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { superfluidWrapperActionProvider } from "./superfluidWrapperActionProvider";
import { erc20Abi as ERC20ABI } from "viem";

describe("SuperfluidWrapperActionProvider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_ERC20_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_SUPERTOKEN_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_WRAP_AMOUNT = 100;

  const MOCK_DECIMALS = 18;
  const MOCK_NAME = "TestToken";
  const MOCK_SYMBOL = "TT";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = superfluidWrapperActionProvider();

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

  describe("wraps an erc20 into a super token", () => {
    it("should successfully wrap an erc20 to a super token", async () => {
      const args = {
        erc20TokenAddress: MOCK_ERC20_CONTRACT,
        superTokenAddress: MOCK_SUPERTOKEN_CONTRACT,
        wrapAmount: MOCK_WRAP_AMOUNT,
      };

      await actionProvider.wrapToken(mockWallet, args);

      const amount = parseUnits(String(args.wrapAmount), Number(MOCK_DECIMALS));

      const approveData = encodeFunctionData({
        abi: ERC20ABI,
        functionName: "approve",
        args: [MOCK_SUPERTOKEN_CONTRACT as `0x${string}`, amount],
      });

      const wrapData = encodeFunctionData({
        abi: ISuperTokenAbi,
        functionName: "upgrade",
        args: [amount],
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: MOCK_ERC20_CONTRACT,
        data: approveData,
      });
      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: MOCK_SUPERTOKEN_CONTRACT,
        data: wrapData,
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
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
