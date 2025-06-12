import { PondActionProvider } from "./pondActionProvider";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("PondActionProvider", () => {
  const provider = new PondActionProvider({
    apiKey: "pond-api-test",
    baseDifyApiKey: "base-dify-test",
    ethDifyApiKey: "eth-dify-test"
  });
  const testWalletAddress = "0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should be initialized with default values", () => {
    expect(provider).toBeInstanceOf(PondActionProvider);
  });

  it("should support the network", () => {
    expect(provider.supportsNetwork()).toBe(true);
  });

  describe("getWalletRiskScore", () => {
    const mockRiskScoreResponse = {
      code: 200,
      data: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: 0.8001304268836975,
          debug_info: {
            feature_update_time: {
              "2025-05-11 00:00": "100.0%",
              "null": "0.0%"
            },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    const mockRiskScoreResponseNoDebug = {
      code: 200,
      data: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: 0.8001304268836975
        }
      ]
    };

    it("should successfully get wallet risk score with default model", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRiskScoreResponse,
      });

      const result = await provider.getWalletRiskScore({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("Using Pond wallet risk scoring from OlehRCL");
      expect(result).toContain("Risk Assessment");
      expect(result).toContain("80.01%"); // Converted from 0.8001304268836975
      expect(result).toContain("CRITICAL"); // Risk level for score > 0.8
      expect(result).toContain("100.0%"); // Feature completeness
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining(testWalletAddress),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model_id).toBe(40); // Risk score model ID
    });

    it("should successfully get wallet risk score with BASE_22JE0569 model", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRiskScoreResponseNoDebug,
      });

      const result = await provider.getWalletRiskScore({
        walletAddress: testWalletAddress,
        model: 'BASE_22JE0569'
      });

      expect(result).toContain("Using Pond wallet risk scoring from 22je0569");
      expect(result).toContain("Risk Assessment");
      expect(result).toContain("80.01%");
      expect(result).toContain("CRITICAL");
      expect(result).not.toContain("Feature Completeness"); // Debug info is missing
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining(testWalletAddress),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model_id).toBe(14); // BASE_22JE0569 model ID
    });

    it("should successfully get wallet risk score with BASE_WELLSPRING model", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRiskScoreResponse,
      });

      const result = await provider.getWalletRiskScore({
        walletAddress: testWalletAddress,
        model: 'BASE_WELLSPRING'
      });

      expect(result).toContain("Using Pond wallet risk scoring from Wellspring Praise");
      expect(result).toContain("Risk Assessment");
      expect(result).toContain("80.01%");
      expect(result).toContain("CRITICAL");
      expect(result).toContain("100.0%"); // Feature completeness
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining(testWalletAddress),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model_id).toBe(15); // BASE_WELLSPRING model ID
    });

    it("should handle API errors for risk score", async () => {
      const errorMessage = "API Error";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => errorMessage,
      });

      const result = await provider.getWalletRiskScore({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("Error getting wallet risk score");
      expect(result).toContain(errorMessage);
    });

    it("should handle invalid wallet address for risk score", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid wallet address",
      });

      const result = await provider.getWalletRiskScore({
        walletAddress: "invalid-address",
      });

      expect(result).toContain("Error getting wallet risk score");
      expect(result).toContain("Invalid wallet address");
    });
  });

  describe("getWalletSummary", () => {
    const mockSummaryResponse = {
      code: 200,
      msg: "Success",
      resp_type: 1,
      resp_items: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: null,
          analysis_result: {
            BASE_DEX_SWAPS_USER_TOTAL_ACTIONS_COUNT_FOR_180DAYS: 5,
            BASE_DEX_SWAPS_USER_TRADING_VOLUME_SUM_FOR_180DAYS: 47789.43,
            BASE_DEX_SWAPS_USER_TRADING_VOLUME_AVG_FOR_180DAYS: 1296927.485,
            BASE_DEX_SWAPS_USER_TRADING_VOLUME_MEDIAN_FOR_180DAYS: 17,
            BASE_DEX_SWAPS_USER_TRADING_PNL_FOR_180DAYS: 43924.335,
            BASE_DEX_SWAPS_USER_SOLD_TOKEN_UNIQUE_COUNT_FOR_180DAYS: 6,
            BASE_DEX_SWAPS_USER_BOUGHT_TOKEN_UNIQUE_COUNT_FOR_180DAYS: 4,
            BASE_TRANSACTIONS_USER_TOTAL_ACTIONS_COUNT_FOR_180DAYS: 458275.86,
            BASE_TRANSACTIONS_USER_GAS_FEE_SUM_FOR_180DAYS: 40980.95,
            BASE_TRANSACTIONS_USER_GAS_FEE_AVG_FOR_180DAYS: 4,
            BASE_TRANSACTIONS_USER_GAS_FEE_SUM_MEDIAN_180DAYS: 46638.91,
          },
          candidates: [],
          debug_info: {
            UPDATED_AT: "2025-05-15T18:00:59.000Z",
          },
        },
      ],
    };

    it("should handle different durations correctly", async () => {
      const durations = [1, 3, 6, 12];
      const modelIds = [16, 17, 18, 19];

      for (let i = 0; i < durations.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSummaryResponse,
        });

        const result = await provider.getWalletSummary({
          walletAddress: testWalletAddress,
          duration: durations[i],
          chain: "BASE",
        });

        // Verify the response contains duration-specific text
        expect(result).toContain(`Last ${durations[i]} Month${durations[i] > 1 ? 's' : ''}`);
        
        // Verify correct model ID was used
        const requestBody = JSON.parse(mockFetch.mock.calls[i][1].body);
        expect(requestBody.model_id).toBe(modelIds[i]);
        
        // Verify response contains all expected sections
        expect(result).toContain("Based on Pond's BASE chain analytics");
        expect(result).toContain("Activity Overview");
        expect(result).toContain("DEX Trading Summary");
        expect(result).toContain("Portfolio Diversity");
        expect(result).toContain("Gas Usage");
      }
    });

    it("should return wallet summary with mock data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummaryResponse,
      });

      const result = await provider.getWalletSummary({
        walletAddress: testWalletAddress,
        duration: 6,
        chain: "BASE",
      });

      // Verify specific data points from mock response
      expect(result).toContain("47,789.43"); // Trading Volume
      expect(result).toContain("43,924.34"); // PNL
      expect(result).toContain("10"); // Total unique tokens (6 sold + 4 bought)
      expect(result).toContain("40980.950000 ETH"); // Gas fees
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getWalletSummary({
        walletAddress: testWalletAddress,
        duration: 6,
        chain: "BASE",
      });

      expect(result).toContain("No activity data available for");
    });

    it("should validate wallet address format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummaryResponse,
      });

      const result = await provider.getWalletSummary({
        walletAddress: testWalletAddress,
        duration: 6,
        chain: "BASE",
      });

      expect(result).not.toContain("Error");
    });

    it("should handle wallet address without chain", async () => {
      const result = await provider.getWalletSummary({
        walletAddress: "0xd42b098abc9c23f39a053701780e20781bd3da34be905d1e9fdab26dab80661e",
        duration: 12,
      });

      expect(result).toContain("Please specify which chain you would like to analyze");
      expect(result).toContain("BASE");
      expect(result).toContain("ETH");
      expect(result).toContain("SOLANA");
    });

    it("should handle invalid chain input", async () => {
      const result = await provider.getWalletSummary({
        walletAddress: "0xd42b098abc9c23f39a053701780e20781bd3da34be905d1e9fdab26dab80661e",
        duration: 12,
        chain: "invalid" as any
      });

      expect(result).toContain("Error getting wallet summary");
    });

    it("should handle valid chain input", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummaryResponse,
      });

      const result = await provider.getWalletSummary({
        walletAddress: "0xd42b098abc9c23f39a053701780e20781bd3da34be905d1e9fdab26dab80661e",
        duration: 12,
        chain: "ETH"
      });

      expect(result).toContain("Based on Pond's ETH chain analytics");
      expect(result).toContain("Last 12 Months");
    });

    it("should handle invalid duration", async () => {
      const result = await provider.getWalletSummary({
        walletAddress: testWalletAddress,
        duration: 7, // Invalid duration
        chain: "BASE",
      });

      expect(result).toContain("Invalid timeframe: 7 months");
      expect(result).toContain("Please choose one of the following timeframes");
      expect(result).toContain("1 month");
      expect(result).toContain("3 months");
      expect(result).toContain("6 months");
      expect(result).toContain("12 months");
    });

    it("should handle empty or null response data", async () => {
      const emptyResponse = {
        code: 200,
        msg: "Success",
        resp_type: 1,
        resp_items: [
          {
            input_key: testWalletAddress.toLowerCase(),
            score: null,
            analysis_result: {
              BASE_DEX_SWAPS_USER_TOTAL_ACTIONS_COUNT_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_TRADING_VOLUME_SUM_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_TRADING_VOLUME_AVG_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_TRADING_VOLUME_MEDIAN_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_TRADING_PNL_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_SOLD_TOKEN_UNIQUE_COUNT_FOR_180DAYS: null,
              BASE_DEX_SWAPS_USER_BOUGHT_TOKEN_UNIQUE_COUNT_FOR_180DAYS: null,
              BASE_TRANSACTIONS_USER_TOTAL_ACTIONS_COUNT_FOR_180DAYS: null,
              BASE_TRANSACTIONS_USER_GAS_FEE_SUM_FOR_180DAYS: null,
              BASE_TRANSACTIONS_USER_GAS_FEE_AVG_FOR_180DAYS: null,
              BASE_TRANSACTIONS_USER_GAS_FEE_SUM_MEDIAN_180DAYS: null,
            },
            candidates: [],
            debug_info: {
              UPDATED_AT: "2025-05-15T18:00:59.000Z",
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse,
      });

      const result = await provider.getWalletSummary({
        walletAddress: testWalletAddress,
        duration: 6,
        chain: "BASE",
      });

      expect(result).toContain("N/A"); // Should show N/A for null values
      expect(result).toContain("Activity Level: Low"); // Should default to Low for no activity
      expect(result).toContain("0 total"); // Should show 0 for null token counts
    });
  });

  describe("getTopSolanaMemeCoins", () => {
    const mockMemeCoinsResponse = {
      code: 200,
      resp_type: 1,
      resp_items: [
        {
          input_key: "LZboYF8CPRYiswZFLSQusXEaMMwMxuSA5VtjGPtpump",
          score: null,
          analysis_result: {
            SOLANA_DEX_SWAPS_TOKEN_PRICE_CHANGE_FOR_6HOURS: 0.5,
            SOLANA_DEX_SWAPS_TOKEN_TOTAL_SWAP_USD_VOLUME_SUM_FOR_6HOURS: 1000000,
            SOLANA_DEX_SWAPS_TOKEN_UNIQUE_BOUGHT_USER_COUNT_FOR_6HOURS: 100,
            SOLANA_DEX_SWAPS_TOKEN_UNIQUE_SOLD_USER_COUNT_FOR_6HOURS: 50,
            SOLANA_DEX_SWAPS_TOKEN_TOTAL_SWAP_COUNT_FOR_6HOURS: 200,
            SOLANA_DEX_SWAPS_TOKEN_USD_VOLUME_NET_FLOW_SUM_FOR_6HOURS: 50000
          },
          debug_info: {
            UPDATED_AT: "2025-05-15T18:00:59.000Z"
          }
        }
      ]
    };

    it("should handle invalid timeframe", async () => {
      const result = await provider.getTopSolanaMemeCoins({
        timeframe: 8
      });

      expect(result).toContain("Invalid timeframe: 8 hours");
      expect(result).toContain("Please choose one of the following timeframes: 3, 6, 12, 24 hours");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should successfully get meme coins data for valid timeframe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMemeCoinsResponse
      });

      const result = await provider.getTopSolanaMemeCoins({
        timeframe: 6
      });

      expect(result).toContain("Based on Pond's Solana meme coins analytics");
      expect(result).toContain("Last 6 hours");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"model_id":37') // 6 hours model ID
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error"
      });

      const result = await provider.getTopSolanaMemeCoins({
        timeframe: 6
      });

      expect(result).toContain("Error getting top Solana meme coins");
      expect(result).toContain("API Error");
    });
  });

  describe("getSybilPrediction", () => {
    const mockSybilResponse = {
      code: 200,
      data: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: 0.7,
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get sybil prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSybilResponse,
      });

      const result = await provider.getSybilPrediction({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("Sybil Assessment");
      expect(result).toContain("70.00%");
      expect(result).toContain("LIKELY");
      expect(result).toContain("100.0%");
    });

    it("should handle API errors for sybil prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getSybilPrediction({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("Error getting Sybil prediction");
      expect(result).toContain("API Error");
    });
  });

  describe("getTokenPricePrediction", () => {
    const mockTokenPriceResponse = {
      code: 200,
      data: [
        {
          input_key: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
          score: 0.12,
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get token price prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenPriceResponse,
      });

      const result = await provider.getTokenPricePrediction({
        tokenAddress: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
        timeframe: 1,
      });

      expect(result).toContain("Price Movement Forecast");
      expect(result).toContain("12.00%");
      expect(result).toContain("VERY HIGH");
    });

    it("should handle API errors for token price prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getTokenPricePrediction({
        tokenAddress: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
        timeframe: 1,
      });

      expect(result).toContain("Error getting price prediction");
      expect(result).toContain("API Error");
    });
  });

  describe("getTokenRiskScores", () => {
    const mockTokenRiskResponse = {
      code: 200,
      data: [
        {
          input_key: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
          score: 0.3,
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get token risk scores", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenRiskResponse,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenRiskResponse,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenRiskResponse,
      });

      const result = await provider.getTokenRiskScores({
        tokenAddress: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
      });

      expect(result).toContain("Token Risk Analysis");
      expect(result).toContain("30.00%");
      expect(result).toContain("LOW");
    });

    it("should handle API errors for token risk scores", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getTokenRiskScores({
        tokenAddress: "0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85",
      });

      expect(result).toContain("Error getting token risk scores");
      expect(result).toContain("API Error");
    });
  });

  describe("getPumpFunPricePrediction", () => {
    const mockPumpFunResponse = {
      code: 200,
      data: [
        {
          input_key: "14Ak6KegFHLANKALmpjdn1MFW477yvesX8cdzdVEpump",
          score: 0.15,
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get PumpFun price prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPumpFunResponse,
      });

      const result = await provider.getPumpFunPricePrediction({
        tokenAddress: "14Ak6KegFHLANKALmpjdn1MFW477yvesX8cdzdVEpump",
        timeframe: 24,
      });

      expect(result).toContain("PumpFun Price Prediction");
      expect(result).toContain("15.00%");
      expect(result).toContain("increase");
      expect(result).toContain("100.0%");
    });

    it("should handle invalid timeframe", async () => {
      const result = await provider.getPumpFunPricePrediction({
        tokenAddress: "14Ak6KegFHLANKALmpjdn1MFW477yvesX8cdzdVEpump",
        timeframe: 8,
      });

      expect(result).toContain("Invalid timeframe: 8 hours");
      expect(result).toContain("Available timeframes are: 1, 3, 6, 12, 24 hours");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getPumpFunPricePrediction({
        tokenAddress: "14Ak6KegFHLANKALmpjdn1MFW477yvesX8cdzdVEpump",
        timeframe: 24,
      });

      expect(result).toContain("Error getting PumpFun price prediction");
      expect(result).toContain("API Error");
    });
  });

  describe("getZoraNFTRecommendations", () => {
    const mockZoraResponse = {
      code: 200,
      data: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: null,
          candidates: [
            {
              item_id: "0x1234...5678",
              score: 0.85
            },
            {
              item_id: "0x8765...4321",
              score: 0.75
            }
          ],
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get NFT recommendations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockZoraResponse,
      });

      const result = await provider.getZoraNFTRecommendations({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("NFT Recommendations");
      expect(result).toContain("85.00%");
      expect(result).toContain("75.00%");
      expect(result).toContain("100.0%");
    });

    it("should handle empty recommendations", async () => {
      const emptyResponse = {
        code: 200,
        data: [
          {
            input_key: testWalletAddress.toLowerCase(),
            score: null,
            candidates: [],
            debug_info: {
              feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
              not_null_feature: "100.0%"
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse,
      });

      const result = await provider.getZoraNFTRecommendations({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("No NFT Recommendations Available");
      expect(result).toContain("Based on Pond's NFT recommendation model");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getZoraNFTRecommendations({
        walletAddress: testWalletAddress,
      });

      expect(result).toContain("Error getting Zora NFT recommendations");
      expect(result).toContain("API Error");
    });
  });

  describe("getSecurityAssessment", () => {
    const mockSecurityResponse = {
      code: 200,
      data: [
        {
          input_key: testWalletAddress.toLowerCase(),
          score: 0.45,
          debug_info: {
            feature_update_time: { "2025-05-11 00:00": "100.0%", "null": "0.0%" },
            not_null_feature: "100.0%"
          }
        }
      ]
    };

    it("should successfully get security assessment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSecurityResponse,
      });

      const result = await provider.getSecurityAssessment({
        address: testWalletAddress,
      });

      expect(result).toContain("Security Assessment for 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18");
      expect(result).toContain("Risk Score: 45.00%");
      expect(result).toContain("Risk Level: MODERATE");
      expect(result).toContain("Data Completeness: 100.0%");
    });

    it("should handle low data completeness", async () => {
      const lowDataResponse = {
        code: 200,
        data: [
          {
            input_key: testWalletAddress.toLowerCase(),
            score: 0.45,
            debug_info: {
              feature_update_time: { "2025-05-11 00:00": "30.0%", "null": "70.0%" },
              not_null_feature: "30.0%"
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => lowDataResponse,
      });

      const result = await provider.getSecurityAssessment({
        address: testWalletAddress,
      });

      expect(result).toContain("Warning: Limited Data Available");
      expect(result).toContain("Based on Pond's security assessment model");
      expect(result).toContain("45.00%");
      expect(result).toContain("30.0%");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API Error",
      });

      const result = await provider.getSecurityAssessment({
        address: testWalletAddress,
      });

      expect(result).toContain("Error getting security assessment");
      expect(result).toContain("API Error");
    });
  });
}); 