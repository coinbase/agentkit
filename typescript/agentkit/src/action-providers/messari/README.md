# Messari Action Provider

This directory contains the Messari action provider implementation, which provides actions to interact with the Messari AI toolkit for fetching DeFi research, market information, and protocol details.

## Getting Started

To use the Messari Action Provider, you need to obtain a Messari API key by following these steps:

1. Sign up for a [Messari account](https://messari.io/)
2. Navigate to [messari.io/account/api](https://messari.io/account/api)
3. Generate your API key from the account dashboard

For more detailed information about authentication, refer to the [Messari API Authentication documentation](https://docs.messari.io/reference/authentication).

### Environment Variables

```
MESSARI_API_KEY
```

Alternatively you can configure the provider directly during initializing:

```typescript
import { messariActionProvider } from "@coinbase/agentkit";

const provider = messariActionProvider({
  apiKey: "your_messari_api_key",
});
```

## Directory Structure

```
messari/
├── constants.ts                   # API endpoints and other constants
├── messariActionProvider.test.ts  # Tests for the provider
├── messariActionProvider.ts       # Main provider with Messari API functionality
├── index.ts                       # Main exports
├── README.md                      # Documentation
├── schemas.ts                     # Messari action schemas
├── types.ts                       # Type definitions
└── utils.ts                       # Utility functions
```

## Actions

- `research_question`: Query the Messari AI toolkit with a research question
  - Submit natural language questions about crypto markets, protocols, or tokens
  - Returns detailed research information compiled from Messari's data sources
  - Handles various question types including market data, tokenomics, and project analysis
  - Returns formatted results or descriptive error messages

## Rate Limiting

The Messari API has rate limits based on your subscription tier:

| Subscription Tier | Daily Request Limit |
|-------------------|---------------------|
| Free (Unpaid)     | 2 requests per day  |
| Lite              | 10 requests per day |
| Pro               | 20 requests per day |
| Enterprise        | 50 requests per day |

Contact Messari's sales team for custom rate limits above 50 requests per day.

## Examples

### Token Market Data

*What is the current price of Ethereum?*

<details>
<summary>Tool Output</summary>

```
Messari Research Results:

As of March 26, 2025, the current metrics for Ethereum (ETH) across major cryptocurrency exchanges are as follows:

- **Current Price**: $2,012.99
- **24-hour Price Change**:
  - **Absolute Value**: -$55.31
  - **Percentage**: -2.67%
- **Current Market Capitalization**: $242,471,578,768
- **24-hour Trading Volume**: $7,011,385,937.27
- **Circulating Supply**: 120,639,295.2 ETH

The data is based on the latest available information from our asset data sources as of the specified date.
```
</details>

<details>
<summary>Agent Output</summary>

```
As of March 26, 2025, the current price of Ethereum (ETH) is **$2,012.99**. Here are some additional metrics:

- **24-hour Price Change**: 
  - Absolute Value: -$55.31 
  - Percentage: -2.67%
- **Current Market Capitalization**: $242,471,578,768
- **24-hour Trading Volume**: $7,011,385,937.27
- **Circulating Supply**: 120,639,295.2 ETH

If you need more information or assistance, feel free to ask!
```
</details>

### Protocol News

*Tell me about the recent news regarding the Hyperliquid token vault HLP that caused some commotion?*

<details>
<summary>Tool Output</summary>

```
Messari Research Results:

Over the past few months, Hyperliquid's HLP vault has faced significant challenges due to a few critical incidents. Here's a detailed overview:

### Recent Events and Incidents

1. **Exploit Incident**:
   - **Date**: Around March 11-12, 2025.
   - **Details**: A significant exploit occurred where a whale managed to manipulate the liquidity mechanics, resulting in a $4 million loss for Hyperliquid's HLP vault. The whale executed a $340 million Ethereum position and, through strategic margin withdrawals, triggered a forced liquidation. Although initially mistaken for a hack, the event was confirmed not to be a protocol exploit.
   - **Platform Response**: Hyperliquid implemented changes to its margin requirements and reduced the maximum leverage limits on Bitcoin and Ethereum to prevent similar incidents in the future [News Sources].

2. **Price Impact**:
   - **HYPE Token**: The HYPE token associated with the platform dropped significantly by around 8.5% immediately following the incident, reflecting investor anxiety and loss of confidence. Although it recovered slightly, it's been noted that there has been a decline of about 44% over the month even before the incident [Price Impact].

### Function of HLP in Hyperliquid Ecosystem

- **Role**: The HLP (Hyperliquidity Provider) vault is a crucial component of Hyperliquid, supporting high-throughput financial operations. It allows users to deposit USDC in exchange for potential profit sharing, effectively underwriting a portion of the platform's trading risk.
- **Performance**: Despite the recent setback, the HLP vault had maintained a strong risk-adjusted performance with an average annual return of 12.07%, continuing to be a high-performing asset on a volatility-adjusted basis.

### Governance and Parameter Changes

- **Governance Response**: To mitigate future risks, Hyperliquid's governance team has quickly responded with parameter changes, including increasing maintenance margins and lowering leverage caps to ensure a more stable operational environment [Governance Sources].

### Community and User Sentiment

- **Concerns and Discussions**: The losses triggered debates over the inherent risks associated with active liquidity management models like HLP, compared to passive models. Discussions have focused on the need for robust risk management strategies within DeFi platforms [Community Discussions].

### Credibility of Sources

The information is gathered from credible news articles published on established DeFi and cryptocurrency media outlets. The citations used for these details are among recognized sources that specialize in blockchain and financial technology reporting.

Overall, the series of incidents has negatively impacted Hyperliquid's market perception and investor confidence in the short term, though the platform has taken decisive steps to address vulnerabilities and reassure its user base.
```
</details>

<details>
<summary>Agent Output</summary>

```
The recent news surrounding Hyperliquid's HLP (Hyperliquidity Provider) vault highlights a significant incident that stirred commotion in the community:

### Key Events

1. **Exploit Incident**:
   - **Date**: Around March 11-12, 2025.
   - **Details**: A whale manipulated liquidity mechanics, leading to a $4 million loss for the HLP vault. The manipulative action involved a $340 million Ethereum position and strategically timed margin withdrawals that caused forced liquidations. This event was initially feared as a protocol exploit but was later confirmed not to be so.
   - **Response**: In reaction to the incident, Hyperliquid adjusted its margin requirements and lowered maximum leverage limits on Ethereum and Bitcoin to mitigate future risks.

2. **Price Impact**:
   - Following the incident, the HYPE token experienced an immediate dip of approximately 8.5%. Over the month leading up to the incident, the token had already seen a decline of about 44%, reflecting broader concerns among investors.

### HLP Vault's Role
The HLP vault is critical within Hyperliquid's ecosystem, allowing users to deposit USDC in exchange for potential profit sharing, thus underwriting a portion of the liquidity risk associated with trading on the platform. Despite recent setbacks, it had a solid average annual return of 12.07%.

### Governance Actions
The governance team promptly responded to the situation by enhancing the platform's risk parameters, including increasing maintenance margins and reducing leverage thresholds to stabilize operations.

### Community Sentiment
The incident has sparked discussions within the community about the risks associated with active liquidity management models and the necessity for robust risk management strategies in DeFi platforms.

These events have adversely affected Hyperliquid's standing in the market, though the platform has taken proactive steps to address vulnerabilities and restore confidence among its users.
```
</details>

## Adding New Actions

To add new Messari actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `messariActionProvider.ts`
3. Add corresponding tests in `messariActionProvider.test.ts`

The provider is network-agnostic and can be used with any blockchain network.