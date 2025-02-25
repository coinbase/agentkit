import { OpenSeaSDK } from "opensea-js";
import { openseaActionProvider } from "./openseaActionProvider";
import { Network } from "../../network";

jest.mock("opensea-js");

describe("OpenSea Action Provider", () => {
  const MOCK_API_KEY = "test-api-key";
  const MOCK_PRIVATE_KEY = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const MOCK_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_TOKEN_ID = "1";
  const MOCK_PRICE = 0.1;
  const MOCK_EXPIRATION_DAYS = 90;
  const MOCK_OPENSEA_BASE_URL = "https://testnets.opensea.io";
  const MOCK_OPENSEA_CHAIN = "base_sepolia";

  let actionProvider: ReturnType<typeof openseaActionProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock OpenSeaSDK constructor
    (OpenSeaSDK as jest.Mock).mockImplementation(() => ({
      createListing: jest.fn(),
      api: {
        apiBaseUrl: MOCK_OPENSEA_BASE_URL,
      },
      chain: MOCK_OPENSEA_CHAIN,
    }));
    actionProvider = openseaActionProvider({
      apiKey: MOCK_API_KEY,
      privateKey: MOCK_PRIVATE_KEY,
      networkId: "base-sepolia",
    });
  });

  describe("listNft", () => {
    it("should successfully list an NFT", async () => {
      const mockListing = {};
      const mockCreateListing = jest.fn().mockResolvedValue(mockListing);

      // Update the mock implementation with the mock function
      (OpenSeaSDK as jest.Mock).mockImplementation(() => ({
        createListing: mockCreateListing,
        api: {
          apiBaseUrl: MOCK_OPENSEA_BASE_URL,
        },
        chain: MOCK_OPENSEA_CHAIN,
      }));

      // Re-create provider with new mock
      actionProvider = openseaActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_PRIVATE_KEY,
        networkId: "base-sepolia",
      });

      const args = {
        contractAddress: MOCK_CONTRACT,
        tokenId: MOCK_TOKEN_ID,
        price: MOCK_PRICE,
        expirationDays: MOCK_EXPIRATION_DAYS,
      };

      const response = await actionProvider.listNft(args);

      expect(mockCreateListing).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: {
            tokenId: MOCK_TOKEN_ID,
            tokenAddress: MOCK_CONTRACT,
          },
          startAmount: MOCK_PRICE,
          quantity: 1,
        }),
      );

      expect(response).toBe(
        `Successfully listed NFT ${MOCK_CONTRACT} token ${MOCK_TOKEN_ID} for ${MOCK_PRICE} ETH, expiring in ${MOCK_EXPIRATION_DAYS} days. Listing on OpenSea: ${MOCK_OPENSEA_BASE_URL}/assets/${MOCK_OPENSEA_CHAIN}/${MOCK_CONTRACT}/${MOCK_TOKEN_ID}.`,
      );
    });

    it("should handle listing errors", async () => {
      const error = new Error("Listing failed");
      const mockCreateListing = jest.fn().mockRejectedValue(error);

      // Update the mock implementation with the mock function
      (OpenSeaSDK as jest.Mock).mockImplementation(() => ({
        createListing: mockCreateListing,
        api: {
          apiBaseUrl: MOCK_OPENSEA_BASE_URL,
        },
        chain: MOCK_OPENSEA_CHAIN,
      }));

      // Re-create provider with new mock
      actionProvider = openseaActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_PRIVATE_KEY,
        networkId: "base-sepolia",
      });

      const args = {
        contractAddress: MOCK_CONTRACT,
        tokenId: MOCK_TOKEN_ID,
        price: MOCK_PRICE,
        expirationDays: MOCK_EXPIRATION_DAYS,
      };

      const response = await actionProvider.listNft(args);
      expect(response).toContain(`Error listing NFT ${MOCK_CONTRACT} token ${MOCK_TOKEN_ID}`);
      expect(response).toContain(error.message);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for supported networks", () => {
      const baseSepoliaNetwork: Network = {
        protocolFamily: "evm",
        networkId: "base-sepolia",
        chainId: "84532",
      };
      expect(actionProvider.supportsNetwork(baseSepoliaNetwork)).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      const fantomNetwork: Network = {
        protocolFamily: "bitcoin",
        networkId: "any",
      };
      expect(actionProvider.supportsNetwork(fantomNetwork)).toBe(false);
    });
  });
});
