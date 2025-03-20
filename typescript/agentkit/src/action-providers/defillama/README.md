# DefiLlama Action Provider

This directory contains the DefiLlama action provider implementation, which provides actions to interact with the DefiLlama API for fetching DeFi protocol information and token prices.

## Directory Structure

```
defillama/
├── constants.ts                    # API endpoints and other constants
├── defillamaActionProvider.test.ts # Tests for the provider
├── defillamaActionProvider.ts      # Main provider with DefiLlama API functionality
├── index.ts                        # Main exports
├── README.md                       # Documentation
├── schemas.ts                      # DefiLlama action schemas
└── types.ts                        # Type definitions
```

## Actions

- `find_protocol`: Search for protocols by name

  - Case-insensitive search across all DefiLlama protocols
  - Returns array of matching protocols with metadata
  - Returns descriptive message when no matches found

- `get_protocol`: Get detailed information about a specific protocol

  - Fetches comprehensive protocol data including TVL
  - Returns formatted JSON with protocol details
  - Handles non-existent protocols gracefully

- `get_token_prices`: Get current prices for specified tokens
  - Accepts tokens with chain prefix (e.g., 'ethereum:0x...')
  - Optional time range parameter for historical prices
  - Returns formatted JSON with current token prices

## Examples

### Finding a Protocol

```bash
Prompt: can you search for an eigen protocol?

-------------------
[
  {
    "id": "3107",
    "name": "EigenLayer",
    "address": "0xec53bf9167f50cdeb3ae105f56099aaab9061f83",
    "symbol": "EIGEN",
    "url": "https://www.eigenlayer.xyz/",
    "description": "EigenLayer is a protocol built on Ethereum that introduces restaking, a new primitive in cryptoeconomic security. This primitive enables the reuse of ETH on the consensus layer",
    "chain": "Ethereum",
    "logo": "https://icons.llama.fi/eigenlayer.png",
    "audits": "2",
    "audit_note": null,
    "gecko_id": "eigenlayer",
    "cmcId": null,
    "category": "Restaking",
    "chains": [
      "Ethereum"
    ],
    "module": "eigenlayer/index.js",
    "twitter": "eigenlayer",
    "oracles": [],
    "forkedFrom": [],
    "audit_links": [
      "https://docs.eigenlayer.xyz/security/audits"
    ],
    "github": [
      "Layr-Labs"
    ],
    "listedAt": 1686776222,
    "slug": "eigenlayer",
    "tvl": 8951735130.458426,
    "chainTvls": {
      "Ethereum-staking": 522332864.5310426,
      "Ethereum": 8951735130.458426,
      "staking": 522332864.5310426
    },
    "change_1h": -0.8573676649778434,
    "change_1d": -11.65410033967217,
    "change_7d": -14.671214345715782,
    "tokenBreakdowns": {},
    "mcap": 336877554.1087164,
    "staking": 522332864.5310426
  },
  {
    "id": "4075",
    "name": "Eigenpie",
    "address": null,
    "symbol": "-",
    "url": "https://www.eigenlayer.magpiexyz.io",
    "description": "Eigenpie is an innovative SubDAO created by Magpie, focusing on the restaking of ETH LSTs via EigenLayer. As a liquid restaking platform for Ethereum, Eigenpie’s core mechanism enables users to convert their Liquid Staked ETH tokens into Isolated Liquid Restaked ETH tokens. These are restaked versions of ETH LSTs, created by Eigenpie. This process allows users to earn passive income from Ethereum staking and EigenLayer revenue simultaneously, without requiring a lockup period.",
    "chain": "Multi-Chain",
    "logo": "https://icons.llama.fi/eigenpie.jpg",
    "audits": "2",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Liquid Restaking",
    "chains": [
      "Zircuit",
      "Ethereum"
    ],
    "oracles": [
      "Chainlink"
    ],
    "forkedFrom": [],
    "module": "eigenpie/index.js",
    "twitter": "Eigenpiexyz_io",
    "parentProtocol": "parent#magpie-ecosystem",
    "audit_links": [
      "https://github.com/peckshield/publications/blob/master/audit_reports/PeckShield-Audit-Report-Eigenpie-v1.0.pdf"
    ],
    "listedAt": 1706537731,
    "slug": "eigenpie",
    "tvl": 552741078.9743935,
    "chainTvls": {
      "Zircuit": 341269361.5768466,
      "Ethereum": 211471717.39754686
    },
    "change_1h": 3.8755075071811547,
    "change_1d": -7.644740844217878,
    "change_7d": -13.991325628506374,
    "tokenBreakdowns": {},
    "mcap": null
  }
]
-------------------
I found two protocols related to "Eigen":

1. **EigenLayer**
   - **Description:** EigenLayer is a protocol built on Ethereum that introduces restaking, enabling the reuse of ETH on the consensus layer for cryptoeconomic security.
   - **Symbol:** EIGEN
   - **Chain:** Ethereum
   - **TVL:** $8,951,735,130.46
   - **Market Cap:** $336,877,554.11
   - **1h Change:** -0.86%
   - **1d Change:** -11.65%
   - **URL:** [EigenLayer](https://www.eigenlayer.xyz/)
   - **Logo:** ![EigenLayer Logo](https://icons.llama.fi/eigenlayer.png)
   - **Audit Information:** [Audit Links](https://docs.eigenlayer.xyz/security/audits)

2. **Eigenpie**
   - **Description:** Eigenpie is an innovative SubDAO created by Magpie, focusing on the restaking of ETH LSTs via EigenLayer, allowing users to earn passive income from both Ethereum staking and EigenLayer revenue.
   - **Chain:** Multi-Chain (Zircuit, Ethereum)
   - **TVL:** $552,741,078.97
   - **1h Change:** +3.88%
   - **1d Change:** -7.64%
   - **URL:** [Eigenpie](https://www.eigenlayer.magpiexyz.io)
   - **Logo:** ![Eigenpie Logo](https://icons.llama.fi/eigenpie.jpg)
   - **Audit Information:** [Audit Report](https://github.com/peckshield/publications/blob/master/audit_reports/PeckShield-Audit-Report-Eigenpie-v1.0.pdf)

Let me know if you would like more details on either protocol!
-------------------
```

