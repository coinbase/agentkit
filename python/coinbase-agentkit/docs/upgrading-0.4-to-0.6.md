# Upgrading from AgentKit 0.4.0 to 0.6.0

This guide covers the migration process from AgentKit 0.4.0 to 0.6.0, with a focus on breaking changes and wallet compatibility.

## Overview

AgentKit 0.6.0 introduces significant changes to wallet management and API structure. The most notable changes affect:
- Wallet provider classes and initialization
- Environment variable naming
- Wallet data storage format
- Action provider functions

## Breaking Changes

### 1. Wallet Provider Updates
```python
# Before (0.4.0)
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

# After (0.6.0)
from coinbase_agentkit import CdpEvmServerWalletProvider, CdpEvmServerWalletProviderConfig
```

### 2. Environment Variables
```bash
# New variables (0.6.0)
export CDP_API_KEY_ID="your_key_id"           # Previously CDP_API_KEY_NAME
export CDP_API_KEY_SECRET="your_private_key"  # Previously CDP_API_KEY_PRIVATE_KEY
export CDP_WALLET_SECRET="your_wallet_secret" # New in 0.6.0
```

To obtain your `CDP_WALLET_SECRET`:
1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Click "Wallets" in the left navigation bar
3. Select "Wallet API"
4. Click "Generate Wallet Secret"

This wallet secret is required for the new wallet provider in 0.6.0.

### 3. Removed Functions
The following functions have been removed:
- `CdpWalletActionProvider_deploy_contract`
- `CdpWalletActionProvider_deploy_nft`
- `CdpWalletActionProvider_deploy_token`
- `CdpWalletActionProvider_trade`

## Wallet Compatibility

### Data Structure Changes
AgentKit 0.6.0 uses a different wallet data format:

```json
// 0.4.0 Format
{
  "default_address_id": "0x1234...",
  "wallet_secret": "encrypted_data",
  "account_data": { ... }
}

// 0.6.0 Format
{
  "default_address_id": "0x5678...",
  "wallet_secret": "new_encrypted_format",
  "provider_specific_data": { ... }
}
```

### Migration Script
Here's an example script to handle wallet compatibility issues:

```python
from coinbase_agentkit import CdpEvmServerWalletProvider, CdpEvmServerWalletProviderConfig
import argparse
import json
import os

def check_wallet_compatibility(wallet_address: str, config: dict) -> bool:
    # Check if wallet is valid in 0.6.0
    wallet_config = CdpEvmServerWalletProviderConfig(
        api_key_id=config["cdp_api_key_id"],
        api_key_secret=config["cdp_api_key_secret"],
        network_id="base-mainnet",
        address=wallet_address
    )

    try:
        CdpEvmServerWalletProvider(wallet_config)
        return True
    except Exception as e:
        if "not found" in str(e).lower():
            return False
        return True  # Assume valid for other errors

def fix_invalid_wallets(wallet_file: str, dry_run: bool = True):
    """Fix invalid wallet addresses in the wallet data file."""
    with open(wallet_file, 'r') as f:
        wallet_data = json.load(f)
    
    config = {
        "cdp_api_key_id": os.getenv("CDP_API_KEY_ID"),
        "cdp_api_key_secret": os.getenv("CDP_API_KEY_SECRET")
    }

    fixed_count = 0
    for wallet in wallet_data:
        if not check_wallet_compatibility(wallet["address"], config):
            print(f"Found invalid wallet: {wallet['address']}")
            if not dry_run:
                # Clear wallet data to trigger on-demand creation
                wallet["address"] = None
                wallet["provider_specific_data"] = {}
                fixed_count += 1

    if not dry_run and fixed_count > 0:
        with open(wallet_file, 'w') as f:
            json.dump(wallet_data, f, indent=2)
        print(f"Fixed {fixed_count} invalid wallets")
    else:
        print(f"Would fix {fixed_count} wallets (dry run)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--wallet-file", required=True, help="Path to wallet data file")
    parser.add_argument("--dry-run", action="store_true", help="Don't make any changes")
    args = parser.parse_args()
    
    fix_invalid_wallets(args.wallet_file, args.dry_run)
```

Save this script as `fix_invalid_wallets.py` and run it:
```bash
# First do a dry run to see what would be changed
python fix_invalid_wallets.py --wallet-file wallets.json --dry-run

# Then run it for real to fix the wallets
python fix_invalid_wallets.py --wallet-file wallets.json
```

## Migration Steps

1. Update dependencies:
   ```bash
   pip install "coinbase-agentkit>=0.6.0" "coinbase-agentkit-langchain>=0.5.0"
   ```

2. Update environment variables
3. Run wallet migration script:
   ```bash
   python scripts/fix_invalid_wallets.py --dry-run  # Test first
   python scripts/fix_invalid_wallets.py            # Apply fixes
   ```

4. Update imports and function calls
5. Test wallet functionality

## Common Issues

### Invalid Wallet Addresses
If you encounter "EVM account not found" errors:
1. Clear the wallet data to allow on-demand creation
2. The agent will create a new compatible wallet automatically
3. Existing balances will be preserved and accessible

### Action Provider Changes
- Remove any usage of deprecated wallet action providers
- Use specialized providers for specific actions (deployment, trading)
- Update function calls to match new signatures

## Best Practices

1. Use on-demand wallet creation instead of pre-storing addresses
2. Implement proper error handling for wallet operations
3. Test thoroughly after migration, especially wallet functions
4. Keep wallet secret management updated to new format

## Additional Resources

- [AgentKit 0.6.0 Release Notes](https://docs.cdp.coinbase.com/agentkit/changelog)
- [CDP Wallet Documentation](https://docs.cdp.coinbase.com/agentkit/docs/wallet) 