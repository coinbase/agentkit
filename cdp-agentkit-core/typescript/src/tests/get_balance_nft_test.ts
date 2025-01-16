import { GetBalanceNftInput, getBalanceNft } from "../actions/cdp/get_balance_nft";
import { Wallet } from "@coinbase/coinbase-sdk";
import { readContract } from "@coinbase/coinbase-sdk";

const MOCK_CONTRACT_ADDRESS = "0xvalidContractAddress";
const MOCK_ADDRESS = "0xvalidAddress";
const MOCK_TOKEN_IDS = ["1", "2", "3"];

jest.mock("@coinbase/coinbase-sdk", () => ({
  ...jest.requireActual("@coinbase/coinbase-sdk"),
  readContract: jest.fn(),
}));

describe("GetBalanceNft", () => {
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockWallet = {
      getDefaultAddress: jest.fn().mockResolvedValue({ getId: () => MOCK_ADDRESS }),
      getNetworkId: jest.fn().mockReturnValue("base-sepolia"),
    } as unknown as jest.Mocked<Wallet>;

    (readContract as jest.Mock).mockClear();
  });

  it("should validate input schema with all parameters", () => {
    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      address: MOCK_ADDRESS,
    };

    const result = GetBalanceNftInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate input schema with required parameters only", () => {
    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
    };

    const result = GetBalanceNftInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should fail validation with missing required parameters", () => {
    const input = {};

    const result = GetBalanceNftInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should successfully get NFT balance using default address", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(MOCK_TOKEN_IDS);

    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
    };

    const response = await getBalanceNft(mockWallet, input);

    expect(mockWallet.getDefaultAddress).toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledWith({
      contractAddress: MOCK_CONTRACT_ADDRESS,
      networkId: "base-sepolia",
      method: "tokensOfOwner",
      args: { owner: MOCK_ADDRESS },
    });

    expect(response).toBe(
      `Address ${MOCK_ADDRESS} owns ${MOCK_TOKEN_IDS.length} NFTs in contract ${MOCK_CONTRACT_ADDRESS}.\n` +
        `Token IDs: ${MOCK_TOKEN_IDS.join(", ")}`,
    );
  });

  it("should handle case when no tokens are owned", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce([]);

    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      address: MOCK_ADDRESS,
    };

    const response = await getBalanceNft(mockWallet, input);

    expect(response).toBe(
      `Address ${MOCK_ADDRESS} owns no NFTs in contract ${MOCK_CONTRACT_ADDRESS}`,
    );
  });

  it("should get NFT balance with specific address", async () => {
    const customAddress = "0xcustomAddress";
    (readContract as jest.Mock).mockResolvedValueOnce(MOCK_TOKEN_IDS);

    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      address: customAddress,
    };

    const response = await getBalanceNft(mockWallet, input);

    expect(readContract).toHaveBeenCalledWith({
      contractAddress: MOCK_CONTRACT_ADDRESS,
      networkId: "base-sepolia",
      method: "tokensOfOwner",
      args: { owner: customAddress },
    });

    expect(response).toBe(
      `Address ${customAddress} owns ${MOCK_TOKEN_IDS.length} NFTs in contract ${MOCK_CONTRACT_ADDRESS}.\n` +
        `Token IDs: ${MOCK_TOKEN_IDS.join(", ")}`,
    );
  });

  it("should handle API errors gracefully", async () => {
    const errorMessage = "API error";
    (readContract as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const input = {
      contractAddress: MOCK_CONTRACT_ADDRESS,
      address: MOCK_ADDRESS,
    };

    const response = await getBalanceNft(mockWallet, input);

    expect(response).toBe(
      `Error getting NFT balance for address ${MOCK_ADDRESS} in contract ${MOCK_CONTRACT_ADDRESS}: Error: ${errorMessage}`,
    );
  });
});
