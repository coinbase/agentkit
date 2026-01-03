import { WrapEthSchema, UnwrapEthSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, parseUnits, erc20Abi } from "viem";
import { WETH_ABI } from "./constants";
import { wethActionProvider, getWethAddress } from "./wethActionProvider";

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

describe("Unwrap Eth Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amountToUnwrap: MOCK_AMOUNT,
    };

    const result = UnwrapEthSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = UnwrapEthSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Wrap Eth Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = wethActionProvider();

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
      getBalance: jest.fn().mockResolvedValue(parseUnits("20", 18)), // 20 ETH balance
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
      to: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "deposit",
      }),
      value: parseUnits(MOCK_AMOUNT, 18),
    });
    expect(response).toContain(`Wrapped ${MOCK_AMOUNT} ETH to WETH. Transaction hash: ${hash}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amountToWrap: MOCK_AMOUNT,
    };

    const error = new Error("Failed to wrap ETH");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.wrapEth(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "deposit",
      }),
      value: parseUnits(MOCK_AMOUNT, 18),
    });

    expect(response).toContain(`Error wrapping ETH: ${error}`);
  });

  it("should fail with insufficient ETH balance", async () => {
    const args = {
      amountToWrap: MOCK_AMOUNT,
    };

    // Mock insufficient balance (less than 15 ETH)
    mockWallet.getBalance.mockResolvedValue(parseUnits("10", 18));

    const response = await actionProvider.wrapEth(mockWallet, args);

    expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    expect(response).toContain("Error: Insufficient ETH balance");
  });
});

describe("Unwrap Eth Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = wethActionProvider();

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
      readContract: jest.fn().mockResolvedValue(parseUnits("20", 18)), // 20 WETH balance
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    const args = {
      amountToUnwrap: MOCK_AMOUNT,
    };

    const hash = "0x1234567890123456789012345678901234567890";
    mockWallet.sendTransaction.mockResolvedValue(hash);

    const response = await actionProvider.unwrapEth(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [MOCK_ADDRESS],
    });
    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [parseUnits(MOCK_AMOUNT, 18)],
      }),
    });
    expect(response).toContain(`Unwrapped ${MOCK_AMOUNT} WETH to ETH. Transaction hash: ${hash}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amountToUnwrap: MOCK_AMOUNT,
    };

    const error = new Error("Failed to unwrap WETH");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.unwrapEth(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [MOCK_ADDRESS],
    });
    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: getWethAddress({ protocolFamily: "evm", networkId: "base-mainnet" }),
      data: encodeFunctionData({
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [parseUnits(MOCK_AMOUNT, 18)],
      }),
    });

    expect(response).toContain(`Error unwrapping WETH: ${error}`);
  });

  it("should fail with insufficient WETH balance", async () => {
    const args = {
      amountToUnwrap: MOCK_AMOUNT,
    };

    // Mock insufficient WETH balance (less than 15 WETH)
    mockWallet.readContract.mockResolvedValue(parseUnits("10", 18));

    const response = await actionProvider.unwrapEth(mockWallet, args);

    expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    expect(response).toContain("Error: Insufficient WETH balance");
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

  it("should return true for ethereum-mainnet", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "ethereum-mainnet",
    });
    expect(result).toBe(true);
  });

  it("should return false for networks without WETH", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "polygon-mainnet",
    });
    expect(result).toBe(false);
  });
});
