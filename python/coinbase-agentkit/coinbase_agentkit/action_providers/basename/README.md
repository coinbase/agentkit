# Basename Action Provider

This directory contains the **BasenameActionProvider** implementation, which provides actions to interact with **Base Name Service (BNS)** for managing `.base` and `.basetest` domain names.

## Directory Structure

```
basename/
├── basename_action_provider.py       # Main provider with Basename functionality
├── schemas.py                        # Domain action schemas
├── __init__.py                       # Main exports
└── README.md                         # This file

# From python/coinbase-agentkit/
tests/action_providers/basename/
├── conftest.py                       # Test configuration
└── test_basename_action_provider.py  # Test file for Basename provider
```

## Actions

- `register_basename`: Register a new Base name
  - Registers a `.base` or `.basetest` domain name
  - Links the domain to the caller's wallet address

## Adding New Actions

To add new Basename actions:

1. Define your action schema in `schemas.py`
2. Implement the action in `basename_action_provider.py`
3. Implement tests in `tests/action_providers/basename/test_basename_action_provider.py`

## Network Support

The Basename provider supports Base mainnet and Base sepolia.

## Notes

For more information on **Basenames**, [see here](https://www.base.org/names).
