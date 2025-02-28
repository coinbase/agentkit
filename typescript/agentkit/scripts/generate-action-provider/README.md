# Action Provider Generator

This script helps you create new action providers with all necessary files and boilerplate code.

## Usage

```bash
# CLI mode with arguments (note the -- before flags)
npm run generate-action-provider -- [options]

# Hybrid mode with arguments (note the -- before flags)
npm run generate-action-provider -- [options] -i
```

## Options

- `-n, --name`: Name of the action provider (e.g. 'mytoken', 'superfluid')
- `-p, --protocol-family`: Protocol family (e.g. 'evm', 'none', 'all')
- `-w, --wallet-provider`: Wallet provider to use (optional)
- `-i, --interactive`: Enable interactive mode

## Examples

Create a provider for all networks:

```bash
npm run generate-action-provider -- -n my-provider -p all
```

Create an EVM provider for Base networks:

```bash
npm run generate-action-provider -- -n my-provider -p evm
```

Create an EVM provider with CDP wallet provider:

```bash
npm run generate-action-provider -- -n my-provider -p evm -w CdpWalletProvider
```

## Generated Files

The script generates the following files:

### Main Provider Files

Located in `src/action-providers/{name}/`:

```
├── {name}ActionProvider.ts     # Main provider implementation
├── schemas.ts                  # Action schemas and types
├── index.ts                    # Package exports
└── README.md                   # Provider documentation
```

### Test Files

Located in same directory:

```
└── {name}ActionProvider.test.ts  # Provider test suite
```

## Features

- CLI arguments for automation
- Interactive prompts for easy configuration
- Support for multiple protocol families:
  - EVM networks
  - Protocol-agnostic providers
- Optional wallet provider integration
