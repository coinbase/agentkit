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
Prompt: what are the details for the uniswap protocol?

-------------------
[
  {
    "id": "2198",
    "name": "Uniswap V3",
    "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "symbol": "UNI",
    "url": "https://uniswap.org/",
    "description": "A fully decentralized protocol for automated liquidity provision on Ethereum. V2\r\n",
    "chain": "Multi-Chain",
    "logo": "https://icons.llama.fi/uniswap-v3.png",
    "audits": "2",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Dexs",
    "chains": [
      "Ethereum",
      "Arbitrum",
      "Base",
      "Polygon",
      "BOB",
      "Optimism",
      "Binance",
      "Celo",
      "RSK",
      "Avalanche",
      "xDai",
      "zkSync Era",
      "World Chain",
      "Sonic",
      "Filecoin",
      "Lisk",
      "Sei",
      "Unichain",
      "Scroll",
      "Boba",
      "Corn",
      "Mantle",
      "Taiko",
      "Linea",
      "Blast",
      "Moonbeam",
      "Manta",
      "Polygon zkEVM",
      "Hemi"
    ],
    "module": "uniswap/index.js",
    "twitter": "Uniswap",
    "audit_links": [
      "https://github.com/Uniswap/uniswap-v3-core/tree/main/audits",
      "https://github.com/Uniswap/uniswap-v3-periphery/tree/main/audits",
      "https://github.com/ConsenSys/Uniswap-audit-report-2018-12"
    ],
    "oracles": [],
    "listedAt": 1666191475,
    "parentProtocol": "parent#uniswap",
    "hallmarks": [
      [
        1588610042,
        "UNI V2 Launch"
      ],
      [
        1598412107,
        "SushiSwap launch"
      ],
      [
        1599535307,
        "SushiSwap migration"
      ],
      [
        1600226507,
        "LM starts"
      ],
      [
        1605583307,
        "LM ends"
      ],
      [
        1617333707,
        "FEI launch"
      ],
      [
        1620156420,
        "UNI V3 Launch"
      ]
    ],
    "methodology": "Counts the tokens locked on AMM pools, pulling the data from the 'ianlapham/uniswapv2' subgraph",
    "slug": "uniswap-v3",
    "tvl": 2666832397.3991027,
    "chainTvls": {
      "Sei": 643875.4178920466,
      "Moonbeam": 18837.05591164746,
      "Mantle": 183564.29786708835,
      "Scroll": 447814.2170484888,
      "Polygon zkEVM": 1725.4066256271485,
      "RSK": 14730139.06545205,
      "Sonic": 1724357.099139596,
      "Filecoin": 1080408.157338146,
      "Lisk": 883342.2860428104,
      "Boba": 251241.0027453811,
      "xDai": 6645699.092100635,
      "Manta": 3221.960094328931,
      "BOB": 40326113.56049938,
      "Linea": 122181.4935892294,
      "Hemi": 71.16403658378795,
      "Corn": 201611.7471729989,
      "Taiko": 146770.88143452335,
      "World Chain": 1750741.6954234592,
      "Optimism": 36253496.25537226,
      "zkSync Era": 6106203.079069815,
      "Celo": 17497502.13105509,
      "Binance": 25001443.02504841,
      "Avalanche": 9084946.253697164,
      "Arbitrum": 219532681.19632608,
      "Unichain": 464331.0607344189,
      "Polygon": 80166921.41906343,
      "Base": 189651371.89547607,
      "Ethereum": 2013848329.4384897,
      "Blast": 63456.04435633023
    },
    "change_1h": 0.48199257309811117,
    "change_1d": -6.522510159194255,
    "change_7d": -8.097323544183809,
    "tokenBreakdowns": {},
    "mcap": null
  },
  {
    "id": "2197",
    "name": "Uniswap V2",
    "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "symbol": "UNI",
    "url": "https://uniswap.org/",
    "description": "A fully decentralized protocol for automated liquidity provision on Ethereum. V2\r\n",
    "chain": "Multi-Chain",
    "logo": "https://icons.llama.fi/uniswap-v2.png",
    "audits": "2",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Dexs",
    "chains": [
      "Ethereum",
      "Base",
      "Arbitrum",
      "Polygon",
      "Binance",
      "Unichain",
      "Optimism",
      "Avalanche",
      "Zora",
      "Celo"
    ],
    "module": "uniswap-v2/index.js",
    "twitter": "Uniswap",
    "audit_links": [
      "https://github.com/Uniswap/uniswap-v3-core/tree/main/audits",
      "https://github.com/Uniswap/uniswap-v3-periphery/tree/main/audits",
      "https://github.com/ConsenSys/Uniswap-audit-report-2018-12"
    ],
    "oracles": [],
    "listedAt": 1666191162,
    "parentProtocol": "parent#uniswap",
    "misrepresentedTokens": true,
    "methodology": "Counts the tokens locked on AMM pools, pulling the data from the 'ianlapham/uniswapv2' subgraph",
    "slug": "uniswap-v2",
    "tvl": 1156878867.260982,
    "chainTvls": {
      "Ethereum": 1060369789.8096,
      "Base": 84512486.25257461,
      "Celo": 0,
      "Zora": 33554.697907160575,
      "Optimism": 138691.08729119675,
      "Polygon": 2797925.31793269,
      "Binance": 595373.4893537847,
      "Arbitrum": 7772312.727282784,
      "Avalanche": 121378.5175105257,
      "Unichain": 537355.3615293419
    },
    "change_1h": -1.6131998127834208,
    "change_1d": -12.355146575657002,
    "change_7d": -15.860846829182165,
    "tokenBreakdowns": {},
    "mcap": null
  },
  {
    "id": "5690",
    "name": "Uniswap V4",
    "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "symbol": "UNI",
    "url": "https://uniswap.org/",
    "description": "Uniswap v4 inherits all of the capital efficiency gains of Uniswap v3, but provides flexibility via hooks and gas optimizations across the entire lifecycle",
    "chain": "Multi-Chain",
    "logo": "https://icons.llama.fi/uniswap-v4.png",
    "audits": "2",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Dexs",
    "chains": [
      "Ethereum",
      "Arbitrum",
      "Base",
      "Polygon",
      "Unichain",
      "Binance",
      "Optimism",
      "Avalanche",
      "Zora",
      "World Chain",
      "Blast",
      "Soneium",
      "Ink"
    ],
    "module": "uniswap-v4/index.js",
    "twitter": "Uniswap",
    "audit_links": [
      "https://github.com/Uniswap/v4-core/tree/main/docs/security/audits",
      "https://github.com/Uniswap/v4-periphery/tree/main/audits"
    ],
    "oracles": [],
    "parentProtocol": "parent#uniswap",
    "listedAt": 1738172667,
    "slug": "uniswap-v4",
    "tvl": 91466724.87280709,
    "chainTvls": {
      "Soneium": 3.998604000697,
      "Blast": 239.7541862254068,
      "Zora": 1392.5607158156145,
      "Ink": 1.7851687545478967,
      "World Chain": 559.4300691578078,
      "Avalanche": 18344.60564951324,
      "Optimism": 420268.0548216927,
      "Unichain": 1365846.6230444242,
      "Arbitrum": 13006578.382675003,
      "Binance": 1134566.0701749327,
      "Polygon": 2207939.6838974506,
      "Ethereum": 68397710.13913272,
      "Base": 4913273.784667388
    },
    "change_1h": 1.611473690154071,
    "change_1d": -3.1260049306798976,
    "change_7d": 13.231814337997449,
    "tokenBreakdowns": {},
    "mcap": null
  },
  {
    "id": "2196",
    "name": "Uniswap V1",
    "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "symbol": "UNI",
    "url": "https://uniswap.org/",
    "description": "A fully decentralized protocol for automated liquidity provision on Ethereum. V1\r\n",
    "chain": "Ethereum",
    "logo": "https://icons.llama.fi/uniswap-v1.png",
    "audits": "2",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Dexs",
    "chains": [
      "Ethereum"
    ],
    "module": "uniswap-v1/index.js",
    "twitter": "Uniswap",
    "audit_links": [
      "https://github.com/Uniswap/uniswap-v3-core/tree/main/audits",
      "https://github.com/Uniswap/uniswap-v3-periphery/tree/main/audits",
      "https://github.com/ConsenSys/Uniswap-audit-report-2018-12"
    ],
    "oracles": [],
    "listedAt": 1666191149,
    "parentProtocol": "parent#uniswap",
    "misrepresentedTokens": true,
    "methodology": "Counts the tokens in ETH value locked in AMM pools",
    "slug": "uniswap-v1",
    "tvl": 5294394.107778839,
    "chainTvls": {
      "Ethereum": 5294394.107778839
    },
    "change_1h": -1.139298562887575,
    "change_1d": -10.24928961300003,
    "change_7d": -12.057941024983066,
    "tokenBreakdowns": {},
    "mcap": null
  },
  {
    "id": "3657",
    "name": "Uniswap Labs",
    "address": null,
    "symbol": "-",
    "url": "https://uniswap.org/",
    "description": "We contribute to Uniswap - a protocol for trading and automated liquidity provision on Ethereum",
    "logo": "https://icons.llama.fi/uniswap-labs.png",
    "audits": "0",
    "audit_note": null,
    "gecko_id": null,
    "cmcId": null,
    "category": "Developer Tools",
    "chains": [],
    "oracles": [],
    "forkedFrom": [],
    "module": "dummy.js",
    "twitter": "Uniswap",
    "listedAt": 1697674181,
    "misrepresentedTokens": false,
    "hallmarks": [],
    "slug": "uniswap-labs",
    "tvl": 0,
    "chainTvls": {},
    "change_1h": null,
    "change_1d": null,
    "change_7d": null,
    "tokenBreakdowns": {},
    "mcap": null
  }
]
-------------------
Here are the details for the Uniswap protocol across its different versions:

