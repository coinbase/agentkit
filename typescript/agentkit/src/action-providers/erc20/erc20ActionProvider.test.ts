import { erc20ActionProvider } from "./erc20ActionProvider";
import { TransferSchema, GetTokenAddressSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

const MOCK_AMOUNT = 15;
const MOCK_DECIMALS = 6;
const MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_DESTINATION = "0x9876543210987654321098765432109876543210";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";

describe("Transfer Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amount: MOCK_AMOUNT.toString(),
      tokenAddress: MOCK_CONTRACT_ADDRESS,
      destinationAddress: MOCK_DESTINATION,
    };

    const result = TransferSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = TransferSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Balance Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockMulticall: jest.Mock;
  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockMulticall = jest.fn();
    const mockPublicClient = {
      multicall: mockMulticall,
      getCode: jest.fn().mockResolvedValue("0x"),
    };

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    mockMulticall.mockResolvedValueOnce([
      { result: "MockToken" }, // name
      { result: MOCK_DECIMALS }, // decimals
      { result: BigInt(MOCK_AMOUNT * 10 ** MOCK_DECIMALS) }, // balance
    ]);

    const args = {
      tokenAddress: MOCK_CONTRACT_ADDRESS,
    };

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockMulticall).toHaveBeenCalled();
    expect(response).toContain(
      `Balance of MockToken (${MOCK_CONTRACT_ADDRESS}) at address ${MOCK_ADDRESS} is ${MOCK_AMOUNT}`,
    );
  });

  it("should fail with an error", async () => {
    const args = {
      tokenAddress: MOCK_CONTRACT_ADDRESS,
    };

    mockMulticall.mockRejectedValue(new Error("Failed to get balance"));

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockMulticall).toHaveBeenCalled();

    expect(response).toContain("Error: Could not fetch token details");
  });
});

describe("Transfer Action", () => {
  const TRANSACTION_HASH = "0xghijkl987654321";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockMulticall: jest.Mock;

  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockMulticall = jest.fn();
    const mockPublicClient = {
      multicall: mockMulticall,
      getCode: jest.fn().mockResolvedValue("0x"),
    };

    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        networkId: "base-mainnet",
      }),
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  it("should successfully respond", async () => {
    mockMulticall.mockResolvedValueOnce([
      { result: "MockToken" }, // name
      { result: MOCK_DECIMALS }, // decimals
      { result: BigInt(100000 * 10 ** MOCK_DECIMALS) }, // balance
    ]);

    const args = {
      amount: MOCK_AMOUNT.toString(),
      tokenAddress: MOCK_CONTRACT_ADDRESS,
      destinationAddress: MOCK_DESTINATION,
    };

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockMulticall).toHaveBeenCalled();
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain(
      `Transferred ${MOCK_AMOUNT} of MockToken (${MOCK_CONTRACT_ADDRESS}) to ${MOCK_DESTINATION}`,
    );
    expect(response).toContain(`Transaction hash for the transfer: ${TRANSACTION_HASH}`);
  });

  it("should fail with an error", async () => {
    mockMulticall.mockRejectedValue(new Error("Failed to get token details"));

    const args = {
      amount: MOCK_AMOUNT.toString(),
      tokenAddress: MOCK_CONTRACT_ADDRESS,
      destinationAddress: MOCK_DESTINATION,
    };

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockMulticall).toHaveBeenCalled();
    expect(response).toContain("Error: Could not fetch token details");
  });

  describe("supportsNetwork", () => {
    it("should return true when protocolFamily is evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false when protocolFamily is not evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });
});

describe("GetTokenAddress Schema", () => {
  it("should successfully parse valid token symbol", () => {
    const validInput = { symbol: "usdc" };
    const result = GetTokenAddressSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.symbol).toBe("USDC"); // Should be uppercase
  });

  it("should fail parsing empty symbol", () => {
    const emptyInput = { symbol: "" };
    const result = GetTokenAddressSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });

  it("should fail parsing symbol too long", () => {
    const longInput = { symbol: "VERYLONGTOKENSYMBOL" };
    const result = GetTokenAddressSchema.safeParse(longInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Token Address Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = erc20ActionProvider();

  beforeEach(() => {
    mockWallet = {
      getNetwork: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should return token address for valid symbol on base-mainnet", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain(
      "Token address for USDC on base-mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    );
  });

  it("should return token address for valid symbol on base-sepolia", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-sepolia",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "EURC" });
    expect(response).toContain(
      "Token address for EURC on base-sepolia: 0x808456652fdb597867f38412077A9182bf77359F",
    );
  });

  it("should return error for unsupported network", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "unsupported-network",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain('Error: Token symbol "USDC" not found on unsupported-network');
  });

  it("should return error for unknown token symbol", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "UNKNOWN" });
    expect(response).toContain('Error: Token symbol "UNKNOWN" not found on base-mainnet');
    expect(response).toContain('Error: Token symbol "UNKNOWN" not found on base-mainnet');
  });

  it("should return error when network ID is not available", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      // networkId is undefined
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain('Error: Token symbol "USDC" not found on undefined');
  });
});
