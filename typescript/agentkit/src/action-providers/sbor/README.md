# SBOR Action Provider

This directory contains the SBOR action provider implementation, which lets an agent check a lending rate against the market before it borrows. [SBOR](https://sbor.xyz) publishes benchmark lending rates read from lending contract state, once a day: the SBOR indices, one borrow and one supply rate per currency on Stacks, and a reference for the cost of borrowing USDC against bitcoin on Base and Ethereum.

The provider only reads SBOR's public API. It needs no key and no wallet, and never builds or sends a transaction.

## Directory Structure

```
sbor/
├── constants.ts                # API endpoint, benchmarks, thresholds
├── index.ts                    # Main exports
├── README.md                   # Documentation
├── sborActionProvider.test.ts  # Tests for the provider
├── sborActionProvider.ts       # Main provider with the SBOR actions
├── schemas.ts                  # Action input schemas
├── types.ts                    # Type definitions for the SBOR fixing
└── utils.ts                    # Fetching, freshness and benchmark resolution
```

## Actions

- `get_sbor_rate`: Get the current benchmark rates

  - One benchmark, or all of them
  - Returns the age of the fixing and flags data older than 48 hours as stale
  - Lists any benchmark not published in the fixing, to be treated as unknown, never as zero

- `compare_rate_to_sbor`: Compare an offered rate against a benchmark

  - Returns the difference in basis points, the verdict, and the best market behind the benchmark
  - Sets `stopAndAskHuman` when a borrow is more than 50 basis points above the benchmark
  - Returns no verdict on data older than 48 hours, or when the benchmark is not published

- `list_sbor_markets`: List the markets behind a benchmark

  - Each market's borrow and supply rate, utilization and depth

## Benchmarks

- `SBOR-USD`, `SBOR-BTC`, `SBOR-STX`: the SBOR indices, for lending on Stacks. A dollar on Stacks is borrowed against any crypto collateral.
- `BTC-COLLATERAL-USDC`: a reference, not an SBOR index. The cost of borrowing USDC against bitcoin wrapped by a custodian (cbBTC, WBTC), from the Morpho markets on Base and Ethereum whose only collateral is that bitcoin. Published only when every market was read.

Rates are effective annual percentages (APY). Names returned by the API are sanitized before they reach the agent.

## Network Support

SBOR reads public data and works with any network.

## Notes

SBOR is independent and free to use, including commercially, with attribution. The methodology is at [sbor.xyz/llms.txt](https://sbor.xyz/llms.txt). SBOR publishes market data, not financial advice.
