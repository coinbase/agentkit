# TrueMarkets Action Provider

This directory contains the **TrueMarketsActionProvider** implementation, which provides actions to interact with **Truemarkets** prediction markets on Base.

## Directory Structure

```
truemarkets/
├── truemarketsActionProvider.ts    # Main provider with Truemarkets functionality
├── truemarketsActionProvider.test.ts # Test file for Truemarkets provider
├── constants.ts                    # Constants and ABIs for Truemarkets contracts
├── schemas.ts                      # Truemarkets action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `get_active_markets`: Get active prediction markets from Truemarkets

  - Returns a list of markets with their ID, contract address, and market question
  - Supports pagination and sorting options

- `get_market_details`: Get detailed information for a specific market
  - Takes a market address as input
  - Returns comprehensive market information including:
    - Market question, source, and status
    - Pool addresses and liquidity
    - YES/NO token prices
    - Pool balances and TVL (Total Value Locked)

## Adding New Actions

To add new Truemarkets actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `truemarketsActionProvider.ts`
3. Implement tests in `truemarketsActionProvider.test.ts`

## Network Support

The Truemarkets provider currently supports:
- Base Mainnet
- Base Sepolia

## Notes

Truemarkets is a prediction market platform built on Base. For more information, see the [Truemarkets website](https://truemarkets.org/).
