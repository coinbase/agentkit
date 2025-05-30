import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { z } from "zod";
import { 
  WalletSummarySchema,
  WalletRiskScoreSchema,
  SybilPredictionSchema,
  TokenPricePredictionSchema,
  TokenRiskScoreSchema,
  TopSolanaMemeCoinsSchema,
  BaseDataAnalystSchema,
  EthereumDataAnalystSchema,
  PumpFunPricePredictionSchema,
  ZoraNFTRecommendationSchema,
  SecurityModelSchema
} from "./schemas";

/**
 * Configuration options for the PondActionProvider.
 */
export interface PondActionProviderConfig {
  /**
   * Pond API Key (limited to 10,000 requests)
   */
  apiKey?: string;

  /**
   * Base Dify API Key for Base chain data analyst queries
   */
  baseDifyApiKey?: string;

  /**
   * Ethereum Dify API Key for Ethereum chain data analyst queries
   */
  ethDifyApiKey?: string;
}

// Add at the top, after imports
async function handlePondApiError(response: Response, service: string = "Pond API"): Promise<void> {
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (response.status === 401) {
      throw new Error("Invalid API key or authentication failed.");
    } else if (response.status >= 500) {
      throw new Error(`${service} service is currently unavailable. Please try again later.`);
    }
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
}

