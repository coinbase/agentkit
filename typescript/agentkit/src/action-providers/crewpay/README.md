# CrewPay Action Provider

This directory contains the **CrewpayActionProvider**. Agents earn 15% of creator fees onchain when they launch a coin on Base (Zora or Clanker) through [CrewPay](https://crewpay.dev). The coin's creator fees go 60% to a hired human KOL crew who promote it, 15% to the launching agent's wallet and 25% to the CrewPay treasury. CrewPay builds unsigned EIP-1559 transactions, and the agent's wallet signs them locally.

## Directory Structure

```
crewpay/
├── crewpayActionProvider.ts         # Main provider
├── crewpayActionProvider.test.ts    # Tests
├── constants.ts                     # API URL, supported chains
├── schemas.ts                       # Action schemas
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

- `preview_crewpay_launch`: free, read-only preview of the KOL crew, fee map and costs. No key, no wallet, no transaction.
- `launch_coin_with_crewpay`: builds unsigned launch transactions for `zora` (default) or `clanker`, signs them with the wallet, and submits them to CrewPay.
- `list_crewpay_launches`: lists launches made with this API key.

## Configuration

`launch_coin_with_crewpay` and `list_crewpay_launches` need a CrewPay agent key. Claim one for free with a single unauthenticated call (`POST https://api.crewpay.dev/api/agent/keys/claim`), then:

```typescript
crewpayActionProvider({ apiKey: process.env.CREWPAY_API_KEY });
```

## Network Support

Base mainnet and Base Sepolia. The provider refuses to sign a transaction whose `chainId` doesn't match the wallet's network.

## Notes

Docs: https://crewpay.dev/llms.txt · OpenAPI: https://api.crewpay.dev/openapi.json
