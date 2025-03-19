# Dexpaprika Action Provider

This directory contains the **DexpaprikaActionProvider** implementation, which provides actions for dexpaprika operations.

## Overview

The DexpaprikaActionProvider is designed to work with WalletProvider for blockchain interactions. It supports all blockchain networks and provides a set of actions that enable querying decentralized exchange data, including pools, tokens, and network information through the Dexpaprika API. This provider allows users to search for tokens, get detailed information about specific pools and tokens, and retrieve lists of top liquidity pools across various networks.

## Directory Structure

```
dexpaprika/
├── dexpaprikaActionProvider.ts       # Main provider implementation
└── dexpaprikaActionProvider.test.ts  # Provider test suite
├── schemas.ts                      # Action schemas and types
├── index.ts                        # Package exports
└── README.md                       # Documentation (this file)
```

## Actions

### Available Actions

- `get_dex_pools`: Fetches top pools on a specific DEX within a network
  - **Purpose**: Retrieves information about liquidity pools on a specific decentralized exchange
  - **Input**:
    - `network` (string): The blockchain network (e.g., "ethereum")
    - `dex` (string): The decentralized exchange name (e.g., "uniswap")
    - `sort` (string): Sort direction ("asc" or "desc")
    - `order_by` (string): Field to order results by (e.g., "volume_usd")
  - **Output**: JSON string containing DEX pool information
  - **Example**:
    ```typescript
    const result = await provider.getDexPools({
      network: "ethereum",
      dex: "uniswap",
      sort: "desc",
      order_by: "volume_usd"
    });
    ```

- `get_network_dexes`: Gets a list of available decentralized exchanges on a specific network
  - **Purpose**: Retrieves information about available DEXes on a blockchain network
  - **Input**:
    - `network` (string): The blockchain network (e.g., "ethereum")
  - **Output**: JSON string containing network DEX information
  - **Example**:
    ```typescript
    const result = await provider.getNetworkDexes({
      network: "ethereum"
    });
    ```

- `get_network_pools`: Gets a list of top liquidity pools on a specific network
  - **Purpose**: Retrieves information about top liquidity pools on a blockchain network
  - **Input**:
    - `network` (string): The blockchain network (e.g., "ethereum")
  - **Output**: JSON string containing network pool information
  - **Example**:
    ```typescript
    const result = await provider.getNetworkPools({
      network: "ethereum"
    });
    ```

- `get_pool_details`: Gets detailed information about a specific pool on a network
  - **Purpose**: Retrieves detailed information about a specific liquidity pool
  - **Input**:
    - `network` (string): The blockchain network (e.g., "ethereum")
    - `pool_address` (string): The address of the pool
  - **Output**: JSON string containing pool details
  - **Example**:
    ```typescript
    const result = await provider.getPoolDetails({
      network: "ethereum",
      pool_address: "0x1234567890abcdef"
    });
    ```

- `get_token_details`: Gets detailed information about a specific token on a network
  - **Purpose**: Retrieves detailed information about a specific token
  - **Input**:
    - `network` (string): The blockchain network (e.g., "ethereum")
    - `token_address` (string): The address of the token
  - **Output**: JSON string containing token details
  - **Example**:
    ```typescript
    const result = await provider.getTokenDetails({
      network: "ethereum",
      token_address: "0x1234567890abcdef"
    });
    ```

- `get_top_pools`: Gets a paginated list of top liquidity pools from all networks
  - **Purpose**: Retrieves information about top liquidity pools across all networks
  - **Input**: No required parameters
  - **Output**: JSON string containing top pools information
  - **Example**:
    ```typescript
    const result = await provider.getTopPools({});
    ```

- `search`: Searches for information about tokens using a provided query
  - **Purpose**: Searches for token information using a ticker or contract address
  - **Input**:
    - `query` (string): The search query (token ticker or contract address)
  - **Output**: JSON string containing search results
  - **Example**:
    ```typescript
    const result = await provider.search({
      query: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
    });
    ```

## Implementation Details

### Network Support
This provider supports all blockchain networks.

### Wallet Provider Integration
This provider is specifically designed to work with WalletProvider. Key integration points:
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

2. Implement the action in `dexpaprikaActionProvider.ts`:
   ```typescript
   @CreateAction({
     name: "new_action",
     description: "Description of what your action does",
     schema: NewActionSchema,
   })
   async newAction(
walletProvider: WalletProvider,      args: z.infer<typeof NewActionSchema>
   ): Promise<string> {
     // Implement your action logic
   }
   ```

## Testing

When implementing new actions, ensure to:
1. Add unit tests for schema validations
2. Test network support

## Notes

- Add any specific considerations for this action provider
- Document any prerequisites or setup requirements
- Include relevant external documentation links
