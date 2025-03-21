# AgentKit Action/Framework Wishlist

Below is a list of actions and frameworks we'd love to see open-source contributions for. It is not exhaustive and in no particular order. Please refer to in-progress pull requests to double-check if an action is already in the process of being implemented.

## DeFi Actions

### Lending & Borrowing
- [ ] Aave integration
- [ ] Hyperbolic actions

### Liquidity & Staking
- [ ] Aerodrome veAERO lock
- [ ] Aerodrome liquidity pool voting
- [ ] Stake/restake with Lido/Ether.fi
- [ ] Farm yield (Beefy, Yearn)
- [ ] Pendle interactions (LP, PT, YT)

### Trading & Data
- [ ] Uniswap integrations (particularly swaps on testnet)
- [ ] Data from DexScreener/DefiLlama
- [ ] Pond model integrations

## NFT & Digital Assets
- [ ] Integrations with OpenSea
- [ ] MagicEden create collection
- [ ] Generate image, deploy NFT collection E2E

## Cross-Chain & Infrastructure
- [ ] Bridge
- [ ] Hyperlane cross-chain transfers
- [ ] Interact with smart wallet/spend permissions

## Social & Communication
- [ ] Bountycaster post bounty
- [ ] Agent communication (potentially via XMTP)
- [ ] Farcaster improvements:
  - [ ] Get other account details
  - [ ] Handle replies (currently mentions are ignored)
  - [ ] Get feed context (previous casts)

## Other Networks
Since we support any network by bringing your own RPC, we'd love to have network-specific actions beyond Base. The most important actions are:
- Swap
- Borrow/lend
- Staking
- NFTs
- LP Management

## Wallet Provider Support
We support any wallet that can be connected via the EIP-1193 standard:
- [ ] Turnkey
- [ ] Privy Server Wallets
- [ ] Privy Embedded Wallets (this would be better for a demo-app with a frontend component since you need that for signing)
- [ ] Lit Protocol
- [ ] Solana wallets

## AI Framework Support
Currently aiming to support [all frameworks supported by Virtuals](https://whitepaper.virtuals.io/developer-documents/release-notes/terminal-api#supported-frameworks):

### Core AI Frameworks
- [ ] Claude MCP support
- [ ] GAME by Virtuals
- [ ] CrewAI
- [ ] AutoGen
- [ ] AutoGPT

### Additional Frameworks
- [ ] AISDK (Vercel) (in progress...)
- [ ] Mastra
- [ ] AgentForce
- [ ] AWS Multi-agent
- [ ] PydanticAI

## Infrastructure Improvements

### Wallet Integration
- [ ] Integrate with any wallet provider following the EIP-1193 standard
- [ ] Connect to a user-facing EOA wallet
- [ ] Spend permissions/session keys for agent-controlled smart wallets

### Project Ideas
- [ ] Integrate with commerce rails for agent payments
- [ ] Integrate with XMTP for inter-agent communication
