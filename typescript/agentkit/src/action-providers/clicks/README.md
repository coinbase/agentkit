# Clicks Protocol Action Provider

This directory contains the **ClicksActionProvider** implementation, which provides actions to interact with **Clicks Protocol** for AI agent yield generation on Base.

## What is Clicks Protocol?

Clicks Protocol is an on-chain revenue-sharing layer for AI agents on Base. It enables agents to earn yield on USDC deposits through an 80/20 split model:

- **80%** of yield goes to the agent
- **20%** is retained as a protocol fee

Deposited USDC is routed into battle-tested yield strategies including **Aave V3** and **Morpho** vaults on Base.

## Directory Structure

```
clicks/
├── clicksActionProvider.ts         # Main provider with Clicks functionality
├── clicksActionProvider.test.ts    # Test file for Clicks provider
├── constants.ts                    # Contract addresses and ABIs
├── schemas.ts                      # Action input schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `quick_start`: Register an agent and deposit USDC in a single transaction
- `deposit`: Deposit additional USDC into the yield router
- `withdraw`: Withdraw USDC from yield
- `get_info`: Get the agent's registration status, deposits, and earnings

## Deployed Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| ClicksSplitterV3 | `0xF625e41D6e83Ca4FA890e0C73DAd65433a6ab5E3` |
| ClicksYieldRouter | `0x4DE206153c2C6888F394F8CEcCE15B818dFb51A8` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Network Support

The Clicks provider supports **Base mainnet** only.

## Adding New Actions

To add new Clicks Protocol actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `clicksActionProvider.ts`
3. Add tests in `clicksActionProvider.test.ts`

## Notes

For more information on **Clicks Protocol**, visit [clicks.supply](https://clicks.supply).
