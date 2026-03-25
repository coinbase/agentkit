# Uniswap V4 Action Provider

This action provider enables AI agents to interact with Uniswap V4's protocol on EVM-compatible networks.

## Features

### Swap Actions

- **get_v4_quote**: Get a price quote for a token swap without executing
- **swap_exact_input**: Execute a swap with an exact input amount
- **swap_exact_output**: Execute a swap specifying the desired output amount

### Safety Features

- Configurable slippage tolerance (default: 0.5%)
- Automatic ERC20 approval handling
- Native ETH support (no manual WETH wrapping needed)
- Clear error messages for troubleshooting
- Balance checks before execution

## Supported Networks

| Network | Network ID | Status |
|---------|------------|--------|
| Base Mainnet | `base-mainnet` | ✅ Supported |
| Base Sepolia (Testnet) | `base-sepolia` | ✅ Supported |
| Ethereum Mainnet | `ethereum-mainnet` | 🔜 Coming Soon |
| Arbitrum | `arbitrum` | 🔜 Coming Soon |

## Setup

No API keys required. The provider interacts directly with on-chain contracts.

```typescript
import { uniswapV4ActionProvider } from "@coinbase/agentkit";

const agent = new AgentKit({
  actionProviders: [uniswapV4ActionProvider()],
  // ...
});
```

## Usage

### Getting a Quote

```typescript
// Get a quote for swapping 1 ETH to USDC
const quote = await provider.getV4Quote(walletProvider, {
  tokenIn: "native", // or "eth" or "0x0000000000000000000000000000000000000000"
  tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  amountIn: "1.0",
  slippageTolerance: "0.5", // optional, defaults to 0.5%
});
```

### Executing a Swap

```typescript
// Swap exact input amount
const result = await provider.swapExactInput(walletProvider, {
  tokenIn: "native",
  tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  amountIn: "0.1",
  slippageTolerance: "0.5", // optional
  recipient: "0x...", // optional, defaults to wallet address
});
```

### Exact Output Swap

```typescript
// Get exactly 1000 USDC
const result = await provider.swapExactOutput(walletProvider, {
  tokenIn: "native",
  tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  amountOut: "1000",
  slippageTolerance: "0.5",
});
```

## Common Token Addresses (Base)

| Token | Symbol | Address |
|-------|--------|---------|
| Native ETH | ETH | `native` or `0x0000000000000000000000000000000000000000` |
| Wrapped ETH | WETH | `0x4200000000000000000000000000000000000006` |
| USD Coin | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC (Bridged) | USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` |
| DAI Stablecoin | DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` |
| Coinbase ETH | cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` |

## Architecture

This provider uses Uniswap V4's **singleton PoolManager** architecture:

- **Universal Router** for all swap operations (command-encoded)
- **PoolManager** as the central contract managing all pools
- **Flash Accounting** for gas-efficient multi-hop swaps
- **Hooks** support for customizable pool behavior

### Contract Addresses (Base)

| Contract | Address |
|----------|---------|
| PoolManager | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| Universal Router | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Quoter | `0x0d5e0f971ed27fbff6c2837bf31316121532048d` |

## Key Differences from V3

| Feature | V3 | V4 |
|---------|-----|-----|
| Pool Architecture | One contract per pool | Singleton PoolManager |
| Gas Costs | ~100k per swap | ~30% lower |
| Native ETH | WETH wrapping required | Direct native support |
| Entry Point | SwapRouter | Universal Router |
| Customization | Limited | Hooks system |
| Swap Encoding | Direct function calls | Command-encoded |

## Error Messages

Common errors and their meanings:

| Error | Meaning |
|-------|---------|
| `Uniswap V4 is not available on X` | The current network is not supported |
| `Insufficient X balance` | Wallet doesn't have enough of the input token |
| `No quote available for this swap pair` | Pool doesn't exist or has no liquidity |
| `Price moved beyond your slippage tolerance` | Slippage exceeded due to price movement |
| `Transaction was reverted` | On-chain revert, check balance and approvals |

## Development

### Running Tests

```bash
cd typescript/agentkit
pnpm test -- uniswapV4ActionProvider.test.ts
```

### File Structure

```
uniswap-v4/
├── constants.ts                 # Contract addresses & ABIs
├── schemas.ts                   # Zod validation schemas
├── utils.ts                     # Helper functions (encoding, etc.)
├── uniswapV4ActionProvider.ts   # Main provider implementation
├── uniswapV4ActionProvider.test.ts # Unit tests
├── index.ts                     # Exports
└── README.md                    # This file
```

## References

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Uniswap V4 SDK](https://github.com/Uniswap/sdks/tree/main/sdks/v4-sdk)
- [Universal Router](https://github.com/Uniswap/universal-router)
- [Pool Manager Source](https://github.com/Uniswap/v4-core/blob/main/src/PoolManager.sol)
- [AgentKit Documentation](https://github.com/coinbase/agentkit)

## License

MIT
