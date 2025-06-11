# Coinbase Create Onchain Agent Changelog

<!-- towncrier release notes start -->

## [0.7.0] - 2025-05-30

### Added

- Bump coinbase-agentkit to 0.6.0 in beginner template and chatbot template
- Bump coinbase-agentkit-langchain to 0.5.0 in beginner template and chatbot template
- Bump coinbase-agentkit-openai-agents-sdk to 0.5.0 in beginner template and chatbot template
- Renamed CDP env vars to modern naming convention


## [0.6.1] - 2025-05-15

### Added

- Fixed bug where CLI would download stale cached templates
- Bump coinbase-agentkit to 0.5.1 in beginner template and chatbot template


## [0.6.0] - 2025-05-14

### Added

- Updated to support CdpEvmServerWalletProvider and CdpEvmSmartWalletProvider ([#705](https://github.com/coinbase/agentkit/pull/705))
- Bump coinbase-agentkit to 0.5.0 in beginner template and chatbot template
- Bump coinbase-agentkit-langchain to 0.4.0 in beginner template and chatbot template
- Bump coinbase-agentkit-openai-agents-sdk to 0.4.0 in beginner template and chatbot template


## [0.5.0] - 2025-04-04

### Added

- Bump in templates coinbase-agentkit to 0.4.0, coinbase-agentkit-langchain to 0.3.0 and coinbase-agentkit-openai-agents-sdk to 0.3.0

## [0.4.0] - 2025-03-28

### Added

- Updated default wallet provider to SmartWalletProvider ([#622](https://github.com/coinbase/agentkit/pull/622))


## [0.3.0] - 2025-03-14

### Added

- Added OpenAI Agents SDK support ([#557](https://github.com/coinbase/agentkit/pull/557))
- Added --beginner flag


## [0.2.0] - 2025-03-07

### Fixed

- Fixed indentation bug in chatbot.py template

### Added

- Added revised network selection ([#498](https://github.com/coinbase/agentkit/pull/498))
- Added smart wallet support ([#503](https://github.com/coinbase/agentkit/pull/503))


## [0.1.4] - 2025-02-28

### Added

- Added wallet persistence to all templates (#484)

### Fixed

- Fixed missing .gitignore in template (#478)

## [0.1.3] - 2025-02-24

## Added

- Added guard to CLI to ensure it is only called with supported Python versions

## [0.1.2] - 2025-02-24

## Fixed

- Fixed the CLI's missing dependencies

## [0.1.1] - 2025-02-24

## Fixed

- Fixed the CLI's lack of access to the templates directory

## [0.1.0] - 2024-02-23

### Added

- Initial release of the create-onchain-agent CLI tool