function formatDate(dateStr: string | number): string {
  if (!dateStr || dateStr === "unknown") return "unknown date";
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Action provider for interacting with Pond API
 */
export class PondActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly baseDifyApiKey: string;
  private readonly ethDifyApiKey: string;
  private readonly API_URL = "https://broker-service.private.cryptopond.xyz/predict";
  private readonly BASE_DIFY_API_URL = "http://100.29.38.105/v1/chat-messages";
  private readonly ETH_DIFY_API_URL = "http://100.29.38.105/v1/chat-messages";
  private static readonly DURATION_MODEL_MAP = {
    BASE: {
      1: 16,  // 1 month
      3: 17,  // 3 months
      6: 18,  // 6 months
      12: 19  // 12 months
    },
    ETH: {
      1: 20,  // 1 month
      3: 21,  // 3 months
      6: 22,  // 6 months
      12: 23  // 12 months
    },
    SOLANA: {
      1: 24,  // 1 month
      3: 25,  // 3 months
      6: 26,  // 6 months
      12: 27  // 12 months
    }
  };
  private static readonly RISK_SCORE_MODEL_IDS = {
    DEFAULT: 40,  // Default risk score model
    BASE_22JE0569: 14,  // Base chain risk assessment by 22je0569
    BASE_WELLSPRING: 15  // Base chain risk assessment by Wellspring Praise
  };
  private static readonly SYBIL_MODEL_ID = 2;
  private static readonly TOKEN_RISK_SCORE_MODEL_IDS = {
    THE_DAY: 32,        // 1st place in Token Risk Scoring competition
    MR_HEOS: 33,        // 2nd place in Token Risk Scoring competition
    NILSSON_LIENE: 34   // 3rd place in Token Risk Scoring competition
  };
  private static readonly PRICE_PREDICTION_MODEL_MAP = {
    1: 4,   // 1 hour prediction
    3: 5,   // 3 hour prediction
    6: 6,   // 6 hour prediction
    12: 7,  // 12 hour prediction
    24: 8   // 24 hour prediction
  };
  private static readonly SOLANA_MEME_COINS_MODEL_MAP = {
    3: 36,   // 3 hour prediction
    6: 37,   // 6 hour prediction
    12: 38,  // 12 hour prediction
    24: 39   // 24 hour prediction
  };
 

  private static readonly TIMEFRAME_SUFFIX_MAP = {
    3: "3HOURS",
    6: "6HOURS",
    12: "12HOURS",
    24: "24HOURS"
  };

  private static readonly VOLATILITY_PREDICTION_MODEL_MAP = {
    3: 28,   // 3 hour prediction
    6: 29,   // 6 hour prediction
    12: 30,  // 12 hour prediction
    24: 31   // 24 hour prediction
  };

  private static readonly PUMPFUN_PREDICTION_MODEL_MAP = {
    1: 9,    // 1 hour prediction
    3: 10,   // 3 hour prediction
    6: 11,   // 6 hour prediction
    12: 12,  // 12 hour prediction
    24: 13   // 24 hour prediction
  };

  private static readonly ZORA_NFT_RECOMMENDATION_MODEL_ID = 3;
  private static readonly SECURITY_MODEL_ID = 1;

  /**
   * Creates an instance of PondActionProvider
   *
   * @param config - Configuration for the Pond API including API keys
   */
  constructor(config: PondActionProviderConfig = {}) {
    super("pond", []);

    // Get API keys from config or environment variables
    config.apiKey ||= process.env.POND_API_KEY;
    config.baseDifyApiKey ||= process.env.BASE_DIFY_API_KEY;
    config.ethDifyApiKey ||= process.env.ETH_DIFY_API_KEY;

    if (!config.apiKey) {
      throw new Error("POND_API_KEY is not configured. Please provide it in the config or set POND_API_KEY environment variable.");
    }
    if (!config.baseDifyApiKey) {
      throw new Error("BASE_DIFY_API_KEY is not configured. Please provide it in the config or set BASE_DIFY_API_KEY environment variable.");
    }
    if (!config.ethDifyApiKey) {
      throw new Error("ETH_DIFY_API_KEY is not configured. Please provide it in the config or set ETH_DIFY_API_KEY environment variable.");
    }

    this.apiKey = config.apiKey;
    this.baseDifyApiKey = config.baseDifyApiKey;
    this.ethDifyApiKey = config.ethDifyApiKey;
  }

  /**
   * Gets wallet risk score from Pond API
   *
   * @param args - Object containing the wallet address to analyze
   * @returns A string containing the risk analysis in a formatted way
   */
  @CreateAction({
    name: "get_wallet_risk_score",
    description: `
This tool will get a wallet risk score from Pond API. It is based on the wallet's activity and transaction history. NOT TOKEN RISSESMENT
It requires an Ethereum (base) wallet address as input.

The response will include:
- Risk score (0 to 1, where higher scores indicate higher risk)
- Feature update time information
- Feature completeness percentage

Available models:
- DEFAULT (40): Wallet risk assessment model by OlehRCL
- BASE_22JE0569 (14): Base chain risk assessment by 22je0569
- BASE_WELLSPRING (15): Base chain risk assessment by Wellspring Praise

Example wallet address format: 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18

A failure response will return an error message with details.
`,
    schema: WalletRiskScoreSchema.input,
  })
  async getWalletRiskScore(args: z.infer<typeof WalletRiskScoreSchema.input>): Promise<string> {
    try {
      const modelId = args.model ? PondActionProvider.RISK_SCORE_MODEL_IDS[args.model] : PondActionProvider.RISK_SCORE_MODEL_IDS.DEFAULT;
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.walletAddress],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json().catch(() => {
        throw new Error("Invalid JSON response from Pond API");
      });

      const parsedResponse = WalletRiskScoreSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];
      
      if (!result) {
        throw new Error("No risk score data available for this wallet address");
      }

      // Handle missing debug info fields gracefully
      interface DebugInfo {
        feature_update_time?: Record<string, string>;
        not_null_feature?: string;
      }
      const debugInfo: DebugInfo = result.debug_info || {};
      const featureUpdateTime = debugInfo.feature_update_time || {};
      const notNullFeature = debugInfo.not_null_feature || '100.0';  // Default to 100% if not provided

      // Convert score to percentage and risk level
      const riskPercentage = (result.score * 100).toFixed(2);
      
      // Get the most recent feature update time
      const updateTimes = Object.entries(featureUpdateTime)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";
      
      const modelAuthor = args.model === 'BASE_22JE0569' ? '22je0569' : 
                         args.model === 'BASE_WELLSPRING' ? 'Wellspring Praise' : 
                         'OlehRCL';

      return `
Using Pond wallet risk scoring from ${modelAuthor}

Wallet Risk Assessment for ${args.walletAddress}:

• Risk Score: ${riskPercentage}%
${debugInfo.not_null_feature ? `• Feature Completeness: ${notNullFeature}` : ''}
• Last Updated: ${formatDate(latestUpdate)}`;
    } catch (error) {
      return `Error getting wallet risk score: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets wallet activity summary from Pond API for Base, Ethereum, or Solana chains
   *
   * @param args - Object containing the wallet address, duration, and chain to analyze
   * @returns A string containing the activity summary for the specified chain in a formatted way
   */
  @CreateAction({
    name: "get_wallet_summary",
    description: `
This tool will get a basic wallet activity summary from Pond API for Base, Ethereum, or Solana chains.
It is designed for simple numerical metrics and statistics only. For complex analysis or specific token bought,sold, traded, use the Base/ethereum data analyst.

It requires:
1. A wallet address
2. Duration in months (1, 3, 6, or 12) for the summary period
3. (Optional) Chain to analyze (BASE, ETH, or SOLANA). If not specified, you will be prompted to choose one.

The response will include ONLY basic numerical metrics:
- DEX trading activity for the specified period:
  - Total number of swaps
  - Trading volumes (sum, average, median)
  - Trading PNL
  - Number of unique tokens traded
- Transaction metrics for the specified period:
  - Total transaction count
  - Gas fees (sum, average, median)

For any of the following, use the Base data analyst instead:
- Questions about specific tokens
- Analysis of buying/selling patterns
- Token preferences or strategies
- Complex wallet behavior analysis
- Detailed token holdings

Example wallet address format: 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18
Example duration: 6 (for 6 months of data)
Example chain: BASE (for Base chain analysis)

A failure response will return an error message with details.
`,
    schema: WalletSummarySchema.input,
  })
  async getWalletSummary(args: z.infer<typeof WalletSummarySchema.input>): Promise<string> {
    try {
      // Check if this is a complex query that should use Base data analyst
      const complexQueryKeywords = [
        'token', 'buy', 'purchase', 'sell', 'holding', 'holdings',
        'prefer', 'strategy', 'pattern', 'behavior', 'analysis',
        'what', 'which', 'how', 'why', 'when', 'where'
      ];

      const isComplexQuery = args.query && complexQueryKeywords.some(keyword => 
        args.query?.toLowerCase().includes(keyword)
      );

      if (isComplexQuery && (!args.chain || args.chain.toUpperCase() === 'BASE')) {
        // Redirect to Base data analyst for complex queries
        return this.getBaseDataAnalysis({
          query: args.query || `What is the activity of wallet ${args.walletAddress} on Base?`
        });
      }

      // Convert chain to uppercase if provided
      if (args.chain) {
        args.chain = args.chain.toUpperCase() as 'BASE' | 'ETH' | 'SOLANA';
      }

      // If chain is not specified, return a prompt to choose one
      if (!args.chain) {
        return `Please specify which chain you would like to analyze:
• BASE - For Base chain activity
• ETH - For Ethereum chain activity
• SOLANA - For Solana chain activity

You can specify the chain by adding it to your request, for example:
"Get wallet summary for 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18 for 6 months on BASE"`;
      }

      // Validate timeframe
      if (![1, 3, 6, 12].includes(args.duration)) {
        return `Invalid timeframe: ${args.duration} months. Please choose one of the following timeframes:
• 1 month
• 3 months
• 6 months
• 12 months

You can specify the timeframe by adding it to your request, for example:
"Get wallet summary for 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18 for 6 months on ${args.chain}"`;
      }

      const modelId = PondActionProvider.DURATION_MODEL_MAP[args.chain][args.duration];
      const result = await this.getChainSummary(args.walletAddress, args.duration, args.chain, modelId);

      if (!result) {
        return `No activity data available for ${args.walletAddress} on ${args.chain} chain for the last ${args.duration} month${args.duration > 1 ? 's' : ''}.`;
      }

      return `Based on Pond's ${args.chain} chain analytics, here's the wallet activity summary for ${args.walletAddress} (Last ${args.duration} Month${args.duration > 1 ? 's' : ''}):\n\n${result}`;
    } catch (error) {
      return `Error getting wallet summary: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async getChainSummary(walletAddress: string, duration: number, chain: 'BASE' | 'ETH' | 'SOLANA', modelId: number): Promise<string | null> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [walletAddress],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = WalletSummarySchema.response.parse(data);

      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result || !result.analysis_result) {
        return null;
      }

      const analysis = result.analysis_result;
      const daySuffix = this.getDaySuffixForDuration(duration);
      const chainPrefix = chain === 'BASE' ? 'BASE' : chain === 'ETH' ? 'ETH' : 'SOLANA';

      const tradingVolume = analysis[`${chainPrefix}_DEX_SWAPS_USER_TRADING_VOLUME_SUM_FOR_${daySuffix}`] || 0;
      const tradingPnl = analysis[`${chainPrefix}_DEX_SWAPS_USER_TRADING_PNL_FOR_${daySuffix}`] || 0;
      const profitability = tradingVolume > 0 ? (tradingPnl / tradingVolume) * 100 : 0;
      
      // Calculate activity level
      const swapsCount = analysis[`${chainPrefix}_DEX_SWAPS_USER_TOTAL_ACTIONS_COUNT_FOR_${daySuffix}`] || 0;
      const txCount = analysis[`${chainPrefix}_TRANSACTIONS_USER_TOTAL_ACTIONS_COUNT_FOR_${daySuffix}`] || 0;
      let activityLevel = "Low";
      if (txCount > 100) activityLevel = "Very High";
      else if (txCount > 50) activityLevel = "High";
      else if (txCount > 20) activityLevel = "Moderate";

      // Format currency values
      const formatUSD = (value: number | null | undefined) => 
        value ? value.toLocaleString('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        }) : 'N/A';

      const formatNative = (value: number | null | undefined) =>
        value ? `${value.toFixed(6)} ${chain === 'ETH' ? 'ETH' : chain === 'SOLANA' ? 'SOL' : 'ETH'}` : 'N/A';

      return `${chain} Chain Activity:
Activity Overview:
• Activity Level: ${activityLevel}
• Total Transactions: ${txCount || 'N/A'}
• Average Daily Transactions: ${txCount ? (txCount / (duration * 30)).toFixed(1) : 'N/A'}

DEX Trading Summary:
• Total Swaps: ${swapsCount || 'N/A'}
• Trading Volume: ${formatUSD(tradingVolume)}
• Trading Performance:
  - Total PNL: ${formatUSD(tradingPnl)}
  - Profitability: ${profitability.toFixed(2)}%
  - Average Trade Size: ${formatUSD(analysis[`${chainPrefix}_DEX_SWAPS_USER_TRADING_VOLUME_AVG_FOR_${daySuffix}`])}
  - Median Trade Size: ${formatUSD(analysis[`${chainPrefix}_DEX_SWAPS_USER_TRADING_VOLUME_MEDIAN_FOR_${daySuffix}`])}

Portfolio Diversity:
• Unique Tokens Traded: ${(
    (analysis[`${chainPrefix}_DEX_SWAPS_USER_BOUGHT_TOKEN_UNIQUE_COUNT_FOR_${daySuffix}`] || 0) +
    (analysis[`${chainPrefix}_DEX_SWAPS_USER_SOLD_TOKEN_UNIQUE_COUNT_FOR_${daySuffix}`] || 0)
  )} total
  - Tokens Bought: ${analysis[`${chainPrefix}_DEX_SWAPS_USER_BOUGHT_TOKEN_UNIQUE_COUNT_FOR_${daySuffix}`] || 'N/A'}
  - Tokens Sold: ${analysis[`${chainPrefix}_DEX_SWAPS_USER_SOLD_TOKEN_UNIQUE_COUNT_FOR_${daySuffix}`] || 'N/A'}

Gas Usage:
• Total Gas Spent: ${formatNative(analysis[`${chainPrefix}_TRANSACTIONS_USER_GAS_FEE_SUM_FOR_${daySuffix}`])}
• Average Gas per Tx: ${formatNative(analysis[`${chainPrefix}_TRANSACTIONS_USER_GAS_FEE_AVG_FOR_${daySuffix}`])}
• Median Gas per Tx: ${formatNative(analysis[`${chainPrefix}_TRANSACTIONS_USER_GAS_FEE_SUM_MEDIAN_${daySuffix}`])}

Last Updated: ${formatDate(result.debug_info.UPDATED_AT)}`;

    } catch (error) {
      console.error(`Error getting ${chain} chain summary:`, error);
      return null;
    }
  }

  private getDaySuffixForDuration(duration: number): string {
    switch (duration) {
      case 1:
        return "30DAYS";
      case 3:
        return "90DAYS";
      case 6:
        return "180DAYS";
      case 12:
        return "360DAYS";
      default:
        throw new Error(`Invalid duration: ${duration}`);
    }
  }

  /**
   * Gets Sybil prediction score for a wallet address from Pond API
   *
   * @param args - Object containing the wallet address to analyze
   * @returns A string containing the Sybil prediction analysis in a formatted way
   */
  @CreateAction({
    name: "get_sybil_prediction",
    description: `
This tool will get a Sybil prediction score from Pond API to detect potential multi-account wallets.
It requires an Ethereum wallet address as input.

The response will include:
- Sybil score (0 to 1, where higher scores indicate higher likelihood of being a Sybil address)
- Feature update time information
- Feature completeness percentage

Example wallet address format: 0xD558cE26E3e3Ca0fAc12aE116eAd9D7014a42d18

A failure response will return an error message with details.
`,
    schema: SybilPredictionSchema.input,
  })
  async getSybilPrediction(args: z.infer<typeof SybilPredictionSchema.input>): Promise<string> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.walletAddress],
          model_id: PondActionProvider.SYBIL_MODEL_ID,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = SybilPredictionSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No Sybil prediction data available for this wallet address");
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's Sybil detection model, the analysis for ${args.walletAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Sybil Score: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This score may not be reliable due to limited available data.
Please check if this is a new or inactive wallet address.
`;
      }

      // Convert score to percentage and Sybil likelihood level
      const sybilPercentage = (result.score * 100).toFixed(2);
      
      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
Based on Pond's Sybil detection model (created by Jerry), this wallet has been analyzed:

Sybil Assessment:
• Sybil Score: ${sybilPercentage}%
• Feature Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}`;

    } catch (error) {
      return `Error getting Sybil prediction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets token price prediction from Pond API
   *
   * @param args - Object containing the token address and timeframe to predict
   * @returns A string containing the price prediction analysis in a formatted way
   */
  @CreateAction({
    name: "get_token_price_prediction",
    description: `
This tool will get a token price prediction from Pond API for tokens on Base chain. NOT CURRENT PRICE. only use this for future price predictions.
It requires:
1. A Base chain token contract address
2. Timeframe in hours (1, 3, 6, 12, or 24) for the prediction period

The response will include:
- Predicted price change percentage
- Prediction confidence based on data completeness
- Last feature update time

Example token address format: 0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85
Example timeframe: 1 (for 1 hour prediction)

A failure response will return an error message with details.
`,
    schema: TokenPricePredictionSchema.input,
  })
  async getTokenPricePrediction(args: z.infer<typeof TokenPricePredictionSchema.input>): Promise<string> {
    try {
      const modelId = PondActionProvider.PRICE_PREDICTION_MODEL_MAP[args.timeframe];
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.tokenAddress],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = TokenPricePredictionSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No price prediction data available for this token");
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's price prediction model, the analysis for ${args.tokenAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Predicted Change: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;
      }

      // Convert score to percentage
      const priceChangePercent = (result.score * 100).toFixed(2);
      const direction = result.score >= 0 ? "increase" : "decrease";
      
      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
Based on Pond's price prediction model for Base chain tokens:

Price Movement Forecast:
• Direction: ${direction}
• Predicted Change: ${priceChangePercent}%
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}`;

    } catch (error) {
      return `Error getting price prediction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets token risk scores from multiple models on Pond API
   *
   * @param args - Object containing the token address to analyze
   * @returns A string containing the risk analysis from all three models in a formatted way
   */
  @CreateAction({
    name: "get_token_risk_scores",
    description: `
This tool will get token risk scores from three different models on Pond API for Base chain tokens.
These models were the top 3 winners of Pond's Token Risk Scoring competition for Base chain tokens.

The response will include risk scores from three different models:
1. The Day's model (1st place winner) - Model ID: 32
2. Mr. Heos's model (2nd place winner) - Model ID: 33
3. Nilsson Liene's model (3rd place winner) - Model ID: 34

Each model provides:
- Risk score (0 to 1, where higher scores indicate higher risk)
- Feature completeness percentage
- Last update time

Example token address format: 0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85

A failure response will return an error message with details.
`,
    schema: TokenRiskScoreSchema.input,
  })
  async getTokenRiskScores(args: z.infer<typeof TokenRiskScoreSchema.input>): Promise<string> {
    try {
      const results = await Promise.all(
        Object.entries(PondActionProvider.TOKEN_RISK_SCORE_MODEL_IDS).map(async ([modelName, modelId]) => {
          const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              req_type: "1",
              access_token: this.apiKey,
              input_keys: [args.tokenAddress],
              model_id: modelId,
            }),
          });

          await handlePondApiError(response);

          const data = await response.json();
          const parsedResponse = TokenRiskScoreSchema.response.parse(data);
          const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

          if (!result) {
            throw new Error(`No risk score data available for this token from ${modelName}'s model`);
          }

          return {
            modelName,
            result
          };
        })
      );

      // Format the results
      const formattedResults = results.map(({ modelName, result }) => {
        const riskPercentage = (result.score * 100).toFixed(2);
        const updateTimes = Object.entries(result.debug_info.feature_update_time)
          .filter(([time]) => time !== "null")
          .sort(([a], [b]) => b.localeCompare(a));
        const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

        return {
          modelName,
          riskPercentage,
          dataCompleteness: result.debug_info.not_null_feature,
          lastUpdated: formatDate(latestUpdate)
        };
      });

      return `Based on Pond's token risk assessment models for Base chain tokens:

Token Risk Analysis for ${args.tokenAddress}:

${formattedResults.map(result => 
  `${result.modelName}'s Model (${result.modelName === 'THE_DAY' ? '1st' : result.modelName === 'MR_HEOS' ? '2nd' : '3rd'} Place):\n` +
  `• Risk Score: ${result.riskPercentage}%\n` +
  `• Data Completeness: ${result.dataCompleteness}\n` +
  `• Last Updated: ${result.lastUpdated}\n\n`
).join('')}Note: Risk scores range from 0% (lowest risk) to 100% (highest risk).
Each model may use different methodologies and data points for risk assessment.`;

    } catch (error) {
      return `Error getting token risk scores: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets top 10 Solana meme coins from Pond API
   *
   * @param args - Object containing the timeframe to analyze
   * @returns A string containing the top 10 meme coins analysis in a formatted way
   */
  @CreateAction({
    name: "get_top_solana_meme_coins",
    description: `
This tool will get Solana meme coin analytics from Pond API for a set of token addresses.
It requires:
- A timeframe in hours (3, 6, 12, or 24) for the analysis period

The response will include for each token:
- Price change percentage
- Trading volume and activity
- Number of unique traders
- Market metrics

Example timeframe: 3 (for 3 hours analysis)
Example addresses: ["abcdefghijklmnopqrstuvwxyz1234567890", ...] (dont ask for address for this action, it will always give top 10 tokens by default)

A failure response will return an error message with details.
`,
    schema: TopSolanaMemeCoinsSchema.input,
  })
  async getTopSolanaMemeCoins(args: z.infer<typeof TopSolanaMemeCoinsSchema.input>): Promise<string> {
    // Validate timeframe first
    if (!PondActionProvider.SOLANA_MEME_COINS_MODEL_MAP[args.timeframe]) {
      const validTimeframes = Object.keys(PondActionProvider.SOLANA_MEME_COINS_MODEL_MAP).join(', ');
      return `Invalid timeframe: ${args.timeframe} hours. I will request with available timeframe. Please choose one of the following timeframes: ${validTimeframes} hours on the next request`;
    }

    try {
      const modelId = PondActionProvider.SOLANA_MEME_COINS_MODEL_MAP[args.timeframe];
      const timeframeSuffix = PondActionProvider.TIMEFRAME_SUFFIX_MAP[args.timeframe];
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: args.addresses || ["LZboYF8CPRYiswZFLSQusXEaMMwMxuSA5VtjGPtpump"],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = TopSolanaMemeCoinsSchema.response.parse(data);

      // Get the coins data from either data or resp_items
      const coins = parsedResponse.data || parsedResponse.resp_items;
      if (!coins || coins.length === 0) {
        throw new Error("No meme coins data available");
      }

      // Sort tokens by price change descending
      const sortedCoins = coins.slice().sort((a, b) => {
        const aChange = a.analysis_result[`SOLANA_DEX_SWAPS_TOKEN_PRICE_CHANGE_FOR_${timeframeSuffix}`] || 0;
        const bChange = b.analysis_result[`SOLANA_DEX_SWAPS_TOKEN_PRICE_CHANGE_FOR_${timeframeSuffix}`] || 0;
        return bChange - aChange;
      });

      // Helper function to format numbers
      const formatNumber = (num: number | null | undefined) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('en-US', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        });
      };

      const formatUSD = (num: number | null | undefined) => {
        if (num === null || num === undefined) return 'N/A';
        return `$${num.toLocaleString('en-US', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 8 
        })}`;
      };

      // Prepare explanation for top 3 tokens (show detailed metrics)
      const top3 = sortedCoins.slice(0, 3).map((coin, idx) => {
        const a = coin.analysis_result;
        const priceChange = a[`SOLANA_DEX_SWAPS_TOKEN_PRICE_CHANGE_FOR_${timeframeSuffix}`] || 0;
        const volume = a[`SOLANA_DEX_SWAPS_TOKEN_TOTAL_SWAP_USD_VOLUME_SUM_FOR_${timeframeSuffix}`] || 0;
        const uniqueTraders = (a[`SOLANA_DEX_SWAPS_TOKEN_UNIQUE_BOUGHT_USER_COUNT_FOR_${timeframeSuffix}`] || 0) + 
                            (a[`SOLANA_DEX_SWAPS_TOKEN_UNIQUE_SOLD_USER_COUNT_FOR_${timeframeSuffix}`] || 0);
        const totalSwaps = a[`SOLANA_DEX_SWAPS_TOKEN_TOTAL_SWAP_COUNT_FOR_${timeframeSuffix}`] || 0;
        const netFlow = a[`SOLANA_DEX_SWAPS_TOKEN_USD_VOLUME_NET_FLOW_SUM_FOR_${timeframeSuffix}`] || 0;

        return `#${idx + 1} ${coin.input_key}
  • Price Change: ${(priceChange * 100).toFixed(8)}%
  • Trading Volume: ${formatUSD(volume)}
  • Trading Activity:
    - Total Swaps: ${formatNumber(totalSwaps)}
    - Unique Traders: ${formatNumber(uniqueTraders)}
    - Net USD Flow: ${formatUSD(netFlow)}`;
      });

      // For the rest, show price change, volume, and unique traders
      const rest = sortedCoins.slice(3).map((coin, idx) => {
        const a = coin.analysis_result;
        const priceChange = a[`SOLANA_DEX_SWAPS_TOKEN_PRICE_CHANGE_FOR_${timeframeSuffix}`] || 0;
        const volume = a[`SOLANA_DEX_SWAPS_TOKEN_TOTAL_SWAP_USD_VOLUME_SUM_FOR_${timeframeSuffix}`] || 0;
        const uniqueTraders = (a[`SOLANA_DEX_SWAPS_TOKEN_UNIQUE_BOUGHT_USER_COUNT_FOR_${timeframeSuffix}`] || 0) + 
                            (a[`SOLANA_DEX_SWAPS_TOKEN_UNIQUE_SOLD_USER_COUNT_FOR_${timeframeSuffix}`] || 0);

        return `#${idx + 4} ${coin.input_key}
  • Price Change: ${(priceChange * 100).toFixed(8)}%
  • Volume: ${formatUSD(volume)}
  • Unique Traders: ${formatNumber(uniqueTraders)}`;
      });

      const lastUpdated = coins[0].debug_info.UPDATED_AT;

      return `Based on Pond's Solana meme coins analytics (Last ${args.timeframe} hours):

Top Performers:
${top3.join('\n\n')}

Other Trending Meme Coins:
${rest.join('\n\n')}

Last Updated: ${formatDate(lastUpdated)}

Note: 
• Price change is percentage over the period
• Trading volume is total DEX trading volume
• Net USD flow represents net buy/sell volume
• Past performance does not guarantee future results`;

    } catch (error) {
      return `Error getting top Solana meme coins: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets Base chain data analysis from Pond API
   *
   * @param args - Object containing the query to analyze
   * @returns A string containing the data analysis in a formatted way
   */
  @CreateAction({
    name: "get_base_data_analysis",
    description: `
This tool will get Base chain data analysis from Pond API.
It requires a query string as input.

The response will include:
- Analysis results based on the query
- Data completeness metrics
- Last update timestamp

Example query: "What are the most popular NFTs on base today?"

A failure response will return an error message with details.
`,
    schema: BaseDataAnalystSchema.input,
  })
  async getBaseDataAnalysis(args: z.infer<typeof BaseDataAnalystSchema.input>): Promise<string> {
    if (!this.baseDifyApiKey) {
      return "Error: Base Dify API key is required. Please provide it when initializing PondActionProvider.";
    }

    try {
      const response = await fetch(this.BASE_DIFY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.baseDifyApiKey}`
        },
        body: JSON.stringify({
          inputs: {},
          query: args.query,
          response_mode: "streaming",
          conversation_id: "",
          user: "abc-123"
        }),
      });

      await handlePondApiError(response, "Dify API");

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let fullResponse = "";
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove 'data: ' prefix
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.event === 'message' && data.answer) {
                fullResponse += data.answer;
              }
            } catch {
              // Silently skip parsing errors for incomplete JSON
              continue;
            }
          }
        }
      }

      if (!fullResponse) {
        throw new Error("No valid response received from the API");
      }

      return `Using Pond's Base Data Analyst model.\n\n${fullResponse}\n\nLast Updated: ${formatDate(new Date().toISOString())}`;
    } catch (error) {
      return `Error getting Base data analysis: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets Eth chain data analysis from Pond API
   *
   * @param args - Object containing the query to analyze
   * @returns A string containing the data analysis in a formatted way
   */
  @CreateAction({
    name: "get_eth_data_analysis",
    description: `
This tool will answer complex Ethereum data-based question from Pond API.
It requires a query string as input.

The response will include:
- Analysis results based on the query (already LLM interpreted and user friendly)
- Data completeness metrics
- Last update timestamp

Example query: "What are the most popular NFTs on Eth today?", "What are the top trending tokens in the last 12 hours on Ethereum?"


A failure response will return an error message with details.
`,
    schema: EthereumDataAnalystSchema.input,
  })
  async getEthDataAnalysis(args: z.infer<typeof EthereumDataAnalystSchema.input>): Promise<string> {
    if (!this.ethDifyApiKey) {
      return "Error: Eth Dify API key is required. Please provide it when initializing PondActionProvider.";
    }

    try {
      const response = await fetch(this.ETH_DIFY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.ethDifyApiKey}`
        },
        body: JSON.stringify({
          inputs: {},
          query: args.query,
          response_mode: "streaming",
          conversation_id: "",
          user: "abc-123"
        }),
      });

      await handlePondApiError(response, "Dify API");

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let fullResponse = "";
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove 'data: ' prefix
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.event === 'message' && data.answer) {
                fullResponse += data.answer;
              }
            } catch {
              // Silently skip parsing errors for incomplete JSON
              continue;
            }
          }
        }
      }

      if (!fullResponse) {
        throw new Error("No valid response received from the API");
      }

      return `Using Pond's Ethereum Data Analyst model.\n\n${fullResponse}\n\nLast Updated: ${formatDate(new Date().toISOString())}`;
    } catch (error) {
      return `Error getting Ethereum data analysis: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets token volatility prediction from Pond API
   *
   * @param args - Object containing the token address and timeframe to predict
   * @returns A string containing the volatility prediction analysis in a formatted way
   */
  @CreateAction({
    name: "get_token_volatility_prediction",
    description: `
This tool will get a token volatility prediction from Pond API for tokens on Base chain.
It requires:
1. A Base chain token contract address
2. Timeframe in hours (3, 6, 12, or 24) for the prediction period

The response will include:
- Predicted volatility percentage
- Prediction confidence based on data completeness
- Last feature update time

Example token address format: 0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85
Example timeframe: 3 (for 3 hour prediction)

A failure response will return an error message with details.
`,
    schema: TokenPricePredictionSchema.input,
  })
  async getTokenVolatilityPrediction(args: z.infer<typeof TokenPricePredictionSchema.input>): Promise<string> {
    try {
      // Handle missing or invalid timeframe
      if (!args.timeframe || !PondActionProvider.VOLATILITY_PREDICTION_MODEL_MAP[args.timeframe]) {
        const validTimeframes = Object.keys(PondActionProvider.VOLATILITY_PREDICTION_MODEL_MAP).join(', ');
        const defaultTimeframe = 24;
        const modelId = PondActionProvider.VOLATILITY_PREDICTION_MODEL_MAP[defaultTimeframe];
        
        const response = await fetch(this.API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            req_type: "1",
            access_token: this.apiKey,
            input_keys: [args.tokenAddress],
            model_id: modelId,
          }),
        });

        await handlePondApiError(response);

        const data = await response.json();
        const parsedResponse = TokenPricePredictionSchema.response.parse(data);
        const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

        if (!result) {
          throw new Error("No volatility prediction data available for this token");
        }

        if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
          return `
Warning: Limited Data Available

Based on Pond's volatility prediction model, the analysis for ${args.tokenAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Predicted Volatility: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.

Note: The requested timeframe is not available. Available timeframes are: ${validTimeframes} hours.
For the closest prediction to your request, please use one of these timeframes.
`;
        }

        // Convert score to percentage
        const volatilityPercent = (result.score * 100).toFixed(2);

        // Get the most recent feature update time
        const updateTimes = Object.entries(result.debug_info.feature_update_time)
          .filter(([time]) => time !== "null")
          .sort(([a], [b]) => b.localeCompare(a));
        const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

        return `
Volatility Prediction for ${args.tokenAddress} (${defaultTimeframe}h):

• Predicted Volatility: ${volatilityPercent}%
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;
      }

      const modelId = PondActionProvider.VOLATILITY_PREDICTION_MODEL_MAP[args.timeframe];
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.tokenAddress],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = TokenPricePredictionSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No volatility prediction data available for this token");
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's volatility prediction model, the analysis for ${args.tokenAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Predicted Volatility: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;
      }

      // Convert score to percentage
      const volatilityPercent = (result.score * 100).toFixed(2);

      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
