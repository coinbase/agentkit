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

  let actionProvider: ReturnType<typeof openseaActionProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    actionProvider = openseaActionProvider({
      apiKey: MOCK_API_KEY,
      privateKey: MOCK_PRIVATE_KEY,
      networkId: "base-sepolia",
    });
  });

  describe("listNft", () => {
    it("should successfully list an NFT", async () => {
      const mockListing = {
        /* mock listing response */
      };
      (OpenSeaSDK.prototype.createListing as jest.Mock).mockResolvedValue(mockListing);

      const args = {
        contractAddress: MOCK_CONTRACT,
        tokenId: MOCK_TOKEN_ID,
        price: MOCK_PRICE,
        expirationDays: MOCK_EXPIRATION_DAYS,
      };

      const response = await actionProvider.listNft(args);

      expect(OpenSeaSDK.prototype.createListing).toHaveBeenCalledWith(
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
        `Successfully listed NFT ${MOCK_CONTRACT} token ${MOCK_TOKEN_ID} for ${MOCK_PRICE} ETH, expiring in ${MOCK_EXPIRATION_DAYS} days`,
      );
    });

    it("should handle listing errors", async () => {
      const error = new Error("Listing failed");
      (OpenSeaSDK.prototype.createListing as jest.Mock).mockRejectedValue(error);

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
      const baseMainnetNetwork: Network = {
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      };

      expect(actionProvider.supportsNetwork(baseSepoliaNetwork)).toBe(true);
      expect(actionProvider.supportsNetwork(baseMainnetNetwork)).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      const ethereumNetwork: Network = {
        protocolFamily: "evm",
        networkId: "ethereum",
        chainId: "1",
      };
      expect(actionProvider.supportsNetwork(ethereumNetwork)).toBe(false);
    });
  });
});
