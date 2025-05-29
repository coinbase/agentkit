# Pond Action Provider

This directory contains the Pond action provider implementation, which provides actions to interact with the Pond API for wallet risk assessment, token analysis, and chain-specific data analysis.

## Getting Started

To use the Pond Action Provider, you need to obtain the following API keys:

1. Pond API Key:
   - Default key is limited to 10,000 requests
   - For higher request limits, contact us through secure channels

2. Base Dify API Key:
   - Required for Base chain data analyst queries
   - Used for natural language queries about Base chain data

3. Ethereum Dify API Key:
   - Required for Ethereum chain data analyst queries
   - Used for natural language queries about Ethereum chain data

### Environment Variables

```
POND_API_KEY
BASE_DIFY_API_KEY
ETH_DIFY_API_KEY
```

Alternatively, you can configure the provider directly during initialization:

```typescript
import { pondActionProvider } from "@coinbase/agentkit";

const provider = pondActionProvider({
  apiKey: "your_pond_api_key",
  baseDifyApiKey: "your_base_dify_api_key",
  ethDifyApiKey: "your_eth_dify_api_key"
});
```

## Directory Structure

```
pond/
├── constants.ts                   # API endpoints and other constants
├── pondActionProvider.test.ts     # Tests for the provider
├── pondActionProvider.ts          # Main provider with Pond API functionality
├── index.ts                       # Main exports
├── README.md                      # Documentation
├── schemas.ts                     # Pond action schemas
└── types.ts                       # Type definitions
```

## Actions

- `getWalletRiskScore`: Get risk assessment for a wallet
  - Supports multiple risk assessment models
  - Provides risk score, level, and feature completeness
  - Models: OlehRCL (default), 22je0569, Wellspring Praise

- `getWalletSummary`: Get comprehensive wallet analysis
  - DEX trading activity
  - Transaction metrics
  - Portfolio diversity
  - Gas usage analysis

- `getSybilPrediction`: Detect potential Sybil attacks
  - Analyzes wallet behavior patterns
  - Identifies multi-account farming activities

- `getTokenPricePrediction`: Predict token price movements
  - Multiple timeframe predictions (1-24 hours)
  - Price movement forecasts
  - Risk level assessment

- `getTokenRiskScores`: Get token risk assessment
  - Multiple risk assessment models
  - Comprehensive token analysis
  - Market performance metrics

- `getTopSolanaMemeCoins`: Analyze Solana meme coins
  - Top 10 meme coins analysis
  - Price change predictions
  - Trading activity metrics

- `getBaseDataAnalysis`: Query Base chain data
  - Natural language queries
  - Token analysis
  - NFT analysis
  - Market analysis

- `getEthDataAnalysis`: Query Ethereum chain data
  - Natural language queries
  - Token analysis
  - NFT analysis
  - Market analysis

## Rate Limiting

The default Pond API key is limited to 10,000 requests. For higher request limits, please contact us through secure channels (email or official platform) to obtain an API key with extended capabilities.

## Error Handling

The provider includes comprehensive error handling for:
- Missing API keys
- Invalid wallet addresses
- API connection issues
- Response parsing errors
- Server-side errors
- Rate limiting
- Authentication failures

Errors are returned as formatted strings with relevant details. 