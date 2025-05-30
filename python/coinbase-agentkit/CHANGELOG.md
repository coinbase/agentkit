# Coinbase AgentKit Changelog

<!-- towncrier release notes start -->

## [0.6.0] - 2025-05-30

### Added

- Renamed CDP env vars to modern naming convention
- Renamed CDP wallet provider & action provider interfaces for new env var names


## [0.5.1] - 2025-05-14

### Fixed

- Fixed a bug with server wallets as owner of smart wallets


## [0.5.0] - 2025-05-14

### Added

- Added CdpEvmServerWalletProvider and removed CdpWalletProvider ([#705](https://github.com/coinbase/agentkit/pull/705))
- Added CdpEvmSmartWalletProvider and removed SmartWalletProvider
- Updated CdpApiActionProvider to new CDP SDK, and removed CdpWalletActionProvider


## [0.4.0] - 2025-04-04

### Added

- Added OnrampActionProvider to enable cryptocurrency purchases ([#639](https://github.com/coinbase/agentkit/pull/639))


## [0.3.0] - 2025-03-28

### Fixed

- Fixed ERC20 transfer checksum validation by properly converting both contract and destination addresses to EIP-55 format to prevent Web3.py validation errors. ([#514](https://github.com/coinbase/agentkit/pull/514))

### Added

- Added Nillion SecretVault action ([#279](https://github.com/coinbase/agentkit/pull/279))


## [0.2.0] - 2025-03-14

### Fixed

- Fixed bug in Morpho action provider to allow depositing ERC20 tokens of variable decimal precision ([#573](https://github.com/coinbase/agentkit/pull/573))

### Added

- Added Allora Network action provider ([#110](https://github.com/coinbase/agentkit/pull/110))
- Added Hyperbolic action providers for AI, Billing, Marketplace, and Settings
- Added SSH action provider for connecting, running remote commands, downloading and uploading


## [0.1.6] - 2025-03-11

### Added

- Added edwards key support via updating cdp-sdk version


## [0.1.5] - 2025-03-07

### Fixed

- Fixed Compound borrow action ([#496](https://github.com/coinbase/agentkit/pull/496))


## [0.1.4] - 2025-02-28

### Added

- Added new action provider to interact with Compound Finance (#477)
- Added SmartWalletProvider powered by CDP Smart Wallets (#472)
- Added `rpc_url` to `EthAccountWalletProvider` configurable options. (#474)

### Fixed

- Fixed under-reporting bug to ensure all CDP API usage is properly attributed to "agentkit" source and source version (#488)
- Used network id from saved wallet (#486)
- Fixed erc20 `get_balance` action to format erc20 balance with correct number of decimals. (#467)

## [0.1.3] - 2025-02-21

- Fixed Morpho `deposit` and `withdraw` function headers to conform to the Action Provider Paradigm.

## [0.1.2] - 2025-02-14

- Added gas configuration parameters (`gas_limit_multiplier`, `fee_per_gas_multiplier`) to `CdpWalletProvider` and `EthAccountWalletProvider`.

## [0.1.1] - 2025-02-13

### Fixed

- BREAKING: Updated chain_id type from int to str

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
