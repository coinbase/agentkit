import { WrapEthSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData } from "viem";
import { WETH_ABI, WETH_ADDRESS } from "./constants";
import { wethActionProvider } from "./wethActionProvider";

const MOCK_AMOUNT = "15";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234543210";

describe("Wrap Eth Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amountToWrap: MOCK_AMOUNT,
    };

    const result = WrapEthSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = WrapEthSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Wrap Eth Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = wethActionProvider();

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    const args = {
      amountToWrap: MOCK_AMOUNT,
    };

    const hash = "0x1234567890123456789012345678901234567890";
    mockWallet.sendTransaction.mockResolvedValue(hash);

    const response = await actionProvider.wrapEth(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: WETH_ADDRESS,
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "deposit",
      }),
      value: BigInt(MOCK_AMOUNT),
    });
    expect(response).toContain(`Wrapped ETH with transaction hash: ${hash}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amountToWrap: MOCK_AMOUNT,
    };

    const error = new Error("Failed to wrap ETH");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.wrapEth(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: WETH_ADDRESS,
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "deposit",
      }),
      value: BigInt(MOCK_AMOUNT),
    });

    expect(response).toContain(`Error wrapping ETH: ${error}`);
  });
});

describe("supportsNetwork", () => {
  const actionProvider = wethActionProvider();

  it("should return true for base-mainnet", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });
    expect(result).toBe(true);
  });

  it("should return true for base-sepolia", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "base-sepolia",
    });
    expect(result).toBe(true);
  });

  it("should return false for non-base networks", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "ethereum-mainnet",
    });
    expect(result).toBe(false);
  });
});
