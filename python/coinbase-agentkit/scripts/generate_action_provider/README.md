# Action Provider Generator

This script helps you create new action providers with all necessary files and boilerplate code.

## Usage

```bash
# Interactive mode
poetry run generate-action-provider

# CLI mode with arguments
poetry run generate-action-provider [options]

# Hybrid mode with arguments
poetry run generate-action-provider [options] -i
```

## Options

- `-n, --name`: Name of the action provider (e.g. 'example')
- `-p, --protocol-family`: Protocol family (e.g. 'evm', 'none', 'all')
- `-w, --wallet-provider`: Wallet provider to use (optional)
- `-i, --interactive`: Enable interactive mode

## Examples

Create a provider for all networks:

```bash
poetry run generate-action-provider -n example -p all
```

Create an Evm provider:

```bash
poetry run generate-action-provider -n example -p evm
```

Create an Evm provider with CDP wallet provider:

```bash
poetry run generate-action-provider -n example -p evm -w CdpWalletProvider
```

## Generated Files

The script generates the following files:

### Main Provider Files

Located in `coinbase_agentkit/action_providers/{name}/`:

```
├── __init__.py                 # Package exports
├── {name}_action_provider.py   # Main provider implementation
├── schemas.py                  # Action schemas and types
└── README.md                   # Provider documentation
```

### Test Files

Located in `tests/action_providers/{name}/`:

```
├── __init__.py                # Test package initialization
├── conftest.py                # Test fixtures and configuration
├── test_action_provider.py    # Provider test suite
└── test_example_action.py     # Action-specific tests
```
