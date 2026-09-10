# Token Safety Action Provider

This action provider performs safety scans on ERC-20 tokens before executing swaps or investments to detect scams, honeypots, and other malicious token patterns.

## Installation

This is a built-in action provider in AgentKit.

## Usage

```typescript
import { tokenSafetyActionProvider } from "@coinbase/agentkit";

const actionProvider = tokenSafetyActionProvider();
```

## Actions

### scan_token

Performs a safety and security scan on a token contract address using the ERC Token Safety Score API.

**Parameters:**
- `tokenAddress`: The contract address of the token (e.g. `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
- `chain`: (Optional) The target network (e.g. `base`, `ethereum`, `optimism`, `arbitrum`, `polygon`, `bsc`). Defaults to `base`.
