import {
  Blockchain,
  EvmBuyParams,
  EvmCreateLaunchpadParams,
  MagicEdenSDK,
  SolanaCreateLaunchpadParams,
  EvmProtocolType,
  SolProtocolType,
  MintStageKind,
  EvmUpdateLaunchpadParams,
  SolanaUpdateLaunchpadParams,
  EvmListParams,
  SolanaListParams,
  EvmCancelListingParams,
  SolanaCancelListingParams,
  EvmMakeItemOfferParams,
  SolanaMakeItemOfferParams,
  EvmTakeItemOfferParams,
  SolanaTakeItemOfferParams,
  EvmCancelItemOfferParams,
  SolanaCancelItemOfferParams,
} from "@magiceden/magiceden-sdk";
import { magicEdenActionProvider } from "./magicEdenActionProvider";
import { Network } from "../../network";

jest.mock("@magiceden/magiceden-sdk", () => ({
  ...jest.requireActual("@magiceden/magiceden-sdk"),
  MagicEdenSDK: {
    v1: {
      createSolanaKeypairClient: jest.fn(),
      createViemEvmClient: jest.fn(),
    },
  },
}));

describe("MagicEden Action Provider", () => {
  const MOCK_API_KEY = "test-api-key";
  const MOCK_SOLANA_PRIVATE_KEY =
    "3CCF7x1YckEPTx8QnwQdtUYcABtmQCDkd26UpJBNNfnSnsko6b4uEKTn44FvdL9yKPHkGLjco6yPgaFL79szmV7c";
  const MOCK_EVM_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const MOCK_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_TOKEN_ID = "1";
  const MOCK_RPC_URL = "https://api.mainnet-beta.solana.com";

  let actionProvider: ReturnType<typeof magicEdenActionProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default client implementations
    (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
      nft: {
        buy: jest.fn(),
      },
    }));

    (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
      nft: {
        buy: jest.fn(),
      },
    }));
  });

  describe("createLaunchpad", () => {
    it("should successfully create a launchpad on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockCreateLaunchpad = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          createLaunchpad: mockCreateLaunchpad,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaCreateLaunchpadParams = {
        chain: Blockchain.SOLANA,
        protocol: SolProtocolType.METAPLEX_CORE,
        creator: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
        name: "TestCollection",
        symbol: "TEST",
        description: "This is a test collection created with the Magic Eden self-serve API",
        nftMetadataUrl:
          "https://bafybeic3rs6wmnnhqachwxsiizlblignek6aitc5b3ooenhhtkez3onmwu.ipfs.w3s.link",
        royaltyBps: 500,
        royaltyRecipients: [
          {
            address: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
            share: 100,
          },
        ],
        payoutRecipient: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
        social: {
          discordUrl: "https://discord.gg/magiceden",
          twitterUsername: "magiceden",
          externalUrl: "https://magiceden.io",
        },
        mintStages: {
          maxSupply: 10000,
          stages: [
            {
              kind: MintStageKind.Public,
              price: {
                currency: {
                  chain: Blockchain.SOLANA,
                  assetId: "So11111111111111111111111111111111111111112",
                },
                raw: "1",
              },
              startTime: "2025-03-28T00:00:00.000Z",
              endTime: "2030-03-30T00:00:00.000Z",
              walletLimit: 10,
            },
          ],
        },
        isOpenEdition: false,
      };

      const response = await actionProvider.createLaunchpad(args);

      expect(mockCreateLaunchpad).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully created launchpad.\nTransactions: [solana-tx-id]");
    });

    it("should successfully create a launchpad on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockCreateLaunchpad = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          createLaunchpad: mockCreateLaunchpad,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmCreateLaunchpadParams = {
        chain: Blockchain.BASE,
        protocol: EvmProtocolType.ERC1155,
        creator: "0x1234567890123456789012345678901234567890",
        name: "TestCollection",
        symbol: "TEST",
        description: "This is a test collection created with the Magic Eden self-serve API",
        nftMetadataUrl:
          "https://bafybeic3rs6wmnnhqachwxsiizlblignek6aitc5b3ooenhhtkez3onmwu.ipfs.w3s.link",
        royaltyBps: 500,
        royaltyRecipients: [
          {
            address: "0x1234567890123456789012345678901234567890",
            share: 100,
          },
        ],
        payoutRecipient: "0x1234567890123456789012345678901234567890",
        mintStages: {
          tokenId: 0,
          maxSupply: 10000,
          walletLimit: 10,
          stages: [
            {
              kind: MintStageKind.Public,
              price: {
                currency: {
                  chain: Blockchain.BASE,
                  assetId: "0x0000000000000000000000000000000000000000",
                },
                raw: "1",
              },
              startTime: "2025-03-28T00:00:00.000Z",
              endTime: "2030-03-30T00:00:00.000Z",
              walletLimit: 10,
            },
          ],
        },
      };

      const response = await actionProvider.createLaunchpad(args);

      expect(mockCreateLaunchpad).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully created launchpad.\nTransactions: [evm-tx-id]");
    });
  });

  describe("updateLaunchpad", () => {
    it("should successfully update a launchpad on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockUpdateLaunchpad = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          updateLaunchpad: mockUpdateLaunchpad,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaUpdateLaunchpadParams = {
        chain: Blockchain.SOLANA,
        protocol: SolProtocolType.METAPLEX_CORE,
        collectionId: "collection123",
        owner: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
        payer: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
        symbol: "TEST2",
        newSymbol: "TEST",
        candyMachineId: "candy123",
        name: "TestCollection",
        payoutRecipient: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
        royaltyRecipients: [
          {
            address: "DRnGhQzbhxB8FsKdkTZRNqkJhGzPFhxGtxVXkqgXVGZv",
            share: 100,
          },
        ],
      };

      const response = await actionProvider.updateLaunchpad(args);

      expect(mockUpdateLaunchpad).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully updated launchpad.\nTransactions: [solana-tx-id]");
    });

    it("should successfully update a launchpad on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockUpdateLaunchpad = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          updateLaunchpad: mockUpdateLaunchpad,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmUpdateLaunchpadParams = {
        chain: Blockchain.BASE,
        protocol: EvmProtocolType.ERC1155,
        tokenId: 0,
        collectionId: "0x949de1b4d4cc4a8e63b7565b6dc525d8eb5dd15a",
        owner: "0x1234567890123456789012345678901234567890",
        name: "TestCollection2",
        payoutRecipient: "0x1234567890123456789012345678901234567890",
      };

      const response = await actionProvider.updateLaunchpad(args);

      expect(mockUpdateLaunchpad).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully updated launchpad.\nTransactions: [evm-tx-id]");
    });
  });

  describe("listNft", () => {
    it("should successfully list an NFT on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockList = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          list: mockList,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaListParams = {
        token: "7um9nU7CDhss1fepFMRpjHhB3qm7exfQf47cdbRSUGuS",
        price: "1000000000", // 1 SOL in lamports
      };

      const response = await actionProvider.listNft(args);

      expect(mockList).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully listed NFT.\nTransactions: [solana-tx-id]");
    });

    it("should successfully list an NFT on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockList = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          list: mockList,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmListParams = {
        chain: Blockchain.BASE,
        params: [
          {
            token: "0x949de1b4d4cc4a8e63b7565b6dc525d8eb5dd15a:0",
            price: "10000000012",
          },
        ],
      };

      const response = await actionProvider.listNft(args);

      expect(mockList).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully listed NFT.\nTransactions: [evm-tx-id]");
    });
  });

  describe("cancelListing", () => {
    it("should successfully cancel a listing on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockCancelListing = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          cancelListing: mockCancelListing,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaCancelListingParams = {
        token: "7um9nU7CDhss1fepFMRpjHhB3qm7exfQf47cdbRSUGuS",
        price: "1000000000", // 1 SOL in lamports
      };

      const response = await actionProvider.cancelListing(args);

      expect(mockCancelListing).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully canceled listing.\nTransactions: [solana-tx-id]");
    });

    it("should successfully cancel a listing on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockCancelListing = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          cancelListing: mockCancelListing,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmCancelListingParams = {
        chain: Blockchain.BASE,
        orderIds: ["0xc34124b0276f92ca985c2b7e25e9a5c3164c5aa45a2fe1ff1ac6c33b4665649c"],
      };

      const response = await actionProvider.cancelListing(args);

      expect(mockCancelListing).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully canceled listing.\nTransactions: [evm-tx-id]");
    });
  });

  describe("makeItemOffer", () => {
    it("should successfully make an offer on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockMakeOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          makeItemOffer: mockMakeOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaMakeItemOfferParams = {
        token: "7YCrxt8Ux9dym832BKLDQQWJYZ2uziXgbF6cYfZaChdP",
        price: "900000", // 0.0009 SOL in lamports
      };

      const response = await actionProvider.makeItemOffer(args);

      expect(mockMakeOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully made item offer.\nTransactions: [solana-tx-id]");
    });

    it("should successfully make an offer on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockMakeOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          makeItemOffer: mockMakeOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmMakeItemOfferParams = {
        chain: Blockchain.BASE,
        params: [
          {
            token: "0x1195cf65f83b3a5768f3c496d3a05ad6412c64b7:304163",
            price: "9000",
          },
        ],
      };

      const response = await actionProvider.makeItemOffer(args);

      expect(mockMakeOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully made item offer.\nTransactions: [evm-tx-id]");
    });
  });

  describe("takeItemOffer", () => {
    it("should successfully take an offer on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockTakeOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          takeItemOffer: mockTakeOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaTakeItemOfferParams = {
        token: "7um9nU7CDhss1fepFMRpjHhB3qm7exfQf47cdbRSUGuS",
        buyer: "4H2bigFBsMoTAwkn7THDnThiRQuLCrFDGUWHf4YDpf14",
        price: "1500000", // Original offer price
        newPrice: "1000000", // Accepted price
      };

      const response = await actionProvider.takeItemOffer(args);

      expect(mockTakeOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully took item offer.\nTransactions: [solana-tx-id]");
    });

    it("should successfully take an offer on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockTakeOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          takeItemOffer: mockTakeOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmTakeItemOfferParams = {
        chain: Blockchain.BASE,
        items: [
          {
            token: "0x949de1b4d4cc4a8e63b7565b6dc525d8eb5dd15a:0",
            quantity: 1,
            orderId: "0x18fc51e19bc96bc07b9bdd804eb055a691e46e3cd2c37a5d7e53daedebae70c4",
          },
        ],
      };

      const response = await actionProvider.takeItemOffer(args);

      expect(mockTakeOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully took item offer.\nTransactions: [evm-tx-id]");
    });
  });

  describe("cancelItemOffer", () => {
    it("should successfully cancel an offer on Solana", async () => {
      const mockResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockCancelOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          cancelItemOffer: mockCancelOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args: SolanaCancelItemOfferParams = {
        token: "7YCrxt8Ux9dym832BKLDQQWJYZ2uziXgbF6cYfZaChdP",
        price: "900000", // 0.0009 SOL in lamports
      };

      const response = await actionProvider.cancelItemOffer(args);

      expect(mockCancelOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully canceled item offer.\nTransactions: [solana-tx-id]");
    });

    it("should successfully cancel an offer on EVM", async () => {
      const mockResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockCancelOffer = jest.fn().mockResolvedValue(mockResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          cancelItemOffer: mockCancelOffer,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmCancelItemOfferParams = {
        chain: Blockchain.BASE,
        orderIds: ["0x18fc51e19bc96bc07b9bdd804eb055a691e46e3cd2c37a5d7e53daedebae70c4"],
      };

      const response = await actionProvider.cancelItemOffer(args);

      expect(mockCancelOffer).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully canceled item offer.\nTransactions: [evm-tx-id]");
    });
  });

  describe("buy", () => {
    it("should successfully buy an NFT on Solana", async () => {
      const mockBuyResponse = [{ status: "success", txId: "solana-tx-id" }];
      const mockBuy = jest.fn().mockResolvedValue(mockBuyResponse);

      (MagicEdenSDK.v1.createSolanaKeypairClient as jest.Mock).mockImplementation(() => ({
        nft: {
          buy: mockBuy,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const args = {
        token: "solana-mint-address",
        seller: "seller-wallet-address",
        price: "0.5",
      };

      const response = await actionProvider.buy(args);

      expect(mockBuy).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully bought NFT.\nTransactions: [solana-tx-id]");
    });

    it("should successfully buy an NFT on EVM", async () => {
      const mockBuyResponse = [{ status: "success", txId: "evm-tx-id" }];
      const mockBuy = jest.fn().mockResolvedValue(mockBuyResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          buy: mockBuy,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmBuyParams = {
        chain: Blockchain.BASE,
        items: [
          {
            token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
            quantity: 1,
          },
        ],
      };

      const response = await actionProvider.buy(args);

      expect(mockBuy).toHaveBeenCalledWith(args);
      expect(response).toBe("Successfully bought NFT.\nTransactions: [evm-tx-id]");
    });

    it("should handle failed transactions", async () => {
      const mockBuyResponse = [{ status: "failed", error: "Insufficient funds" }];
      const mockBuy = jest.fn().mockResolvedValue(mockBuyResponse);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          buy: mockBuy,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmBuyParams = {
        chain: Blockchain.BASE,
        items: [
          {
            token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
            quantity: 1,
          },
        ],
      };

      const response = await actionProvider.buy(args);

      expect(mockBuy).toHaveBeenCalledWith(args);
      expect(response).toBe("Failed to buy NFT: Insufficient funds");
    });

    it("should handle errors during buy operation", async () => {
      const error = new Error("API error");
      const mockBuy = jest.fn().mockRejectedValue(error);

      (MagicEdenSDK.v1.createViemEvmClient as jest.Mock).mockImplementation(() => ({
        nft: {
          buy: mockBuy,
        },
      }));

      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const args: EvmBuyParams = {
        chain: Blockchain.BASE,
        items: [
          {
            token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
            quantity: 1,
          },
        ],
      };

      const response = await actionProvider.buy(args);

      expect(mockBuy).toHaveBeenCalledWith(args);
      expect(response).toBe("Error buying NFT: Error: API error");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for supported EVM networks", () => {
      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const baseNetwork: Network = {
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      };

      expect(actionProvider.supportsNetwork(baseNetwork)).toBe(true);
    });

    it("should return true for supported Solana networks", () => {
      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_SOLANA_PRIVATE_KEY,
        networkId: "solana-mainnet",
        rpcUrl: MOCK_RPC_URL,
      });

      const solanaNetwork: Network = {
        protocolFamily: "svm",
        networkId: "solana-mainnet",
      };

      expect(actionProvider.supportsNetwork(solanaNetwork)).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      actionProvider = magicEdenActionProvider({
        apiKey: MOCK_API_KEY,
        privateKey: MOCK_EVM_PRIVATE_KEY,
        networkId: "base-mainnet",
      });

      const unsupportedNetwork: Network = {
        protocolFamily: "evm",
        networkId: "base_sepolia",
        chainId: "84532",
      };

      expect(actionProvider.supportsNetwork(unsupportedNetwork)).toBe(false);
    });
  });
});
