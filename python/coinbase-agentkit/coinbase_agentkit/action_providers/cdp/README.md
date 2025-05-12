# CDP (Coinbase Developer Platform) Action Provider

This directory contains the **CdpActionProvider** implementations, which provide actions to interact with the **Coinbase Developer Platform (CDP)** API and wallet services.

## Directory Structure

```
cdp/
├── cdp_api_action_provider.py        # CDP API actions
├── constants.py                      # CDP constants
├── schemas.py                        # CDP action schemas
├── __init__.py                       # Main exports
└── README.md                         # This file

# From python/coinbase-agentkit/
tests/action_providers/cdp/
├── conftest.py                              # Test configuration
├── test_api_address_reputation_action.py    # Tests for address reputation
├── test_api_faucet_funds.py                 # Tests for faucet funds
└── test_cdp_api_action_provider.py          # Tests for CDP API actions
```

## Actions

### CDP API Actions

- `address_reputation`: Returns onchain activity metrics
- `request_faucet_funds`: Request testnet funds from CDP faucet

  - Available only on Base Sepolia

### CDP Wallet Actions

- `deploy_contract`: Deploy a smart contract
- `deploy_nft`: Deploy an NFT
- `deploy_token`: Deploy a token
- `trade`: Trade a token

  - Available only on mainnet networks

## Adding New Actions

To add new CDP actions:

1. Define your action schema in `schemas.py`
2. Implement the actions
3. Add corresponding tests

## Network Support

The CDP providers support all networks available on the Coinbase Developer Platform, including:

- Base (Mainnet & Testnet)
- Ethereum (Mainnet & Testnet)
- Other EVM-compatible networks

## Notes

- Requires CDP API credentials (API Key ID and Secret). Visit the [CDP Portal](https://portal.cdp.coinbase.com/) to get your credentials.

For more information on the **Coinbase Developer Platform**, visit [CDP Documentation](https://docs.cdp.coinbase.com/).
