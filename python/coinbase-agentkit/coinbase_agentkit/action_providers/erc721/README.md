# ERC721 Action Provider

This directory contains the **ERC721ActionProvider** implementation, which provides actions to interact with **ERC721 tokens** on EVM-compatible networks.

## Directory Structure

```
erc721/
├── erc721_action_provider.py      # Main provider with ERC721 token functionality
├── constants.py                  # Constants including ERC20 ABI
├── schemas.py                    # Pydantic schemas for action inputs
├── validators.py                 # Input validation utilities
├── __init__.py                   # Package exports
└── README.md                     # This file

# From python/coinbase-agentkit/
tests/action_providers/erc721/
├── conftest.py                    # Test configuration
└── test_erc721_action_provider.py  # Test for ERC721 action provider
```

## Actions

### ERC721 Token Actions

- `get_balance`: Get NFT balance for an address
- `transfer`: Transfer an NFT to another address
- `mint`: Mint a new NFT

## Adding New Actions

To add new ERC721 actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `erc721_action_provider.py`
3. Implement tests in `tests/action_providers/erc721/test_erc721_action_provider.py`

## Network Support

The ERC721 provider supports all EVM-compatible networks.

## Notes

For more information on the **ERC721 token standard**, visit [ERC721 Token Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-721/).
