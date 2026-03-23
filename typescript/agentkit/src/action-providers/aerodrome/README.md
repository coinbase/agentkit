# Aerodrome Action Provider

This action provider integrates [Aerodrome Finance](https://aerodrome.finance/) with AgentKit, enabling AI agents to interact with the leading DEX on Base. Supports token swaps, liquidity management, veAERO governance locking, voting, reward claiming, and lock management.

## Directory Structure

```
aerodrome/
├── aerodromeActionProvider.ts       # Main provider with all actions
├── aerodromeActionProvider.test.ts  # Jest test suite (62 tests)
├── constants.ts                     # Contract addresses & ABIs
├── schemas.ts                       # Zod validation schemas
├── index.ts                         # Public exports
└── README.md                        # This file
```

## Actions

### Trading
- `aerodrome_get_quote`: Get a swap quote for a token pair (read-only)
- `aerodrome_swap`: Swap tokens with slippage protection (auto-calculates min output from quote)

### Liquidity
- `aerodrome_add_liquidity`: Add liquidity to a pool and receive LP tokens
- `aerodrome_remove_liquidity`: Remove liquidity with slippage protection via quoteRemoveLiquidity

### Governance (veAERO)
- `aerodrome_create_lock`: Lock AERO tokens to create a veAERO NFT for governance voting
- `aerodrome_vote`: Vote with veAERO NFT to direct AERO emissions to pools
- `aerodrome_increase_amount`: Add more AERO to an existing veAERO lock
- `aerodrome_increase_unlock_time`: Extend the lock duration of a veAERO position
- `aerodrome_withdraw`: Withdraw AERO from an expired veAERO lock

### Rewards
- `aerodrome_claim_rewards`: Claim trading fees and bribes earned from veAERO voting

## Network Support

- Base Mainnet only

## Design Decisions

- **Slippage-based swap**: Uses `slippageBps` (default 1%, max 10%) instead of raw `amountOutMin`. The action internally fetches a quote and computes the minimum output.
- **Safe LP removal**: Uses `quoteRemoveLiquidity` to estimate expected output, then applies slippage protection. Never uses zero minimums.
- **Token details via multicall**: Reuses `getTokenDetails` from the ERC20 action provider for efficient token info + balance fetching.
- **veAERO token ID extraction**: Parses the `Deposit` event log (filtered by contract address) from the `createLock` transaction to return the veAERO NFT token ID.
- **Pre-flight checks**: Vote verifies NFT ownership, voting power, and epoch status. Withdraw checks lock expiry and permanent lock status. increaseUnlockTime validates the 4-year ceiling.
- **Default deadline**: 10 minutes from execution time.
- **Gauge validation**: Vote and claimRewards validate gauge existence before submitting transactions.

## Notes

- Aerodrome uses a `Route` struct for swaps (not simple address paths). Each route specifies `from`, `to`, `stable`, and `factory`.
- Pools can be **stable** (correlated assets, Curve's x^3*y + y^3*x invariant) or **volatile** (standard x*y=k).
- veAERO voting directs AERO emissions to pools. Voters earn 100% of trading fees and bribes.
- Voting occurs per epoch (weekly, Thursday to Thursday UTC).
- Lock durations are rounded down to the nearest Thursday epoch boundary on-chain.