### Getting Protocol Details
```bash
Prompt: please use get_protocol for jito

-------------------
{
  "id": "2308",
  "name": "Jito",
  "address": "solana:jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  "symbol": "JTO",
  "url": "https://jito.network",
  "description": "MEV-Boosted Staking Rewards",
  "chain": "Solana",
  "logo": "https://icons.llama.fi/jito.png",
  "audits": "2",
  "audit_note": null,
  "gecko_id": "jito-governance-token",
  "cmcId": null,
  "category": "Liquid Staking",
  "chains": [
    "Solana"
  ],
  "module": "jito/index.js",
  "twitter": "jito_sol",
  "forkedFrom": [
    "SPL Stake Pool"
  ],
  "audit_links": [
    "https://spl.solana.com/stake-pool#security-audits",
    "https://2926710696-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Ffrb9MGTK6eZJlEQJyylq%2Fuploads%2F1jfEDpGcd5YlnHusbKYO%2FNeodymeJito.pdf"
  ],
  "oracles": [],
  "oraclesBreakdown": [
    {
      "name": "Switchboard",
      "type": "Secondary",
      "proof": [
        "https://github.com/DefiLlama/defillama-server/pull/9193"
      ]
    }
  ],
  "listedAt": 1669265429,
  "github": [
    "jito-foundation"
  ],
  "chainTvls": {
    "Solana": {
      "tvl": [
        {
          "date": 1741842011,
          "totalLiquidityUSD": 2050645658.69502
        },
        ...
      ],
      "tokensInUsd": [
        {
          "date": 1741842011,
          "tokens": {
            "SOL": 2050645658.69502
          }
        },
        ...
      ],
      "tokens": [
        {
          "date": 1741842011,
          "tokens": {
            "SOL": 16533464.95763
          }
        },
        ...
      ]
    }
  },
  "tvl": [
    {
      "date": 1741842011,
      "totalLiquidityUSD": 2050645658.69502
    },
    ...
  ],
  "tokensInUsd": [
    {
      "date": 1741842011,
      "tokens": {
        "SOL": 2050645658.69502
      }
    },
    ...
  ],
  "tokens": [
    {
      "date": 1741842011,
      "tokens": {
        "SOL": 16533464.95763
      }
    },
    ...
  ],
  "currentChainTvls": {
    "Solana": 2050645658.69502
  },
  "raises": [],
  "metrics": {},
  "mcap": 642311894.5063655,
  "methodology": "Uses the SPL Stake Pool SDK to fetch the total supply of deposited SOL into the Jito Stake Pool"
}
-------------------
Here are the details for the Jito protocol:

- **Name:** Jito
- **Address:** [jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL](https://explorer.solana.com/address/jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL)
- **Symbol:** JTO
- **Description:** MEV-Boosted Staking Rewards
- **Category:** Liquid Staking
- **Chains:** Solana
- **Current TVL:** $2,050,645,658.70
- **Market Cap:** $642,311,894.51
- **Audits:** 2
- **Audit Links:**
  - [Audit 1](https://spl.solana.com/stake-pool#security-audits)
  - [Audit 2](https://2926710696-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Ffrb9MGTK6eZJlEQJyylq%2Fuploads%2F1jfEDpGcd5YlnHusbKYO%2FNeodymeJito.pdf)
- **Twitter:** [@jito_sol](https://twitter.com/jito_sol)
- **Website:** [jito.network](https://jito.network)
  
![Jito Logo](https://icons.llama.fi/jito.png)

### Historical TVL Data:
- **Date:** 2023-08-07 - TVL: $2,050,645,658.70
- **Date:** 2023-08-06 - TVL: $2,073,190,249.57
- **Date:** 2023-08-05 - TVL: $1,878,593,066.31
- **Date:** 2023-08-04 - TVL: $2,060,444,245.40
- **Date:** 2023-08-03 - TVL: $2,266,226,563.53

For more technical inquiries, the protocol utilizes the SPL Stake Pool SDK for its operations.
-------------------
````

### Getting Token Prices
```bash
Prompt: What is the current price of USDC and WETH on Ethereum? USDC's token address is: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48, WETH's token address is: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

-------------------
{
  "coins": {
    "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      "decimals": 6,
      "symbol": "USDC",
      "price": 0.999958,
      "timestamp": 1741115101,
      "confidence": 0.99
    },
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
      "decimals": 18,
      "symbol": "WETH",
      "price": 2154.41,
      "timestamp": 1741115124,
      "confidence": 0.99
    }
  }
}
-------------------
The current prices on Ethereum are as follows:
- USDC: approximately $0.999958
- WETH: approximately $2154.41
-------------------
````

## Adding New Actions

To add new DefiLlama actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `defillamaActionProvider.ts`
3. Add corresponding tests in `defillamaActionProvider.test.ts`

Note: The provider is network-agnostic and can be used with any blockchain network supported by DefiLlama.
