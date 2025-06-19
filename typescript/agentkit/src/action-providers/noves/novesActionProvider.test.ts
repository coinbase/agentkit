import { NovesActionProvider } from "./novesActionProvider";

const mockGetRecentTxs = jest.fn();
const mockGetTranslatedTx = jest.fn();
const mockGetTokenPrice = jest.fn();

jest.mock("@noves/intent-ethers-provider", () => {
  return {
    IntentProvider: jest.fn().mockImplementation(() => ({
      getRecentTxs: mockGetRecentTxs,
      getTranslatedTx: mockGetTranslatedTx,
      getTokenPrice: mockGetTokenPrice,
    })),
  };
});

describe("NovesActionProvider", () => {
  let actionProvider: NovesActionProvider;

  /**
   * Set up test environment before each test.
   * Initializes mocks and creates fresh instances of required objects.
   */
  beforeEach(() => {
    jest.clearAllMocks();
    actionProvider = new NovesActionProvider();
  });

  describe("supportsNetwork", () => {
    /**
     * Test that the provider correctly supports all networks
     */
    it("should return true for all networks", () => {
      expect(actionProvider.supportsNetwork()).toBe(true);
    });
  });

  describe("getRecentTransactions", () => {
    const recentTxsArgs = {
      chain: "base",
      wallet: "0x2748f93c54042bfbe8691cdf3bd19adb12f7cfa0e30ea38128c5ed606b7a7f44",
    };

    const mockRecentTxs = [
      {
        txTypeVersion: 2,
        chain: "base",
        accountAddress: "0x2748f93c54042bfbe8691cdf3bd19adb12f7cfa0e30ea38128c5ed606b7a7f44",
        classificationData: {
          type: "transfer",
          source: { type: "inference" },
          description: "Transferred 1 ETH",
          protocol: { name: null },
          sent: [],
          received: [],
        },
        rawTransactionData: {
          transactionHash: "0x1234567890abcdef",
          fromAddress: "0x2748f93c54042bfbe8691cdf3bd19adb12f7cfa0e30ea38128c5ed606b7a7f44",
          toAddress: "0x9876543210abcdef",
          blockNumber: 26586523,
          gas: 5000000,
          gasUsed: 377942,
          gasPrice: 1826005,
          transactionFee: {
            amount: "0.000000693359358418",
            token: { symbol: "ETH", name: "ETH", decimals: 18, address: "ETH" },
          },
          timestamp: 1739962393,
        },
      },
    ];

    it("should get recent transactions successfully", async () => {
      mockGetRecentTxs.mockResolvedValue(mockRecentTxs);
      const result = await actionProvider.getRecentTransactions(recentTxsArgs);

      expect(mockGetRecentTxs).toHaveBeenCalledWith(recentTxsArgs.chain, recentTxsArgs.wallet);
      expect(result).toEqual(JSON.stringify(mockRecentTxs, null, 2));
    });

    it("should handle errors when getting recent transactions", async () => {
      const error = new Error("Failed to fetch recent transactions");
      mockGetRecentTxs.mockRejectedValue(error);

      const result = await actionProvider.getRecentTransactions(recentTxsArgs);
      expect(result).toEqual(`Error getting recent transactions: ${error}`);
    });
  });

  describe("getTokenCurrentPrice", () => {
    const tokenPriceArgs = {
      chain: "base",
      token_address: "0x1234567890abcdef",
    };

    const mockTokenPrice = {
      price: "1800.50",
      token: {
        symbol: "ETH",
        name: "Ethereum",
        decimals: 18,
        address: "0x1234567890abcdef",
      },
      timestamp: 1739962393,
    };

    it("should get token price successfully", async () => {
      mockGetTokenPrice.mockResolvedValue(mockTokenPrice);
      const result = await actionProvider.getTokenCurrentPrice(tokenPriceArgs);

      expect(mockGetTokenPrice).toHaveBeenCalledWith({
        chain: tokenPriceArgs.chain,
        token_address: tokenPriceArgs.token_address,
      });
      expect(result).toEqual(JSON.stringify(mockTokenPrice, null, 2));
    });

    it("should handle errors when getting token price", async () => {
      const error = new Error("Failed to fetch token price");
      mockGetTokenPrice.mockRejectedValue(error);

      const result = await actionProvider.getTokenCurrentPrice(tokenPriceArgs);
      expect(result).toEqual(`Error getting token price: ${error}`);
    });
  });

  describe("getTranslatedTransaction", () => {
    const translatedTxArgs = {
      chain: "base",
      tx: "0x2748f93c54042bfbe8691cdf3bd19adb12f7cfa0e30ea38128c5ed606b7a7f44",
    };

    const mockTranslatedTx = {
      txTypeVersion: 2,
      chain: "base",
      accountAddress: "0xed4B16e8c43AD2f6e08e6E9Bf1b8848644A8C6F6",
      classificationData: {
        type: "stakeNFT",
        source: { type: "inference" },
        description: "Staked Slipstream Position NFT v1 #7595063.",
        protocol: { name: null },
        sent: [
          {
            action: "staked",
            amount: "1",
            nft: {
              name: "Slipstream Position NFT v1",
              id: "7595063",
              symbol: "AERO-CL-POS",
              address: "0x827922686190790b37229fd06084350E74485b72",
            },
            from: { name: "This wallet", address: "0xed4B16e8c43AD2f6e08e6E9Bf1b8848644A8C6F6" },
            to: { name: null, address: "0x282ece21a112950f62EC4493E2Bd2b27a74c7937" },
          },
          {
            action: "paidGas",
            from: { name: "This wallet", address: "0xed4B16e8c43AD2f6e08e6E9Bf1b8848644A8C6F6" },
            to: { name: null, address: null },
            amount: "0.000000693359358418",
            token: { symbol: "ETH", name: "ETH", decimals: 18, address: "ETH" },
          },
        ],
        received: [],
      },
      rawTransactionData: {
        transactionHash: "0x2748f93c54042bfbe8691cdf3bd19adb12f7cfa0e30ea38128c5ed606b7a7f44",
        fromAddress: "0xed4B16e8c43AD2f6e08e6E9Bf1b8848644A8C6F6",
        toAddress: "0x282ece21a112950f62EC4493E2Bd2b27a74c7937",
        blockNumber: 26586523,
        gas: 5000000,
        gasUsed: 377942,
        gasPrice: 1826005,
        l1Gas: 1600,
        l1GasPrice: 726849409,
        transactionFee: {
          amount: "0.000000693359358418",
          token: { symbol: "ETH", name: "ETH", decimals: 18, address: "ETH" },
        },
        timestamp: 1739962393,
      },
    };

    it("should get translated transaction successfully", async () => {
      mockGetTranslatedTx.mockResolvedValue(mockTranslatedTx);
      const result = await actionProvider.getTranslatedTransaction(translatedTxArgs);

      expect(mockGetTranslatedTx).toHaveBeenCalledWith(translatedTxArgs.chain, translatedTxArgs.tx);
      expect(result).toEqual(JSON.stringify(mockTranslatedTx, null, 2));
    });

    it("should handle errors when getting translated transaction", async () => {
      const error = new Error("Failed to fetch translated transaction");
      mockGetTranslatedTx.mockRejectedValue(error);

      const result = await actionProvider.getTranslatedTransaction(translatedTxArgs);
      expect(result).toEqual(`Error getting translated transaction: ${error}`);
    });
  });
});
