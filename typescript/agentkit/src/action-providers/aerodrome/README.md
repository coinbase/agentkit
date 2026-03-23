# Aerodrome Action Provider

The Aerodrome Action Provider enables AI agents to interact with [Aerodrome Finance](https://aerodrome.finance/) on the Base Network.

## Features

### veAERO Management
- **createLock**: Lock AERO tokens to create veAERO NFTs for governance voting

### Governance
- **vote**: Cast votes for liquidity pool emissions with a veAERO NFT

### V2 Pools (Stable & Volatile)
- **swapExactTokens**: Swap tokens through Aerodrome V2 pools (stable or volatile)

## Usage

Import and initialize the action provider:

```typescript
import { aerodromeActionProvider } from '@coinbase/agentkit';

// Initialize AgentKit
const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    // ... other providers
    aerodromeActionProvider(),
  ],
});
```

The provider currently supports Base Mainnet only.