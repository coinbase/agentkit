# Pendle Action Provider

This directory contains the **PendleActionProvider** implementation, which provides actions to trade Pendle V2 Principal Tokens (PT) via Pendle's hosted SDK.

## Directory Structure

```
pendle/
├── pendle_action_provider.py   # Pendle action provider
├── constants.py                # Router address, supported networks, chain ID map
├── schemas.py                  # Action input schemas
├── utils.py                    # Pendle SDK HTTP client + ERC-20 helpers
├── __init__.py                 # Main exports
└── README.md                   # This file

# From python/coinbase-agentkit/
tests/action_providers/pendle/
├── conftest.py                 # Test fixtures
├── test_pendle_provider.py     # Provider-level tests
├── test_pendle_schemas.py      # Schema validation tests
└── test_pendle_swap.py         # swap action tests
```

## Actions

- `swap_exact_token_for_pt`: Buy PT on a Pendle market with an ERC-20 (USDC, USDT, WETH, etc.).
- `swap_exact_pt_for_token`: Sell PT on a Pendle market for an ERC-20.
- `get_pendle_market_info`: Read PT/YT/SY addresses, expiry, and underlying asset for a market.

## Network Support

- Base Mainnet (`base-mainnet`)
- Ethereum Mainnet (`ethereum-mainnet`)
- Arbitrum Mainnet (`arbitrum-mainnet`)

The Pendle V2 Router (`0x888888888889758F76e7103c6CbF23ABbF58F946`) is deployed at the same address on every supported chain.

## How it works

PT swap calldata is fetched from Pendle's hosted SDK (`POST https://api-v2.pendle.finance/core/v3/sdk/{chainId}/convert`) at action time. Pendle returns the prepared transaction (`to`, `data`, `value`) plus any required ERC-20 approvals; the provider applies the approvals against the router and submits the transaction via the wallet provider.

YT trading and LP add/remove are intentionally out of scope for this provider's first release. They can be added in follow-up PRs against the same Pendle SDK.

## Notes

- Markets churn by maturity. Look up live markets at `GET https://api-v2.pendle.finance/core/v1/{chainId}/markets/active` or via the Pendle UI.
- Pendle warns that hosted SDK calldata is point-in-time (slippage and guess bounds embedded). Each action call fetches fresh calldata immediately before broadcast.
- For more information on Pendle V2, see the [Pendle Documentation](https://docs.pendle.finance/).
