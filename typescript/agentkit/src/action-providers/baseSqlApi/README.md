# BaseSqlApi Action Provider

This directory contains the **BaseSqlApiActionProvider** implementation, which provides actions for baseSqlApi operations.

## Overview

The BaseSqlApiActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable the querying of real-time and historical onchain data on Base using custom SQL queries.

Visit the [Base SQL API documentation](https://docs.cdp.coinbase.com/data/sql-api/welcome) for more information.

## Directory Structure

```
baseSqlApi/
├── baseSqlApiActionProvider.ts       # Main provider implementation
├── baseSqlApiActionProvider.test.ts  # Provider test suite
├── exampleAction.test.ts           # Example action test suite
├── schemas.ts                      # Action schemas and types
├── index.ts                        # Package exports
├── constants.ts                    # Constant variables
├── baseSqlApiDescription.ts        # Variables describing the action and valid SQL Schemas
└── README.md                       # Documentation (this file)
```

## Actions

### Actions
- `execute_base_sql_query`: Execute a SQL query for Base data
  - **Purpose**: Demonstrates the basic structure of an action
  - **Input**:
    - `fieldName` (string): A descriptive name for the field (1-100 chars)
    - `amount` (string): The amount as a decimal string (e.g. "1.5")
    - `optionalField` (string, optional): Optional parameter example
  - **Output**: String describing the action result
  - **Example**:
    ```typescript
    const result = await provider.exampleAction(walletProvider, {
      fieldName: "test",
      amount: "1.0"
    });
    ```

## Implementation Details

### Network Support
This provider supports all evm networks.

### Wallet Provider Integration
This provider is specifically designed to work with EvmWalletProvider. Key integration points:
- Network compatibility checks
- Transaction signing and execution
- Balance and account management

## Adding New Actions

To add new actions:

1. Define the schema in `schemas.ts`:
   ```typescript
   export const NewActionSchema = z.object({
     // Define your action's parameters
   });
   ```

2. Implement the action in `baseSqlApiActionProvider.ts`:
   ```typescript
   @CreateAction({
     name: "new_action",
     description: "Description of what your action does",
     schema: NewActionSchema,
   })
   async newAction(
walletProvider: EvmWalletProvider,      args: z.infer<typeof NewActionSchema>
   ): Promise<string> {
     // Implement your action logic
   }
   ```

## Testing

When implementing new actions, ensure to:
1. Add unit tests for schema validations
2. Test network support

## Notes

- Requires an **CDP Client API Key** for authentication. Visit [CDP](https://portal.cdp.coinbase.com/projects/api-keys/client-key/) to get your key.