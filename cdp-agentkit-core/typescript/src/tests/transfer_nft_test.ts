import { ContractInvocation, Wallet } from "@coinbase/coinbase-sdk";

import { transferNft, TransferNftInput } from "../actions/cdp/transfer_nft";

const MOCK_CONTRACT_ADDRESS = "0x123456789abcdef";
const MOCK_TOKEN_ID = "1000";
const MOCK_DESTINATION = "0xabcdef123456789";
const MOCK_FROM_ADDRESS = "0xdefault123456789";

describe("Transfer NFT Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      tokenId: MOCK_TOKEN_ID,
      destination: MOCK_DESTINATION,
      fromAddress: MOCK_FROM_ADDRESS,
    };

    const result = TransferNftInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should successfully parse input without optional fromAddress", () => {
    const validInput = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      tokenId: MOCK_TOKEN_ID,
      destination: MOCK_DESTINATION,
    };

    const result = TransferNftInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = TransferNftInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Transfer NFT Action", () => {
  const TRANSACTION_HASH = "0xghijkl987654321";
  const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

  let mockContractInvocation: jest.Mocked<ContractInvocation>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockContractInvocation = {
      wait: jest.fn().mockResolvedValue({
        getTransaction: jest.fn().mockReturnValue({
          getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
          getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
        }),
      }),
    } as unknown as jest.Mocked<ContractInvocation>;

    mockWallet = {
      invokeContract: jest.fn(),
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: jest.fn().mockReturnValue(MOCK_FROM_ADDRESS),
      }),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.invokeContract.mockResolvedValue(mockContractInvocation);
  });

  it("should successfully transfer NFT with provided fromAddress", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      tokenId: MOCK_TOKEN_ID,
      destination: MOCK_DESTINATION,
      fromAddress: MOCK_FROM_ADDRESS,
    };

    const response = await transferNft(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_CONTRACT_ADDRESS,
      method: "transferFrom",
      args: {
        from: MOCK_FROM_ADDRESS,
        to: MOCK_DESTINATION,
        tokenId: MOCK_TOKEN_ID,
      },
    });
    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toContain(
      `Transferred NFT (ID: ${MOCK_TOKEN_ID}) from contract ${MOCK_CONTRACT_ADDRESS} to ${MOCK_DESTINATION}`,
    );
    expect(response).toContain(`Transaction hash: ${TRANSACTION_HASH}`);
    expect(response).toContain(`Transaction link: ${TRANSACTION_LINK}`);
  });

  it("should successfully transfer NFT with default address", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      tokenId: MOCK_TOKEN_ID,
      destination: MOCK_DESTINATION,
    };

    const response = await transferNft(mockWallet, args);

    expect(mockWallet.getDefaultAddress).toHaveBeenCalled();
    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_CONTRACT_ADDRESS,
      method: "transferFrom",
      args: {
        from: MOCK_FROM_ADDRESS,
        to: MOCK_DESTINATION,
        tokenId: MOCK_TOKEN_ID,
      },
    });
    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toContain(
      `Transferred NFT (ID: ${MOCK_TOKEN_ID}) from contract ${MOCK_CONTRACT_ADDRESS} to ${MOCK_DESTINATION}`,
    );
  });

  it("should fail with an error", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      tokenId: MOCK_TOKEN_ID,
      destination: MOCK_DESTINATION,
    };

    const error = new Error("Failed to transfer NFT");
    mockWallet.invokeContract.mockRejectedValue(error);

    const response = await transferNft(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalled();
    expect(response).toContain(
      `Error transferring the NFT (contract: ${MOCK_CONTRACT_ADDRESS}, ID: ${MOCK_TOKEN_ID}) from ${MOCK_FROM_ADDRESS} to ${MOCK_DESTINATION}): ${error}`,
    );
  });
});
