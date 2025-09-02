# Clanker Action Provider

This directory contains the **ClankerActionProvider** implementation, which provides actions for clanker operations.

## Overview

The ClankerActionProvider is designed to work with EvmWalletProvider on Base Mainnet for blockchain interactions. It provides a set of actions that enable deploying a Clanker token recognized by the Clanker ecosystem.

Although Clanker already has an agent that deploys tokens, their [open library](https://github.com/clanker-devco/clanker-sdk) and protocol allows anyone to launch a "Clank" token and be recognized by their ecosystem.

## Directory Structure

```
clanker/
├── clankerActionProvider.ts        # Main provider implementation
├── clankerActionProvider.test.ts   # Provider test suite
├── exampleAction.test.ts           # Example action test suite
├── schemas.ts                      # Action schemas and types
├── index.ts                        # Package exports
├── utils/
│   ├── clankerBridge.ts            # Helpers to wrap the EVMWalletProvider in the type the Clanker SDK expects
└── README.md                       # Documentation (this file)
```

## Actions

### Example Action
- `clank_token`: Clanker action implementation
  - **Purpose**: Creates a Clanker token from the input information
  - **Input**:
    - `tokenName` (string): The name of the deployed token
    - `tokenSymbol` (string): The symbol of the deployed token
    - `image` (string): A url pointing to the image of the token
    - `vestingPercentage` (number): The percentage of token that should be vested for the creator
    - `vestingDuration_Days` (number): The duration (in days) that the token should vest after lockup period
    - `lockDuration_Days` (number): The lock duration of the token (minimum 7 days)
  - **Output**: String describing the action result
  - **Example**:
    ```typescript
    const result = await provider.clankToken(walletProvider, {
      tokenName: "Test Token",
      tokenSymbol: "TT",
      image: "https://test.com/image.png",
      vestingPercentage: 10,
      vestingDuration_Days: 30,
      lockDuration_Days: 30,
    });
    ```

## Implementation Details

### Network Support
This provider supports Base Mainnet.

### Wallet Provider Integration
This provider is specifically designed to work with EvmWalletProvider. Key integration points:
- Network compatibility checks
- Transaction signing and execution
- Creating and deploying a Clanker token

## Adding New Actions

To add new actions:

1. Define the schema in `schemas.ts`:
   ```typescript
   export const NewActionSchema = z.object({
     // Define your action's parameters
   });
   ```

2. Implement the action in `clankerActionProvider.ts`:
   ```typescript
   @CreateAction({
     name: "new_action",
     description: "Description of what your action does",
     schema: NewActionSchema,
   })
   async newAction(walletProvider: EvmWalletProvider, args: z.infer<typeof NewActionSchema>): Promise<string> {
     // Implement your action logic
   }
   ```

## Testing

When implementing new actions, ensure to:
1. Add unit tests for schema validations
2. Test network support

#### Example
```
Prompt: Can you clank a token with name [CDP Clanker], and symbol [CDPC] and image hosted at [https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQF6hcTTU1A8Ymi2VldXqCsPkBu_ltAhIKiRg&s]?  vest 10%, locked for 30 days, and then vested for 30 days.  do this on base-mainnet
```

```
-------------------
Internal address: 0xE8D165388b13c460F02f4dC922309450a9bF6f22
Clanker token deployed at 0x15E91EAF0848c8FEfE8c287923B5A78E254A76eb!  View the transaction at 0xf67befc5da942288a7bb4baee2cbbc1a09853e62552e736aa272b91e09f918fa
-------------------
The Clanker token has been successfully deployed with the name "CDP Clanker" and symbol "CDPC." You can view the transaction [here](https://etherscan.io/tx/0xf67befc5da942288a7bb4baee2cbbc1a09853e62552e736aa272b91e09f918fa). The token address is 0x15E91EAF0848c8FEfE8c287923B5A78E254A76eb.
-------------------
```

## Notes

- Agent can define the description by adding a `description` field to the schema
  - Currently description defaults to a short message describing who deployed it.
- Likewise, agent can specify initial quote token.
- Check the (Clanker docs)[https://github.com/clanker-devco/clanker-sdk] to see other configurable options (fees, admin, etc.).