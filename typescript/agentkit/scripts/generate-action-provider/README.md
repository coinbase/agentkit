# Action Provider Generator

This script helps you create new action providers with all necessary files and boilerplate code.

## Usage

```bash
# Interactive mode
npm run generate:action-provider

# CLI mode with arguments (note the -- before flags)
npm run generate:action-provider -- [options]

# Hybrid mode with arguments (note the -- before flags)
npm run generate:action-provider -- [options] -i
```

## Options

- `-n, --name`: Name of the action provider (e.g. 'example')
- `-p, --protocol-family`: Protocol family (e.g. 'evm', 'none', 'all')
- `-w, --wallet-provider`: Wallet provider to use (optional)
- `-i, --interactive`: Enable interactive mode

## Examples

Create a provider for all networks:

```bash
npm run generate:action-provider -- -n example -p all
```

Create an Evm provider for Base networks:

```bash
npm run generate:action-provider -- -n example -p evm
```

Create an Evm provider with CDP wallet provider:

```bash
npm run generate:action-provider -- -n example -p evm -w CdpWalletProvider
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
