# Compound Action Provider

This directory contains the **CompoundActionProvider** implementation, which provides actions to interact with **Compound Protocol** for lending and borrowing operations.

## Directory Structure

```
compound/
├── compoundActionProvider.ts         # Main provider with Compound functionality
├── compoundActionProvider.test.ts    # Test file for Compound provider
├── constants.ts                      # Compound contract constants
├── schemas.ts                        # Lending/borrowing action schemas
├── utils.ts                          # Compound utility functions
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `supply`: Supply ETH or USDC to Compound V3 markets on Base.
- `borrow`: Borrow ETH or USDC from Compound V3 markets on Base.
- `repay`: Repay ETH or USDC to Compound V3 markets on Base.
- `withdraw`: Withdraw ETH or USDC from Compound V3 markets on Base.
- `get_portfolio`: Get the portfolio details for the Compound V3 markets on Base.

## Adding New Actions

To add new Compound actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `compoundActionProvider.ts`
3. Add tests in `compoundActionProvider.test.ts`

## Network Support

The Compound provider supports Base mainnet and Base sepolia.

## Notes

### Supported Compound Markets (aka. Comets)

#### Base

- USDC Comet
  - Supply Assets: USDC, WETH, cbBTC, cbETH, wstETH
  - Borrow Asset: USDC

#### Base Sepolia

- USDC Comet
  - Supply Assets: USDC, WETH
  - Borrow Asset: USDC

### Funded by Compound Grants Program

Compound Actions for AgentKit is funded by the Compound Grants Program. Learn more about the Grant on Questbook [here](https://new.questbook.app/dashboard/?role=builder&chainId=10&proposalId=678c218180bdbe26619c3ae8&grantId=66f29bb58868f5130abc054d). For support, please reach out the original author of this action provider: [@mikeghen](https://x.com/mikeghen).
