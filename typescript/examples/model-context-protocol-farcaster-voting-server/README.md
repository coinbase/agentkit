# Model Context Protocol - Farcaster Voting Server

An MCP server example that enables AI agents to interact with [BaseBookvsMovie](https://base-bookvs-movie.vercel.app), a Farcaster Mini App on Base blockchain that allows users to vote for their favorite book-to-film adaptations and earn 100 CSM tokens per vote.

## Overview

This example demonstrates how to use the Model Context Protocol (MCP) to:
- Check available votes for a wallet address on Base mainnet
- Build vote transactions with Builder Code for attribution
- Integrate AI agents with Farcaster Mini Apps on Base

## Features

- **Check Available Votes**: Query which book vs film titles are available for voting
- **Build Vote Transactions**: Prepare transactions with Builder Code appended for Base ecosystem attribution
- **Base Mainnet Integration**: Directly interacts with deployed smart contract on Base

## Contract

- **Network**: Base Mainnet (Chain ID: 8453)
- **Contract**: `0x407EacD1aAF2F46cC4079BFC4bef0c197A1FD6A8`
- **Live App**: [base-bookvs-movie.vercel.app](https://base-bookvs-movie.vercel.app)

## Tools

### `check_available_votes`
Check which titles are available for voting today.

**Input:**
- `walletAddress` (string): The voter's wallet address

### `build_vote_transaction`
Build vote transactions for the specified number of titles.

**Input:**
- `walletAddress` (string): The voter's wallet address
- `count` (number): Number of votes to cast (1-20)

## Setup

```bash
npm install
node index.js
```

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "farcaster-voting": {
      "command": "node",
      "args": ["/path/to/index.js"]
    }
  }
}
```

## Example Usage

Once connected to Claude Desktop:
Check available votes for wallet 0xYourAddress

Cast 3 votes for wallet 0xYourAddress

## Builder Code

All vote transactions include a Builder Code in the calldata for Base ecosystem attribution. This follows the [Base Builder Code](https://base.dev) standard.

## License

MIT
