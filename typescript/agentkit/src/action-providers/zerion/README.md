# Zerion Action Provider

This directory contains the **ZerionActionProvider** implementation, which provides actions for Zerion operations.

## Overview

The ZerionActionProvider is designed as a portfolio tracker that can get the portfolio overview in USD and in-depth DeFi position of any EVM wallet address.

## Pre-requisite

To get an API key, please fill out the form in [Zerion API](https://zerion.io/api) landing page, then your API key will be activated within 2 business days. You can join Zerion Discord and DM the moderator to activate it if you're in a rush.

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
