import { Coinbase, ContractInvocation, Wallet } from "@coinbase/coinbase-sdk";

import { mintNft, MintNftInput } from "../actions/cdp/mint_nft";

const MOCK_CONTRACT_ADDRESS = "0x123456789abcdef";
const MOCK_CONTRACT_DESTINATION = "0xabcdef123456789";

describe("Mint NFT Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_CONTRACT_DESTINATION,
    };

    const result = MintNftInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = MintNftInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Mint NFT Action", () => {
  const NETWORK_ID = Coinbase.networks.BaseSepolia;
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
      getNetworkId: jest.fn().mockReturnValue(NETWORK_ID),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.invokeContract.mockResolvedValue(mockContractInvocation);
  });

  it("should successfully respond", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_CONTRACT_DESTINATION,
    };

    const response = await mintNft(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_CONTRACT_ADDRESS,
      method: "mint",
      args: {
        to: MOCK_CONTRACT_DESTINATION,
        quantity: "1",
      },
    });
    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toContain(`Minted NFT from contract ${MOCK_CONTRACT_ADDRESS}`);
    expect(response).toContain(`to address ${MOCK_CONTRACT_DESTINATION}`);
    expect(response).toContain(`on network ${NETWORK_ID}`);
    expect(response).toContain(`Transaction hash for the mint: ${TRANSACTION_HASH}`);
    expect(response).toContain(`Transaction link for the mint: ${TRANSACTION_LINK}`);
  });

  it("should fail with an error", async () => {
    const args = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_CONTRACT_DESTINATION,
    };

    const error = new Error("An error has occurred");
    mockWallet.invokeContract.mockRejectedValue(error);

    const response = await mintNft(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalled();
    expect(response).toContain(`Error minting NFT: ${error}`);
  });
});
