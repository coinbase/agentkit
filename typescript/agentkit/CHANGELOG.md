# AgentKit Changelog

## Unreleased

### Added

- Added `svmWalletProvider` abstract class for interacting with Solana.
- Added `solanaKeypairWalletProvider` to concretely implement `svmWalletProvider` with a local keypair.

## [0.1.2] - 2025-02-07

### Added

- Added `alchemyTokenPricesActionProvider` to fetch token prices from Alchemy.
- Added `token_prices_by_symbol` action to fetch token prices by symbol.
- Added `token_prices_by_address` action to fetch token prices by network and address pairs.
- Added `moonwellActionProvider` to interact with Moonwell protocol on Base
- Added `agentkit` source + source version tag to CDP API correlation header

### Fixed

- Added account argument in call to estimateGas in CdpWalletProvider
- Added explicit template type arguments for `ActionProvider` extensions

## [0.1.1] - 2025-02-02

### Added

- Added re-export for `./src/network/` in `./src/index.ts`

## [0.1.0] - 2025-02-01

### Added

- Added Action Provider Paradigm
- Added Wallet Provider Paradigm
- Refactored directory structure
- Updated package name to `@coinbase/agentkit`

## [0.0.14] - 2025-01-24

### Added

- Added `address_reputation` to retrieve the reputation score for an address
- Added `deploy_contract` action to deploy a contract using the Solidity compiler
- Added `farcaster_account_details` to retrieve farcaster account details
- Added `farcaster_post_cast` to post a cast to farcaster

## [0.0.13] - 2025-01-22

### Added

- Added `morpho_deposit` action to deposit to Morpho Vault.
- Added `morpho_withdrawal` action to withdraw from Morpho Vault.

## [0.0.12] - 2025-01-17

### Added

- Added `get_balance_nft` action.
- Added `transfer_nft` action.
- Added `pyth_fetch_price_feed_id` action to fetch the price feed ID for a given token symbol from Pyth.
- Added `pyth_fetch_price` action to fetch the price of a given price feed from Pyth.

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
