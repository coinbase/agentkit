# ATV Action Provider

This action provider integrates [Aarna Tokenized Vaults (ATV)](https://aarna.ai) into AgentKit, giving AI agents access to DeFi yield vaults on Ethereum and Base.

## Features

- **Vault Discovery** — List all available yield vaults with metadata and deposit tokens
- **Performance Metrics** — Query real-time NAV, TVL, and APY for any vault
- **Transaction Building** — Build deposit and withdraw calldata ready for signing

## Setup

You need an ATV API key to use this provider. Get one at [aarna.ai](https://aarna.ai) or contact dev@aarnalab.dev.

```typescript
import { atvActionProvider } from "./action-providers/atv";

const agent = new AgentKit({
  // ...
  actionProviders: [atvActionProvider("your-atv-api-key")],
});
```

## Tools

| Tool | Description |
| --- | --- |
| `atv_list_vaults` | List available DeFi yield vaults (optionally filter by chain) |
| `atv_get_vault_nav` | Get current NAV (Net Asset Value) price for a vault |
| `atv_get_vault_tvl` | Get current TVL (Total Value Locked) for a vault |
| `atv_get_vault_apy` | Get APY breakdown (base + reward + total) for a vault |
| `atv_build_deposit_tx` | Build ERC-20 approve + deposit transaction calldata |
| `atv_build_withdraw_tx` | Build withdraw transaction calldata |

## Network Support

ATV is an API-based provider that works across all EVM networks. Vaults are currently deployed on Ethereum and Base.

## Links

- [ATV SDK Repository](https://github.com/aarna-ai/atv-sdk)
- [API Documentation](https://atv-api.aarna.ai/docs)
- [npm Package](https://www.npmjs.com/package/@aarna-ai/mcp-server-atv)
