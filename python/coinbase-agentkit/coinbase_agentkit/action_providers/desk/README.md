# DESK Action Provider

This directory contains the **DeskActionProvider** implementation, which provides actions for interacting with the DESK trading platform.

## Overview

The DeskActionProvider is designed to work with EthAccountWalletProvider for blockchain interactions. It provides a set of actions that enable users to interact with the DESK trading platform, view account information, check market data, and execute trades.

## Directory Structure

```
desk/
├── __init__.py # Package exports
├── desk_action_provider.py # Main provider implementation
├── schemas.py # Action schemas and types
├── utils.py # Utility functions
└── README.md # Documentation (this file)

```

## Supported Actions
```
  get_subaccount_summary
  get_market_info
  get_collaterals_info
  get_current_funding_rate
  get_historical_funding_rates
  get_last_trades
  get_mark_price
  place_order
  cancel_order
  cancel_all_orders
  deposit_collateral
  withdraw_collateral
```


## Implementation Details

### Network Support
- Base `8453`
- Arbitrum Sepolia `421614`

### Wallet Provider Integration
This provider is designed to work with EthAccountWalletProvider. Key integration points:
- Authentication with the DESK platform
- Account management and subaccount access
- Transaction signing for trading operations

## Configuration

The DeskActionProvider requires the following configuration:
- `private_key`: The private key for the Ethereum account
- `chain_id`: The chain to connect to. currently supported '8453' (base) and '421614' (arbitrum sepolia)
- `sub_account_id`: The subaccount ID to use for trading
- `rpc_url` (optional): RPC url to use

Example configuration:
```python
from coinbase_agentkit.action_providers.desk.schemas import DeskConfigSchema
from coinbase_agentkit import desk_action_provider

provider = desk_action_provider(
        private_key="0x123",
        sub_account_id=1,
        chain_id=8453,
        rpc_url="https://rpc.url",
  )
```

## Example Usecase
### Prerequisite
```
Chatbot: python/examples/langchain-desk-chatbot/chatbot.py
Network: Arbitrum Sepolia
Setup: EVM Wallet with TestUSDC and Gas in wallet
```

### Get account info on DESK
Prompt: 
```
get my info on desk
```

Output:
```
Here is your current information on the desk:

### Collaterals
- **Asset**: USDC
- **Amount**: 22,581.56

### Positions
1. **Symbol**: VIRTUALUSD
   - **Quantity**: 1,340.20
   - **Average Entry Price**: 1.1028
   - **Side**: Short
   - **Last Updated Funding Fee**: 0.2676

2. **Symbol**: KAITOUSD
   - **Quantity**: 1,991.80
   - **Average Entry Price**: 1.4025
   - **Side**: Short
   - **Last Updated Funding Fee**: 0.0515

### Account Summary
- **Account Margin**: 23,879.59
- **Collateral Value**: 22,581.06
- **Unrealized P&L**: 509.28
- **Pending Funding Fee**: -789.25
- **Pending Borrowing Fee**: -0.0000000014
- **Account IMR**: 1,226.68
- **Order IMR**: 0.00
- **Position IMR**: 1,226.68
- **Position MMR**: 390.20
```

### Place market order on DESK
Prompt: 
```
market long btcusd for 0.01
```

Output:
```
Your market order to long **0.01 BTCUSD** has been successfully placed. Here are the details:

- **Subaccount**: 0x0123456789012345678901234567890123456789000000000000000000000001
- **Side**: Long
- **Order Type**: Market
- **Filled Quantity**: 0.01 BTC
- **Average Fill Price**: 82,969.00
- **Execution Fee**: 0.01
- **Order Digest**: 0x0000000000000000000000000000000000000000000000000000000000000001
```

### Deposit collateral on DESK
Prompt: 
```
deposit 10 usdc
```


Output:
```
Your deposit of **10 USDC** has been successfully completed. Here is the transaction hash for your reference:

- **Transaction Hash**: 0123456789012345678901234567890123456789012345678901234567890123
```

## Notes
- All action avaliable are implemented following [DESK Python SDK](https://github.com/TradeOnDESK/desk-python-sdk/blob/main/README.md)
- The DESK platform requires authentication with a valid Ethereum account
- All actions return formatted JSON strings for easy parsing and display
- Position, order, and collateral information is formatted for human readability
- For detailed API documentation, refer to the [DESK platform documentation](https://docs.desk.exchange/)