# AgentKit Changelog

## 0.8.2

### Patch Changes

- [#753](https://github.com/coinbase/agentkit/pull/753) [`ff04ce9`](https://github.com/coinbase/agentkit/commit/ff04ce9dd8f6de48692560bd84b430c45576925e) Thanks [@phdargen](https://github.com/phdargen)! - Added a new action provider to call x402 protected api

- [#700](https://github.com/coinbase/agentkit/pull/700) [`913beb0`](https://github.com/coinbase/agentkit/commit/913beb06541224b41d5a923474470ec9fee7de76) Thanks [@pawelpolak2](https://github.com/pawelpolak2)! - Improve the vaults.fyi provider

## 0.8.1

### Patch Changes

- [#751](https://github.com/coinbase/agentkit/pull/751) [`97408c1`](https://github.com/coinbase/agentkit/commit/97408c1976995a8abff124cbc8baead3209da0b2) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Fixed an indirect dependency issue

## 0.8.0

### Minor Changes

- [#732](https://github.com/coinbase/agentkit/pull/732) [`cd044db`](https://github.com/coinbase/agentkit/commit/cd044db7ae35140726c35ba82429b0f0885ccb60) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Renamed CDP env vars to modern naming convention

## 0.7.2

### Patch Changes

- [#716](https://github.com/coinbase/agentkit/pull/716) [`30dc6bd`](https://github.com/coinbase/agentkit/commit/30dc6bdca68cb567f91123c21c1fe3a5774d4f6b) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Fixed CdpV2EvmWalletProvider sendTransaction to use EIP1559 transactions

## 0.7.1

### Patch Changes

- [#610](https://github.com/coinbase/agentkit/pull/610) [`beb34c9`](https://github.com/coinbase/agentkit/commit/beb34c9a300c66ddb03c303685a322dc45e74a13) Thanks [@nowak-token](https://github.com/nowak-token)! - Fixed ReferenceError when initializing TwitterActionProvider by implementing lazy initialization pattern with proper null checks

## 0.7.0

### Minor Changes

- [#665](https://github.com/coinbase/agentkit/pull/665) [`bfed1a0`](https://github.com/coinbase/agentkit/commit/bfed1a07a0c5443297af20fa566723fa20e8a00f) Thanks [@jstinhw](https://github.com/jstinhw)! - Added ZeroDevWalletProvider powered by ZeroDev smart account

  This change introduced a new wallet provider, `ZeroDevWalletProvider` which allows AgentKit to use ZeroDev's chain-abstracted smart account with any EvmWalletProvider like cdpWalletProvider or privyEvmWalletProvider as the signer.

- [#678](https://github.com/coinbase/agentkit/pull/678) [`f6b464a`](https://github.com/coinbase/agentkit/commit/f6b464a62f3593957648c2d2f5bdfbca292a1f68) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Added CdpV2EvmWalletProvider, CdpV2SolanaWalletProvider, and a unified CdpV2WalletProvider entrypoint

## 0.6.2

### Patch Changes

- [#645](https://github.com/coinbase/agentkit/pull/645) [`8fdb847`](https://github.com/coinbase/agentkit/commit/8fdb847c32cc90b1500d3883cc2f68b97b90ba86) Thanks [@pawelpolak2](https://github.com/pawelpolak2)! - Add vaults.fyi provider

## 0.6.1

### Patch Changes

- [#656](https://github.com/coinbase/agentkit/pull/656) [`8465c35`](https://github.com/coinbase/agentkit/commit/8465c355a648601e2de8ea858d3571922eb3ec52) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Fixed Privy dependency on @privy-io/public-api

## 0.6.0

### Minor Changes

- [#641](https://github.com/coinbase/agentkit/pull/641) [`03ea0e5`](https://github.com/coinbase/agentkit/commit/03ea0e541cb0b76fefcc15fe9d74297ac809801d) Thanks [@pawelpolak2](https://github.com/pawelpolak2)! - Added transaction queue to the cdp wallet provider to avoid nonce collisions.

- [#617](https://github.com/coinbase/agentkit/pull/617) [`d64b11c`](https://github.com/coinbase/agentkit/commit/d64b11cb8a7f795e5c33e45c70eec8153977783d) Thanks [@apoorvlathey](https://github.com/apoorvlathey)! - Added a new action provider to interact with Flaunch protocol

- [#638](https://github.com/coinbase/agentkit/pull/638) [`4d4b031`](https://github.com/coinbase/agentkit/commit/4d4b031242d6760a089b300d8f135110dd8d467d) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Added OnrampActionProvider to enable cryptocurrency purchases

## 0.5.0

### Minor Changes

- [#584](https://github.com/coinbase/agentkit/pull/584) [`6d8ac5b`](https://github.com/coinbase/agentkit/commit/6d8ac5b6608fafe1ee4256caac3ad93659d87c8b) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Added gasless transfers for USDC/CBBTC on Base/Base-Sepolia

- [#566](https://github.com/coinbase/agentkit/pull/566) [`bfd6442`](https://github.com/coinbase/agentkit/commit/bfd6442df09247efe2b3d378ca3e49c123b19f8c) Thanks [@phdargen](https://github.com/phdargen)! - Added AcrossActionProvider to allow bridging tokens using the Across protocol

  - `bridge_token` action to bridge native and ERC20 tokens
  - `check_deposit_status` action to check the status of bridge deposits

- [#618](https://github.com/coinbase/agentkit/pull/618) [`155d468`](https://github.com/coinbase/agentkit/commit/155d468ec5973a5bd3ab9c66e7981aaa544f6717) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Added support for Privy Evm embedded wallets with delegation. (Thanks @njokuScript!)

  This change introduces a new wallet provider, `PrivyEvmDelegatedEmbeddedWalletProvider`, which allows AgentKit to use Privy's embedded wallets that have been delegated to a server. This enables autonomous agents to perform onchain actions on behalf of users who have delegated transaction signing authority to the agent.

  Key changes:

  - Add `PrivyEvmDelegatedEmbeddedWalletProvider` class extending the `EvmWalletProvider` base class
  - Update the `PrivyWalletProvider` factory to support embedded wallets via a new `walletType` option

### Patch Changes

- [#619](https://github.com/coinbase/agentkit/pull/619) [`6514e0c`](https://github.com/coinbase/agentkit/commit/6514e0c2fd561525092deafc231853182d9a7d1e) Thanks [@stat](https://github.com/stat)! - Add a new Messari action provider that enables AI agents to query the Messari AI toolkit for crypto market research data.

## 0.4.0

### Minor Changes

- [#513](https://github.com/coinbase/agentkit/pull/513) [`e826563`](https://github.com/coinbase/agentkit/commit/e826563297aeda2ecfdb7d600ea5ed3711a62eff) Thanks [@stat](https://github.com/stat)! - Added defillama action provider for find protocol, get protocol, and get token price

### Patch Changes

- [#573](https://github.com/coinbase/agentkit/pull/573) [`81b35a2`](https://github.com/coinbase/agentkit/commit/81b35a23916b2c344972fd1bcb0cbb85d01b2cbd) Thanks [@John-peterson-coinbase](https://github.com/John-peterson-coinbase)! - Fixed bug in Morpho action provider to allow depositing ERC20 tokens of variable decimal precision

## 0.3.0

### Minor Changes

- [#261](https://github.com/coinbase/agentkit/pull/261) [`674f6c8`](https://github.com/coinbase/agentkit/commit/674f6c83f12a081c2fd605e1bff094bbb4744c1c) Thanks [@phdargen](https://github.com/phdargen)! - Added a new action provider to interact with OpenSea

- [#115](https://github.com/coinbase/agentkit/pull/115) [`9261c42`](https://github.com/coinbase/agentkit/commit/9261c42e91fecbd6b384856cdfc7ad230ce6f73e) Thanks [@fernandofcampos](https://github.com/fernandofcampos)! - Added `alloraActionProvider` to fetch inferences from Allora Network.

## [0.2.3] - 2025-02-28

### Added

- [#392](https://github.com/coinbase/agentkit/pull/392) [`c5c1513`](https://github.com/coinbase/agentkit/commit/c5c1513933626bd6aef42652a875accb0c95d82e) Thanks [@mikeghen](https://github.com/mikeghen)! - Added `compoundActionProvider` to interact with Compound protocol on Base.

- [#465](https://github.com/coinbase/agentkit/pull/465) [`165360a`](https://github.com/coinbase/agentkit/commit/165360a108ccf1ce1142ebba875c86fbaa823a6c) Thanks [@CarsonRoscoe](https://github.com/CarsonRoscoe)! - Added SmartWalletProvider powered by CDP Smart Wallets

- [#487](https://github.com/coinbase/agentkit/pull/487) [`37d7083`](https://github.com/coinbase/agentkit/commit/37d70831cb0cfe1addb6a61c420c2a8d296bd64e) Thanks [@0xRAG](https://github.com/0xRAG)! - bump @coinbase/coinbase-sdk for support for Ed25519 API keys

### Fixed

- [#486](https://github.com/coinbase/agentkit/pull/486) [`bc4d4d2`](https://github.com/coinbase/agentkit/commit/bc4d4d219b706c4902ff402de49aae3d11c11952) Thanks [@stat](https://github.com/stat)! - use network id from saved wallet

- [#488](https://github.com/coinbase/agentkit/pull/488) [`d12bc8e`](https://github.com/coinbase/agentkit/commit/d12bc8e29c8a4dd8b36788e4e244eca7eddd575e) Thanks [@John-peterson-coinbase](https://github.com/John-peterson-coinbase)! - Fixed under-reporting CDP API metrics bug by properly adding source and source version when configuring the CDP SDK

- [#467](https://github.com/coinbase/agentkit/pull/467) [008f871](https://github.com/coinbase/agentkit/commit/008f871d1c9ebf4fcb5600584b066bdc6d69c8b9) Thanks [0xRAG](https://github.com/0xRAG)! - Fixed erc20 `get_balance` action to format erc20 balance with correct number of decimals.

## [0.2.2] - 2025-02-19

### Added

- Added support for fauceting SOL on `solana-devnet`.
- Added `JupiterActionProvider` with `swap` for Solana.

### Fixed

- Fixed handling of `CDP_API_KEY_PRIVATE_KEY` by moving parsing into CDP classes.
- Fixed handling of `TokenAccountNotFoundError` within `splActionProvider` `getBalance`.
- Fixed `wowActionProvider` exports, supported networks, and ensuring response parity with python.

## [0.2.1] - 2025-02-18

### Added

- Added `get_balance` to `splActionProvider` to fetch balance of an SPL token.
- Added support for Privy Server Wallets on Solana. See [here](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/README.md#privywalletprovider-solana) for more details.

## [0.2.0] - 2025-02-15

### Added

- Added gas configuration parameters (`gasLimitMultiplier`, `feePerGasMultiplier`) to `CdpWalletProvider` and `ViemWalletProvider`.
- Added `svmWalletProvider` with `solanaKeypairWalletProvider` implementation to create a Solana wallet with a local keypair.
- Added SPL action provider with `transfer` action.
- Added `privyWalletProvider` to use a Privy server wallet for agent actions.
- Added gas configuration parameters (`gasLimitMultiplier`, `feePerGasMultiplier`) to `CdpWalletProvider` and `ViemWalletProvider`.
- Added Solana chatbot example.
- Added Privy EVM chatbot exmaple.

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