Volatility Prediction for ${args.tokenAddress} (${args.timeframe}h):

• Predicted Volatility: ${volatilityPercent}%
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;

    } catch (error) {
      return `Error getting volatility prediction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets PumpFun price prediction from Pond API
   *
   * @param args - Object containing the token address and timeframe to predict
   * @returns A string containing the price prediction analysis in a formatted way
   */
  @CreateAction({
    name: "get_pumpfun_price_prediction",
    description: `
This tool will get a PumpFun price prediction from Pond API for tokens on Base chain.
It requires:
1. A Solana token address
2. Timeframe in hours (1, 3, 6, 12, or 24) for the prediction period

The response will include:
- Predicted price change percentage
- Prediction confidence based on data completeness
- Last feature update time

Example token address format: 14Ak6KegFHLANKALmpjdn1MFW477yvesX8cdzdVEpump
Example timeframe: 1 (for 1 hour prediction)

A failure response will return an error message with details.
`,
    schema: PumpFunPricePredictionSchema.input,
  })
  async getPumpFunPricePrediction(args: z.infer<typeof PumpFunPricePredictionSchema.input>): Promise<string> {
    try {
      // Handle missing or invalid timeframe
      if (!args.timeframe || !PondActionProvider.PUMPFUN_PREDICTION_MODEL_MAP[args.timeframe]) {
        const validTimeframes = Object.keys(PondActionProvider.PUMPFUN_PREDICTION_MODEL_MAP).join(', ');
        return `Invalid timeframe: ${args.timeframe} hours. Available timeframes are: ${validTimeframes} hours.`;
      }

      const modelId = PondActionProvider.PUMPFUN_PREDICTION_MODEL_MAP[args.timeframe];
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.tokenAddress],
          model_id: modelId,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = PumpFunPricePredictionSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No price prediction data available for this token");
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's PumpFun price prediction model, the analysis for ${args.tokenAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Predicted Change: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;
      }

      // Convert score to percentage
      const priceChangePercent = (result.score * 100).toFixed(2);
      const direction = result.score >= 0 ? "increase" : "decrease";

      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
PumpFun Price Prediction for ${args.tokenAddress} (${args.timeframe}h):

• Predicted Change: ${priceChangePercent}% (${direction})
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}

Note: This prediction is based on on-chain metrics and historical patterns.
Past performance does not guarantee future results.`;

    } catch (error) {
      return `Error getting PumpFun price prediction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets Zora NFT recommendations from Pond API
   *
   * @param args - Object containing the wallet address to get recommendations for
   * @returns A string containing the NFT recommendations in a formatted way
   */
  @CreateAction({
    name: "get_zora_nft_recommendations",
    description: `
This tool will get Zora NFT recommendations from Pond API based on a wallet's preferences and activity.
It requires an Ethereum wallet address as input.

The response will include:
- Top NFT recommendations with similarity scores
- Collection addresses and token IDs
- Recommendation confidence based on data completeness

Example wallet address format: 0x306d676e137736264fb7fbccec280b589dffcbd1

A failure response will return an error message with details.
`,
    schema: ZoraNFTRecommendationSchema.input,
  })
  async getZoraNFTRecommendations(args: z.infer<typeof ZoraNFTRecommendationSchema.input>): Promise<string> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.walletAddress],
          model_id: PondActionProvider.ZORA_NFT_RECOMMENDATION_MODEL_ID,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = ZoraNFTRecommendationSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No NFT recommendations available for this wallet address");
      }

      if (!result.candidates || result.candidates.length === 0) {
        return `
No NFT Recommendations Available

Based on Pond's NFT recommendation model, no recommendations could be generated for ${args.walletAddress}.
This could be due to:
• Limited wallet activity
• No matching preferences found
• Insufficient data for recommendations

Please try again later or check if this is a new or inactive wallet address.
`;
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's NFT recommendation model, the analysis for ${args.walletAddress} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%

Note: These recommendations may not be reliable due to limited available data.
Please check if this is a new or inactive wallet address.
`;
      }

      // Format the recommendations
      const recommendations = result.candidates
        .slice(0, 10) // Get top 10 recommendations
        .map((candidate, index) => {
          const [collectionAddress, tokenId] = candidate.item_id.split('_');
          const similarityScore = (candidate.score * 100).toFixed(2);
          return `${index + 1}. Collection: ${collectionAddress}
   • Token ID: ${tokenId}
   • Similarity Score: ${similarityScore}%`;
        })
        .join('\n\n');

      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
