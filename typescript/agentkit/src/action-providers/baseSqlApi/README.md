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
├── baseSqlApiDescription.ts        # Variables describing the action and valid SQL Schemas
├── schemas.ts                      # Action schemas and types
├── index.ts                        # Package exports
├── constants.ts                    # Constant variables
└── README.md                       # Documentation (this file)
```

## Actions

### Execute Query Action
- `execute_base_sql_query`: Execute a SQL query for Base data
  - **Purpose**: Query any onchain Base historical data
  - **Input**:
    - `sqlQuery` (string): The sql query to run
  - **Output**: String describing the query result
  - **Example**:
    ```typescript
    const result = await provider.executeBaseSqlQuery({
      sqlQuery: "SELECT size FROM base.blocks ORDER BY block_number DESC LIMIT 1",
    });
    ```

## Implementation Details

### Network Support
This provider supports all evm networks, but can only be run against Base data.

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