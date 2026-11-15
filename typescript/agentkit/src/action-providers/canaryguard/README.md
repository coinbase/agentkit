# CanaryGuard Action Provider

Deterministic prompt-injection firewall and honeypot scrubber for autonomous AI agents on Base mainnet via the x402 protocol.

## Usage

```typescript
import { AgentKit, canaryguardActionProvider } from "@coinbase/agentkit";

const agent = await AgentKit.from({
  actionProviders: [canaryguardActionProvider()],
});
```
