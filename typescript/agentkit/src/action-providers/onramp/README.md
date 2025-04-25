# Onramp Action Provider

This directory contains the **OnrampActionProvider** implementation, which provides actions for cryptocurrency onramp operations - specifically helping users purchase cryptocurrency using fiat currency (regular money like USD).

## Overview

The OnrampActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides actions that enable users to purchase cryptocurrency when they need more funds, integrating with Coinbase's onramp service.

### Environment Variables
```
CDP_PROJECT_ID
```

Creating the OnrampActionProvider requires a CDP project ID. You can create one at https://portal.cdp.coinbase.com/

## Directory Structure

```
onramp/
├── onrampActionProvider.ts       # Main provider implementation
└── onrampActionProvider.test.ts  # Provider test suite
├── schemas.ts                    # Action schemas and types
├── utils.ts                      # Utility functions
├── types.ts                      # Type definitions for URL generation
├── version.ts                    # Version and URL constants
├── index.ts                      # Package exports
└── README.md                     # Documentation (this file)
```

## Actions

### get_onramp_buy_url
- **Purpose**: Generates a URL for purchasing cryptocurrency through Coinbase's onramp service
- **Output**: String containing the URL to the Coinbase-powered purchase interface
- **Example**:
  ```typescript
  const result = await provider.getOnrampBuyUrl(walletProvider);
  ```

Use this action when:
- The wallet has insufficient funds for a transaction
- You need to guide the user to purchase more cryptocurrency
- The user asks how to buy more crypto

## Implementation Details

### Network Support
This provider supports base, ethereum, polygon, optimism, and arbitrum mainnet networks.

### Wallet Provider Integration
This provider is specifically designed to work with EvmWalletProvider. Key integration points:
- Uses the wallet's current network for generating appropriate purchase URLs
- Integrates the wallet's address for directing purchased funds
- Validates network compatibility before operations

## Adding New Actions

To add new actions:

1. Define the schema in `schemas.ts`:
   ```typescript
   export const NewActionSchema = z.object({
     // Define your action's parameters
   });
   ```

2. Implement the action in `onrampActionProvider.ts`:
   ```typescript
   @CreateAction({
     name: "new_action",
     description: "Description of what your action does",
     schema: NewActionSchema,
   })
   async newAction(
     walletProvider: EvmWalletProvider,
     args: z.infer<typeof NewActionSchema>
   ): Promise<string> {
     // Implement your action logic
   }
   ```

## Testing

When implementing new actions, ensure to:
1. Add unit tests for schema validations
2. Test network support

## Notes

- The provider requires a valid project ID for operation
- Currently supports ETH and USDC purchases
- Uses Coinbase's infrastructure for secure fiat-to-crypto transactions
- All operations are performed on EVM-compatible networks only
