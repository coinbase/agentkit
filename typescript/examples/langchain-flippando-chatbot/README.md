# About

Flippando Agent is an AI agent designed to interact with Flippando, a blockchain-based tile-flipping puzzle game. It serves as both an autonomous player and an interactive assistant, bridging the gap between complex blockchain mechanics and user-friendly gameplay.

## Project Purpose

The primary goal of the Flippando Agent is to support Flippando players by:
1. Automating gameplay for testing and demonstration purposes
2. Providing intelligent assistance to players through a chat interface
3. Facilitating complex interactions with blockchain-based game mechanics (from basic building blocks, like flipping specific tiles, to more complex workflows, like playing a game to completion, minting the resulting NFT and posting it on Twitter)
4. Serve as a building foundation for anyone willing to extend its fucntionality with new actions.

## Key Features

1. **Autonomous Game Playing**: The agent can create, initialize and play Flippando games autonomously.

2. **Interactive Chat Mode**: Users can communicate with the agent through a chat interface, asking questions or requesting assistance with game-related tasks.

3. **NFT Minting**: Upon completing a game, the agent can mint non-fungible tokens (NFTs) representing the solved puzzles, supporting other players with NFT liquidity.

4. **Art Creation**: The agent can generate art itself, using the available NFTs in the game ecosystem, unlocking $FLIPND tokens for other players.

5. **Art Suggestions**: The agent can generate art suggestions, baseed on the available NFTs for a specific player.

6. **Arbitrage Suggestions**: Flippando is an "app-first, chain second" project, and it's deployed identically on a variety of chains. The agent can analyze the game ecosystem on all the chain where it's deployed and make arbitrage suggestions, both for the available NFTs, and for the $FLIPND fungible token price.

7. **Twitter Integration**: The agent can post basic flips, art creations and art suggestions on Twitter, fostering engagement.


## Core Components

1. **FlippandoAgentkit**: The central component that manages interactions with Flippando game contracts. It provides a comprehensive set of methods for all game actions and handles blockchain connections.

2. **FlippandoToolkit**: A collection of tools extending the Langchain library's BaseToolkit. This toolkit encapsulates all available Flippando actions.

3. **Actions**: A set of individual game operations, each designed to perform specific tasks within the Flippando ecosystem. These include creating games, flipping tiles, minting NFTs, and creating art, but also changing the current network (chain) or making arbitrage suggestions.

## Technical Stack

- **Language**: TypeScript
- **Blockchain Interaction**: Ethers.js
- **AI Framework**: Langchain
- **Smart Contracts**: Solidity (Flippando game contracts)
- **Social Media Integration**: Twitter API

## Inception

The agent was created during EthGlobal 2025 hackathon.