# Zerion Action Provider

This directory contains the **ZerionActionProvider** implementation, which provides actions for zerion operations.

## Overview

The ZerionActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable [describe the main purpose/functionality].

## Directory Structure

```
zerion/
├── zerionActionProvider.ts       # Main provider implementation
├── zerionActionProvider.test.ts  # Provider test suite
├── schemas.ts                    # Action schemas and types
├── utils.ts                      # Utility functions
├── constants.ts                  # Constants
├── index.ts                      # Package exports
└── README.md                     # Documentation (this file)
```

## Actions

- `get_portfolio_overview`: Get portfolio overview (include DeFi positions)
- `get_fungible_positions`: Get fungible positions (include DeFi positions)

## Adding New Actions

To add new Zerion actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `zerionActionProvider.ts`
3. Add tests in `zerionActionProvider.test.ts`

## Notes

- For more details, please visit: [Zerion Documentation](https://developers.zerion.io/reference/wallets/)
