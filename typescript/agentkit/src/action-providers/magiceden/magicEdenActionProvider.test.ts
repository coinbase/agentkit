import { Blockchain, EvmBuyParams, MagicEdenSDK } from "@magiceden/magiceden-sdk";
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
  const MOCK_SOLANA_PRIVATE_KEY = "3CCF7x1YckEPTx8QnwQdtUYcABtmQCDkd26UpJBNNfnSnsko6b4uEKTn44FvdL9yKPHkGLjco6yPgaFL79szmV7c";
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
        items: [{
          token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
          quantity: 1,
        }],
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
        items: [{
          token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
          quantity: 1,
        }],
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
        items: [{
          token: `${MOCK_CONTRACT}:${MOCK_TOKEN_ID}`,
          quantity: 1,
        }],
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