# Action Provider Generator

This script helps you create new action providers with all necessary files and boilerplate code.

## Usage

```bash
# Interactive mode
npm run create-action-provider

# CLI mode with arguments (note the -- before flags)
npm run create-action-provider -- [options]
```

## Options

- `-n, --name`: Name of the action provider
- `-p, --protocol-family`: Protocol family (e.g. evm, svm, all)
- `-i, --network-ids`: Comma-separated list of network IDs
- `-w, --wallet-provider`: Wallet provider to use (optional)
- `-h, --help`: Show help information

## Examples

Create an EVM provider for Base networks:
```bash
npm run create-action-provider -- -n my-provider -p evm -i base-mainnet,base-sepolia
```

Create a Solana provider for all Solana networks:
```bash
npm run create-action-provider -- -n my-provider -p svm
```

Create a provider for all networks:
```bash
npm run create-action-provider -- -n my-provider -p all
```

Create an EVM provider with Viem wallet provider:
```bash
npm run create-action-provider -- -n my-provider -p evm -i base-mainnet -w ViemWalletProvider
```

## Important Note

When using CLI arguments, you must include `--` before the flags to pass them to the script. For example:

✅ Correct:
```bash
npm run create-action-provider -- --name my-provider
```

❌ Incorrect:
```bash
npm run create-action-provider --name my-provider
```

## Generated Files

The script will create:
1. Action provider implementation
2. Test file
3. Schema definitions
4. Required exports

The generated provider will be placed in `src/action-providers/{name}/`. 