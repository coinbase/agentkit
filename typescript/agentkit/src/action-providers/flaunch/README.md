# Flaunch Action Provider

This directory contains the **FlaunchActionProvider** implementation, which provides actions for interacting with the Flaunch protocol on Base network. Flaunch is a protocol for launching and trading memecoin tokens.

## Overview

The FlaunchActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable:

- Launching new memecoin tokens
- Buying memecoin tokens with ETH
- Selling memecoin tokens for ETH

## Directory Structure

```
flaunch/
├── flaunchActionProvider.ts       # Main provider implementation
├── flaunchActionProvider.test.ts  # Provider test suite
├── schemas.ts                     # Action schemas and types
├── constants.ts                   # Contract addresses and ABIs
├── utils.ts                       # Helper functions
├── types.ts                       # TypeScript type definitions
└── README.md                      # Documentation (this file)
```

## Actions

### Launch Memecoin

- `flaunch`: Create a new memecoin token
  - **Purpose**: Launch a new memecoin with customizable metadata and advanced configuration options
  - **Input**:
    - `name` (string): The name of the token
    - `symbol` (string): The symbol of the token
    - `image` (string): Local image file path or URL to the token image
    - `description` (string): Description of the token
    - `fairLaunchPercent` (number, optional): The percentage of tokens for fair launch (defaults to 60%)
    - `fairLaunchDuration` (number, optional): The duration of the fair launch in minutes (defaults to 30 minutes)
    - `initialMarketCapUSD` (number, optional): The initial market cap in USD (defaults to 10000 USD, range: 100-100000)
    - `preminePercent` (number, optional): The percentage of total supply to premine (defaults to 0%, max is equal to fairLaunchPercent)
    - `creatorFeeAllocationPercent` (number, optional): The percentage of fees allocated to creator and optional receivers (defaults to 80%)
    - `creatorSplitPercent` (number, optional): The percentage of fees allocated to the creator (defaults to 100%)
    - `splitReceivers` (array, optional): Array of fee split recipients with address and percentage
    - `websiteUrl` (string, optional): URL to the token website
    - `discordUrl` (string, optional): URL to the token Discord
    - `twitterUrl` (string, optional): URL to the token Twitter
    - `telegramUrl` (string, optional): URL to the token Telegram
  - **Output**: String containing transaction hash and Flaunch URL to view the coin
  - **Example**:
    ```typescript
    const result = await provider.flaunch(walletProvider, {
      name: "My Memecoin",
      symbol: "MEME",
      image: "https://example.com/image.png",
      description: "A fun memecoin for the community",
      fairLaunchPercent: 60,
      fairLaunchDuration: 30,
      initialMarketCapUSD: 10000,
      preminePercent: 0,
      creatorFeeAllocationPercent: 80,
      creatorSplitPercent: 100,
    });
    ```

### Buy Memecoin with ETH

- `buyCoinWithETHInput`: Buy memecoin tokens by specifying ETH input amount

  - **Purpose**: Purchase memecoin tokens with a specified amount of ETH
  - **Input**:
    - `coinAddress` (string): The address of the flaunch coin to buy
    - `amountIn` (string): The quantity of ETH to spend (e.g. "0.1")
    - `slippagePercent` (number, optional): Maximum slippage percentage (default: 5)
  - **Output**: String describing the swap result with amounts and transaction hash

- `buyCoinWithCoinInput`: Buy memecoin tokens by specifying desired token amount
  - **Purpose**: Purchase memecoin tokens by specifying how many tokens you want
  - **Input**:
    - `coinAddress` (string): The address of the flaunch coin to buy
    - `amountOut` (string): The quantity of tokens to buy (e.g. "1000")
    - `slippagePercent` (number, optional): Maximum slippage percentage (default: 5)
  - **Output**: String describing the swap result with amounts and transaction hash

### Sell Memecoin

- `sellCoin`: Sell memecoin tokens for ETH
  - **Purpose**: Sell memecoin tokens back to ETH
  - **Input**:
    - `coinAddress` (string): The address of the flaunch coin to sell
    - `amountIn` (string): The quantity of tokens to sell (e.g. "1000")
    - `slippagePercent` (number, optional): Maximum slippage percentage (default: 5)
  - **Output**: String describing the swap result with amounts and transaction hash

## Implementation Details

### Network Support

This provider supports the following networks:

- Base Mainnet (`base-mainnet`)
- Base Sepolia (`base-sepolia`)

### Dependencies

The provider requires:

- Access to Base network RPC endpoints

### Configuration

const provider = new FlaunchActionProvider();
```

The provider automatically uses the Flaunch API for uploading images and token metadata to IPFS.
This is rate limited to a maximum of 4 image uploads per minute per IP address.

### Key Contracts

The provider interacts with several key contracts:

- FlaunchZap: For launching new tokens
- FlaunchPositionManagerV1_1: For managing liquidity positions
- UniversalRouter: For executing swaps
- Permit2: For token approvals
- FLETH: Protocol's ETH wrapper token

## Notes

- All token amounts should be specified in whole units (e.g. "1.5" ETH, not wei)
- Slippage is optional and defaults to 5% if not specified
- Token metadata (image, description, etc.) is stored on IPFS using Flaunch API
- The provider handles Permit2 approvals automatically when selling tokens
- Fair launch parameters allow customization of token distribution and launch mechanics
- Fee allocation can be split between creator and additional recipients
- Premine percentage cannot exceed the fair launch percentage
- Initial market cap is set in USD and converted to appropriate token pricing
- The provider supports both local image files and URLs for token images
