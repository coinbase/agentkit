# ERC20 Action Provider

This directory contains the **ERC20ActionProvider** implementation, which provides actions to interact with **ERC20 tokens** on EVM-compatible networks.

## Directory Structure

```
erc20/
├── erc20ActionProvider.ts         # Main provider with ERC20 token functionality
├── erc20ActionProvider.test.ts    # Test file for ERC20 provider
├── constants.ts                   # Constants for ERC20 provider
├── schemas.ts                     # Token action schemas
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `get_balance`: Get the balance of an ERC20 token

  - Returns the **balance** of the token in the wallet
  - Formats the balance with the correct number of decimals

- `transfer`: Transfer ERC20 tokens to another address

  - Constructs and sends the transfer transaction
  - Returns the **transaction hash** upon success

## Adding New Actions

To add new ERC20 actions:

1. Define your action schema in `schemas.ts`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema) for more information.
2. Implement the action in `erc20ActionProvider.ts`
3. Implement tests in `erc20ActionProvider.test.ts`

## Network Support

The ERC20 provider supports all EVM-compatible networks.

## Notes

For more information on the **ERC20 token standard**, visit [ERC20 Token Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/).