Based on Pond's Zora NFT recommendation model for ${args.walletAddress}:

Top NFT Recommendations:
${recommendations}

Data Quality:
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}

Note: Similarity scores range from 0% to 100%, where higher scores indicate better matches to your preferences.
These recommendations are based on your wallet's activity and preferences on Zora.`;

    } catch (error) {
      return `Error getting Zora NFT recommendations: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets security assessment from Pond API
   *
   * @param args - Object containing the address to analyze
   * @returns A string containing the security assessment in a formatted way
   */
  @CreateAction({
    name: "get_security_assessment",
    description: `
This tool will get a security assessment from Pond API to identify potential security risks.
It analyzes patterns of behavior to pinpoint malicious addresses, phishing accounts, and vulnerable smart contracts.

It requires an Ethereum address as input.

The response will include:
- Security risk score (0 to 1, where higher scores indicate higher risk)
- Risk level categorization
- Feature completeness metrics
- Last update timestamp

Example address format: 0xd885c064ddaa010d4a1735dcbaa3cd8fe52e127e

A failure response will return an error message with details.
`,
    schema: SecurityModelSchema.input,
  })
  async getSecurityAssessment(args: z.infer<typeof SecurityModelSchema.input>): Promise<string> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          req_type: "1",
          access_token: this.apiKey,
          input_keys: [args.address],
          model_id: PondActionProvider.SECURITY_MODEL_ID,
        }),
      });

      await handlePondApiError(response);

      const data = await response.json();
      const parsedResponse = SecurityModelSchema.response.parse(data);
      const result = parsedResponse.data?.[0] || parsedResponse.resp_items?.[0];

      if (!result) {
        throw new Error("No security assessment data available for this address");
      }

      if (!result.debug_info.not_null_feature || parseFloat(result.debug_info.not_null_feature) < 50) {
        return `
Warning: Limited Data Available

Based on Pond's security assessment model, the analysis for ${args.address} is incomplete due to insufficient data:
• Data Completeness: ${result.debug_info.not_null_feature || '0'}%
• Risk Score: ${(result.score * 100).toFixed(2)}% (low confidence)

Note: This assessment is based on behavioral patterns and known security indicators.
Please check if this is a new or inactive address.
`;
      }

      // Convert score to percentage and determine risk level
      const riskPercentage = (result.score * 100).toFixed(2);
      
      // Get the most recent feature update time
      const updateTimes = Object.entries(result.debug_info.feature_update_time)
        .filter(([time]) => time !== "null")
        .sort(([a], [b]) => b.localeCompare(a));
      const latestUpdate = updateTimes[0] ? updateTimes[0][0] : "unknown";

      return `
Security Assessment for ${args.address}:

• Risk Score: ${riskPercentage}%
• Data Completeness: ${result.debug_info.not_null_feature}
• Last Updated: ${formatDate(latestUpdate)}`;

    } catch (error) {
      return `Error getting security assessment: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the provider supports a given network
   *
   * @returns Always returns true as Pond service supports Ethereum
   */
  supportsNetwork(): boolean {
    return true; // Pond service supports Ethereum network
  }
}

export const pondActionProvider = (config: PondActionProviderConfig = {}) =>
  new PondActionProvider(config); 