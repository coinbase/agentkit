# Nillion Action Provider

This directory contains the **NillionActionProvider** implementation, which provides actions to interact with the privacy enhanced **SecretVault**.

## Directory Structure

```
nillion/
├── nillion_action_provider.py        # Main provider with SecretVault functionality
├── schemas.py                        # Domain action schemas
├── __init__.py                       # Main exports
└── README.md                         # This file

# From python/coinbase-agentkit/
tests/action_providers/nillion/
├── conftest.py                       # Test configuration
└── test_nillion_action_provider.py   # Test file for Nillion provider
```

## Actions

- `lookup_schema`: Discover existing schema
  - Use natural language to describe schema
  - Action can be chained with other tools
- `create_schema`: Build a new schema
  - Use natural language to describe schema
  - Automatically applies secret sharing to fields that appear to contain private data
- `data_upload`: Push data into SecretVault
  - Automatically shape the input data into the schema spec
  - Look up the schema based on natural language description
- `data_download`: Pull data from the SecretVault
  - Automatically decrypts the data from distributed nodes
  - Look up the schema based on natural language description

## Adding New Actions

To add new Nillion actions:

1. Define your action schema in `schemas.py`
2. Implement the action in `nillion_action_provider.py`
3. Implement tests in `tests/action_providers/nillion/test_nillion_action_provider.py`


## Notes

For more information on **SecretVault**, [see here](https://docs.nillion.com/build/secret-vault).