### Uniswap V3
- **Name:** Uniswap V3
- **Description:** A fully decentralized protocol for automated liquidity provision on Ethereum.
- **Symbol:** UNI
- **Chain:** Multi-Chain
- **Website:** [uniswap.org](https://uniswap.org/)
- **Logo:** ![Uniswap V3 Logo](https://icons.llama.fi/uniswap-v3.png)
- **Audits:** 2
- **Total Value Locked (TVL):** ~ $2.67 billion
- **Chains Supported:** Ethereum, Arbitrum, Base, Polygon, and many others.
- **Twitter:** [Uniswap](https://twitter.com/Uniswap)
- **Audit Links:**
  - [Uniswap V3 Core Audits](https://github.com/Uniswap/uniswap-v3-core/tree/main/audits)
  - [Uniswap V3 Periphery Audits](https://github.com/Uniswap/uniswap-v3-periphery/tree/main/audits)

### Uniswap V2
- **Name:** Uniswap V2
- **Description:** A fully decentralized protocol for automated liquidity provision on Ethereum.
- **Symbol:** UNI
- **Chain:** Multi-Chain
- **Website:** [uniswap.org](https://uniswap.org/)
- **Logo:** ![Uniswap V2 Logo](https://icons.llama.fi/uniswap-v2.png)
- **Audits:** 2
- **Total Value Locked (TVL):** ~ $1.16 billion
- **Chains Supported:** Ethereum, Base, Arbitrum, Polygon, and more.
- **Twitter:** [Uniswap](https://twitter.com/Uniswap)
- **Audit Links:** [Audits](https://github.com/Uniswap/uniswap-v3-core/tree/main/audits)

### Uniswap V4
- **Name:** Uniswap V4
- **Description:** Uniswap v4 inherits all of the capital efficiency gains of Uniswap v3, providing flexibility via hooks and gas optimizations.
- **Symbol:** UNI
- **Chain:** Multi-Chain
- **Website:** [uniswap.org](https://uniswap.org/)
- **Logo:** ![Uniswap V4 Logo](https://icons.llama.fi/uniswap-v4.png)
- **Audits:** 2
- **Total Value Locked (TVL):** ~ $91.47 million
- **Chains Supported:** Ethereum, Arbitrum, Base, Polygon, etc.
- **Twitter:** [Uniswap](https://twitter.com/Uniswap)

### Uniswap V1
- **Name:** Uniswap V1
- **Description:** A fully decentralized protocol for automated liquidity provision on Ethereum.
- **Symbol:** UNI
- **Chain:** Ethereum
- **Website:** [uniswap.org](https://uniswap.org/)
- **Logo:** ![Uniswap V1 Logo](https://icons.llama.fi/uniswap-v1.png)
- **Audits:** 2
- **Total Value Locked (TVL):** ~ $5.29 million
- **Twitter:** [Uniswap](https://twitter.com/Uniswap)

### Summary
Uniswap is a leading decentralized exchange (DEX) that facilitates automated liquidity provision for trading ERC-20 tokens. It has multiple versions, each with enhancements and additional features, making it one of the most prominent protocols in the DeFi space. If you have more specific questions or need additional information, feel free to ask!
-------------------
```

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
```

## Adding New Actions

To add new DefiLlama actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `defillamaActionProvider.ts`
3. Add corresponding tests in `defillamaActionProvider.test.ts`

Note: The provider is network-agnostic and can be used with any blockchain network supported by DefiLlama. 