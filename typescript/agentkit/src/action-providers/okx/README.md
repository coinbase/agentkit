# OKX DEX Integration

This package provides integration with OKX DEX for token swaps and quotes on various blockchain networks, including Solana and EVM chains.

## Features

- Get real-time swap quotes for token pairs
- Execute token swaps with configurable slippage
- Support for multiple networks (Solana, Ethereum, BSC, Polygon, etc.)
- Automatic transaction signing and broadcasting
- Configurable compute units and gas settings

## Supported Networks

- Solana (chainId: "501")
- Ethereum (chainId: "1")
- BNB Smart Chain (chainId: "56")
- Polygon (chainId: "137")
- Arbitrum One (chainId: "42161")
- Optimism (chainId: "10")
- Avalanche C-Chain (chainId: "43114")
- Base (chainId: "8453")
- Polygon zkEVM (chainId: "1101")

## Setup

1. Install required dependencies:
```bash
npm install @coinbase/agentkit @solana/web3.js bs58
```

2. Configure environment variables:
```bash
# Required
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_API_PASSPHRASE=your_passphrase
OKX_PROJECT_ID=your_project_id

# Optional
SOLANA_RPC_URL=your_solana_rpc_url  # Defaults to mainnet-beta
```

## Usage

### Initialize Provider

```typescript
import { okxDexActionProvider } from '@coinbase/agentkit';

const provider = okxDexActionProvider({
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  apiPassphrase: process.env.OKX_API_PASSPHRASE,
  projectId: process.env.OKX_PROJECT_ID,
  solanaRpcUrl: process.env.SOLANA_RPC_URL
});
```

### Get Swap Quote

```typescript
const quote = await provider.getSwapQuote({
  chainId: "501", // Solana
  fromTokenAddress: "So11111111111111111111111111111111111111112", // SOL
  toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  amount: "1000000000", // 1 SOL in lamports
  slippage: "0.5" // 0.5% slippage
});
```

### Execute Swap

```typescript
const result = await provider.swapTokens({
  chainId: "501",
  fromTokenAddress: "So11111111111111111111111111111111111111112",
  toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  amount: "1000000000",
  slippage: "0.5",
  userWalletAddress: "your_wallet_address"
});
```

## Token Decimals

Common token decimals for reference:
- SOL: 9 decimals (1 SOL = 1,000,000,000 lamports)
- USDC: 6 decimals (1 USDC = 1,000,000 units)
- USDT: 6 decimals (1 USDT = 1,000,000 units)
- BONK: 5 decimals (1 BONK = 100,000 units)
- JUP: 6 decimals (1 JUP = 1,000,000 units)
- ORCA: 6 decimals (1 ORCA = 1,000,000 units)

## Error Handling

The provider includes comprehensive error handling for:
- API errors
- Network issues
- Transaction failures
- Blockhash expiration
- Invalid configurations

## Best Practices

1. Always get a quote before executing a swap
2. Use appropriate slippage based on market conditions
3. Monitor gas fees and adjust compute units if needed
4. Handle transaction timeouts and retries appropriately
5. Verify transaction status using the provided explorer links

## License

This package is part of the AgentKit project and is subject to its licensing terms.
