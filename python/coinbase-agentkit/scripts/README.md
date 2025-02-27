# Action Provider Generator

This script helps you create new action providers with all necessary files and boilerplate code.

## Usage

```bash
# Interactive mode
python -m scripts.create_action_provider

# CLI mode with arguments
python -m scripts.create_action_provider [options]
```

## Options

- `-n, --name`: Name of the action provider
- `-p, --protocol-family`: Protocol family (e.g. evm, all)
- `-i, --network-ids`: Comma-separated list of network IDs
- `-w, --wallet-provider`: Wallet provider to use (optional)
- `-h, --help`: Show help information

## Examples

Create an EVM provider for Base networks:
```bash
python -m scripts.create_action_provider -n my-provider -p evm -i base-mainnet,base-sepolia
```

Create a provider for all networks:
```bash
python -m scripts.create_action_provider -n my-provider -p all
```

Create an EVM provider with CDP wallet provider:
```bash
python -m scripts.create_action_provider -n my-provider -p evm -i base-mainnet -w CdpWalletProvider
```

## Generated Files

The script will create:
1. Action provider implementation
2. Test file
3. Schema definitions
4. Required exports

The generated provider will be placed in `coinbase_agentkit/action_providers/{name}/` with the following structure:

```
coinbase_agentkit/action_providers/{name}/
├── {name}_action_provider.py      # Main provider implementation
├── {name}_action_provider_test.py # Test suite
├── schemas.py                     # Action schemas and types
└── README.md                      # Documentation
```

## Features

- Interactive prompts for easy configuration
- CLI arguments for automation
- Support for multiple protocol families
- Optional wallet provider integration
- Comprehensive test suite generation
- Type-safe implementation with mypy support 