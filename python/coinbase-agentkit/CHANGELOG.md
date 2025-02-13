# Coinbase AgentKit Changelog

## Unreleased

## [0.1.0] - 2025-02-12

### Added

- Added Action Provider Paradigm
- Added Wallet Provider Paradigm
- Refactored directory structure
- Updated package name to `coinbase-agentkit`

## [0.0.11] - 2025-01-24

### Added

- Added `address_reputation` to retrieve the reputation score for an address
- Added `deploy_contract` to deploy a contract using the Solidity compiler
- Added `superfluid_create_flow` to create a flow using Superfluid
- Added `superfluid_update_flow` to update a flow using Superfluid
- Added `superfluid_delete_flow` to delete a flow using Superfluid

## [0.0.10] - 2025-01-22

### Added

- Added `morpho_deposit` action to deposit to Morpho Vault.
- Added `morpho_withdrawal` action to withdraw from Morpho Vault.

## [0.0.9] - 2025-01-17

### Added

- Added `get_balance_nft` action.
- Added `transfer_nft` action.
- Added `pyth_fetch_price_feed_id` action to fetch the price feed ID for a given token symbol from Pyth.
- Added `pyth_fetch_price` action to fetch the price of a given price feed from Pyth.

## [0.0.8] - 2025-01-13

### Added

- Added `wrap_eth` action to wrap ETH to WETH on Base.

## [0.0.7] - 2025-01-08

## [0.0.6] - 2024-12-06

### Added

- Improved prompts for all actions.

## [0.0.5] - 2024-11-15

### Added

- Added `account_mentions` action.
- Added `post_tweet_reply` action.

## [0.0.4] - 2024-11-15

### Added

- Added `wow_buy_token` and `wow_sell_token`.
- Added `token_uri` to `wow_create_token` action for custom token metadata.
- Refactor twitter actions to conform to extendable `twitter-langchain` updates.

## [0.0.3] - 2024-11-09

### Added

- Enhanced `wow_create_token` action error handling.

## [0.0.2] - 2024-11-07

### Added

- Added `wow_create_token` action.
- Enhanced prompts.
- Refactored Action exports.

## [0.0.1] - 2024-11-04

### Added

- Initial release of CDP Agentkit Core.
