# Offramp Action Provider

Native AgentKit wrapper around [`@usdctofiat/offramp`](https://www.npmjs.com/package/@usdctofiat/offramp) from [Galleon / USDCtoFiat](https://usdctofiat.xyz).

This provider does not republish the SDK. It calls `cashout({ mode, signer, amount, currency, platform, payee })`.

## Modes

- **fast** — Peer Cash at the live market rate, 0% spread. Galleon earns the locked `TOFIAT` Curator referral. Do not force Fast onto Delegate.
- **best** — deposit is delegated to the Delegate strategy. Galleon earns 10 bps on fill.

Attribution (`peer-ref-TOFIAT` and `galleonlabs`) is locked by the SDK and cannot be replaced.

## Network

Base mainnet only.

## Usage

```typescript
import { offrampActionProvider } from "@coinbase/agentkit";

const agentkit = await Agentkit.from({
  actionProviders: [offrampActionProvider()],
});
```

Product docs: https://usdctofiat.xyz/developers
