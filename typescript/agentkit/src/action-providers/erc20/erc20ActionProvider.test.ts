import { erc20ActionProvider } from "./erc20ActionProvider";
import { TransferSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, Hex } from "viem";
import { abi } from "./constants";

const MOCK_AMOUNT = 15;
const MOCK_DECIMALS = 6;
const MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_DESTINATION = "0x9876543210987654321098765432109876543210";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";

describe("Transfer Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amount: MOCK_AMOUNT,
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_DESTINATION,
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
  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    mockWallet.readContract.mockResolvedValueOnce(MOCK_AMOUNT);
    mockWallet.readContract.mockResolvedValueOnce(MOCK_DECIMALS);

    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
    };

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: args.contractAddress as Hex,
      abi,
      functionName: "balanceOf",
      args: [mockWallet.getAddress()],
    });
    expect(response).toContain(
      `Balance of ${MOCK_CONTRACT_ADDRESS} is ${MOCK_AMOUNT / 10 ** MOCK_DECIMALS}`,
    );
  });

  it("should fail with an error", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
    };

    const error = new Error("Failed to get balance");
    mockWallet.readContract.mockRejectedValue(error);

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: args.contractAddress as Hex,
      abi,
      functionName: "balanceOf",
      args: [mockWallet.getAddress()],
    });

    expect(response).toContain(`Error getting balance: ${error}`);
  });
});

describe("Transfer Action", () => {
  const TRANSACTION_HASH = "0xghijkl987654321";

  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  it("should successfully respond", async () => {
    const args = {
      amount: BigInt(MOCK_AMOUNT),
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_DESTINATION,
    };

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: args.contractAddress as Hex,
      data: encodeFunctionData({
        abi,
        functionName: "transfer",
        args: [args.destination as Hex, BigInt(args.amount)],
      }),
    });
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain(
      `Transferred ${MOCK_AMOUNT} of ${MOCK_CONTRACT_ADDRESS} to ${MOCK_DESTINATION}`,
    );
    expect(response).toContain(`Transaction hash for the transfer: ${TRANSACTION_HASH}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amount: BigInt(MOCK_AMOUNT),
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_DESTINATION,
    };

    const error = new Error("Failed to execute transfer");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: args.contractAddress as Hex,
      data: encodeFunctionData({
        abi,
        functionName: "transfer",
        args: [args.destination as Hex, BigInt(args.amount)],
      }),
    });
    expect(response).toContain(`Error transferring the asset: ${error}`);
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
