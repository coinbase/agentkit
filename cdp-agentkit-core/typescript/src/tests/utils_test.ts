import { ContractInvocation, Wallet } from "@coinbase/coinbase-sdk";
import { approve } from "../actions/cdp/utils";

const MOCK_TOKEN_ADDRESS = "0x123456789abcdef";
const MOCK_SPENDER_ADDRESS = "0xabcdef123456789";
const MOCK_AMOUNT = BigInt(1000000);
const TRANSACTION_HASH = "0xghijkl987654321";

describe("Utils - Approve", () => {
  let mockContractInvocation: jest.Mocked<ContractInvocation>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockContractInvocation = {
      wait: jest.fn().mockResolvedValue({
        getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
      }),
    } as unknown as jest.Mocked<ContractInvocation>;

    mockWallet = {
      invokeContract: jest.fn(),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.invokeContract.mockResolvedValue(mockContractInvocation);
  });

  it("should successfully approve tokens", async () => {
    const response = await approve(
      mockWallet,
      MOCK_TOKEN_ADDRESS,
      MOCK_SPENDER_ADDRESS,
      MOCK_AMOUNT,
    );

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_TOKEN_ADDRESS,
      method: "approve",
      abi: expect.any(Array),
      args: {
        spender: MOCK_SPENDER_ADDRESS,
        value: MOCK_AMOUNT.toString(),
      },
    });
    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toBe(
      `Approved ${MOCK_AMOUNT} tokens for ${MOCK_SPENDER_ADDRESS} with transaction hash: ${TRANSACTION_HASH}`,
    );
  });

  it("should handle approval errors", async () => {
    const error = new Error("Approval failed");
    mockWallet.invokeContract.mockRejectedValue(error);

    const response = await approve(
      mockWallet,
      MOCK_TOKEN_ADDRESS,
      MOCK_SPENDER_ADDRESS,
      MOCK_AMOUNT,
    );

    expect(mockWallet.invokeContract).toHaveBeenCalled();
    expect(response).toBe(`Error approving tokens: ${error}`);
  });
});
