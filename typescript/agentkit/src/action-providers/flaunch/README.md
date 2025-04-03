# Flaunch Action Provider

This directory contains the **FlaunchActionProvider** implementation, which provides actions for interacting with the Flaunch protocol on Base network. Flaunch is a protocol for launching and trading memecoin tokens.

## Overview

The FlaunchActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable:

- Launching new memecoin tokens
- Buying memecoin tokens with ETH
- Selling memecoin tokens for ETH

### Environment Variables

```
PINATA_JWT
```

Creating the flaunchActionProvider requires Pinata JWT. You can create one at https://app.pinata.cloud/developers/api-keys

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
  - **Purpose**: Launch a new memecoin with customizable metadata
  - **Input**:
    - `name` (string): The name of the token
    - `symbol` (string): The symbol of the token
    - `imageUrl` (string): URL to the token image
    - `description` (string): Description of the token
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
      imageUrl: "https://example.com/image.png",
      description: "A fun memecoin for the community",
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

- A Pinata JWT for IPFS uploads (used for token metadata)
- Access to Base network RPC endpoints

### Configuration

When initializing the provider:

```typescript
const provider = new FlaunchActionProvider({
  pinataJwt: "your-pinata-jwt", // Required for IPFS uploads
});
```

### Key Contracts

The provider interacts with several key contracts:

- FastFlaunchZap: For launching new tokens
- FlaunchPositionManager: For managing liquidity positions
- UniversalRouter: For executing swaps
- Permit2: For token approvals
- FLETH: Protocol's ETH wrapper token

## Notes

- All token amounts should be specified in whole units (e.g. "1.5" ETH, not wei)
- Slippage is optional and defaults to 5% if not specified
- Token metadata (image, description, etc.) is stored on IPFS using Pinata
- The provider handles Permit2 approvals automatically when selling tokens
