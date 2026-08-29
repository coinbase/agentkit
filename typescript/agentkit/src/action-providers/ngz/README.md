# NGZ Action Provider

Onchain habit accountability on Base. No-Going-Zone (NGZ) lets users declare habits, check in daily to build streaks, earn soulbound milestone NFTs at 7/30/90/180/365 days, and face permanent onchain consequences (Wall of Shame NFTs) when they relapse.

All data lives onchain — no backend, no database, no way to delete your shame.

**Contract:** `0x4D1b5da45a5D278900aedfc6c96F0EE0D4e28bF6` (Base Sepolia)
**Frontend:** https://frontend-one-khaki-22.vercel.app

## Actions

### Read-only (no wallet required)

| Action | Description |
|---|---|
| `get_ngz_leaderboard` | Fetch top streak holders ranked by current streak |
| `get_ngz_user` | Look up a user's full stats by wallet address |
| `get_ngz_wall_of_shame` | Fetch recent relapse events from the Wall of Shame |

### Write (wallet required)

| Action | Description |
|---|---|
| `check_in_ngz` | Record today's check-in to maintain your streak |
| `tip_ngz_user` | Send ETH respect directly to another user's wallet |

## Usage

```typescript
import { ngzActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [ngzActionProvider()],
});
```

## Networks

Supported: `base-mainnet`, `base-sepolia`

> **Note:** The NGZ contract is currently deployed on Base Sepolia testnet. Mainnet deployment is in progress.

## Streak Milestones (Soulbound NFTs)

| Days | Tier |
|---|---|
| 7 | Novice Resister |
| 30 | Goon Slayer |
| 90 | Monk Mode Activated |
| 180 | Half-Year Warrior |
| 365 | NGZ Legend |

Relapsing mints a permanent **Fell Off** shame NFT that cannot be transferred or burned.
