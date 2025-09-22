# CDP (Coinbase Developer Platform) Action Providers

This directory contains the **CDP Action Provider** implementations, which provide actions to interact with the **Coinbase Developer Platform (CDP)** API and wallet services.

## Directory Structure

```
cdp/
├── cdp_api_action_provider.py              # Provider for CDP API interactions
├── cdp_evm_wallet_action_provider.py       # Provider for CDP EVM Wallet operations
├── cdp_smart_wallet_action_provider.py     # Provider for CDP Smart Wallet operations
├── constants.py                            # CDP constants
├── swap_utils.py                           # Swap utility functions
├── schemas.py                              # Action schemas for CDP operations
├── __init__.py                             # Main exports
└── README.md                               # This file

# From python/coinbase-agentkit/
tests/action_providers/cdp/
├── conftest.py                              # Test configuration
├── test_api_address_reputation_action.py    # Tests for address reputation
├── test_api_faucet_funds.py                 # Tests for faucet funds
├── test_cdp_api_action_provider.py          # Tests for CDP API actions
├── test_cdp_evm_wallet_action_provider.py   # Tests for CDP EVM Wallet actions
└── test_cdp_smart_wallet_action_provider.py # Tests for CDP Smart Wallet actions
```

## Actions

### CDP API Actions

- `address_reputation`: Returns onchain activity metrics
- `request_faucet_funds`: Request testnet funds from CDP faucet

  - Available on Base Sepolia, Ethereum Sepolia, and Solana Devnet
  - Supported assets:
    - Base Sepolia / Ethereum Sepolia: ETH (default), USDC, EURC, CBBTC
    - Solana Devnet: SOL (default), USDC

### CDP EVM Wallet Actions

- `get_swap_price`: Fetches a price quote for swapping between two tokens using the CDP Swap API (does not execute swap)
- `swap`: Executes a token swap using the CDP Swap API with automatic token approvals

### CDP Smart Wallet Actions

- `get_swap_price`: Fetches a price quote for swapping between two tokens using the CDP Swap API (does not execute swap)
- `swap`: Executes a token swap using the CDP Swap API with automatic token approvals

## Adding New Actions

To add new CDP actions:

1. Define your action schema in `schemas.py`
2. Implement the action in the appropriate provider file:
   - CDP API actions in `cdp_api_action_provider.py`
   - CDP EVM Wallet actions in `cdp_evm_wallet_action_provider.py`
   - CDP Smart Wallet actions in `cdp_smart_wallet_action_provider.py`
3. Add corresponding tests

## Network Support

The CDP providers support all networks available on the Coinbase Developer Platform, including:

- Base (Mainnet & Testnet)
- Ethereum (Mainnet & Testnet)
- Other EVM-compatible networks

## Notes

- Requires CDP API credentials (API Key ID and Secret). Visit the [CDP Portal](https://portal.cdp.coinbase.com/) to get your credentials.

For more information on the **Coinbase Developer Platform**, visit [CDP Documentation](https://docs.cdp.coinbase.com/).
