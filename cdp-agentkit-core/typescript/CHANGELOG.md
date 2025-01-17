# CDP AgentKit Core Changelog

## Unreleased

## [0.0.12] - 2025-01-17

### Added

- Added `get_balance_nft` action.
- Added `transfer_nft` action.
- Added `pyth_fetch_price_feed_id` action to fetch the price feed ID for a given token symbol from Pyth.
- Added `pyth_fetch_price` action to fetch the price of a given price feed from Pyth.
- Bump dependency `coinbase-sdk-nodejs` to version `0.14.1`.

### Fixed

- Allow wallet mnemonic seed import to optionally accept `networkId` input argument.

## [0.0.11] - 2025-01-13

### Added

- Added `wrap_eth` action to wrap ETH to WETH on Base.

## [0.0.10] - 2025-01-09

### Removed
- rogue console.log

## [0.0.9] - 2025-01-08

### Added

- Bump dependency `coinbase-sdk-nodejs` to version `0.13.0`.
- Supporting mnemonic phrase wallet import

### Refactored

- Tests
- Use `ZodString.min(1)` instead of deprecated `ZodString.nonempty()`.

## [0.0.8] - 2024-12-09

### Added

- Twitter (X) Agentkit.
- Twitter (X) account details action to retrieve the authenticated user's information.
- Twitter (X) account mentions action to retrieve the authenticated user's mentions.
- Twitter (X) post tweet action to the authenticated user's feed.
- Twitter (X) post tweet reply action to any post.

## [0.0.7] - 2024-12-06

### Added

- Improved prompts for all actions.

## [0.0.6] - 2024-12-03

### Fixed

## [0.0.5] - 2024-11-29

### Added

Initial release of the CDP Node.js AgentKit.
