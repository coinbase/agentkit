# Model Context Protocol - Farcaster Voting Server

An MCP server example that enables AI agents to interact with [BaseBookvsMovie](https://base-bookvs-movie.vercel.app), a Farcaster Mini App on Base blockchain that allows users to vote for their favorite book-to-film adaptations and earn 100 CSM tokens per vote.

## Overview

This example demonstrates how to use the Model Context Protocol (MCP) to:
- Check available votes for a wallet address on Base mainnet
- Build vote transactions with Builder Code for attribution
- Gate a premium action behind an x402 micropayment (USDC on Base)
- Integrate AI agents with Farcaster Mini Apps on Base

## Features

- **Check Available Votes**: Query which book vs film titles are available for voting
- **Build Vote Transactions**: Prepare transactions with Builder Code appended for Base ecosystem attribution
- **x402 Micropayments**: The final vote in any batch requires a $0.01 USDC payment via the [x402 protocol](https://x402.org), demonstrating agent-native payments alongside agent-native voting
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
Build vote transactions for the specified number of titles. The final vote in the batch is flagged as `isPaid: true` and requires a $0.01 USDC x402 payment before it can be submitted.

**Input:**
- `walletAddress` (string): The voter's wallet address
- `count` (number): Number of votes to cast (1-20)

## Setup

```bash
npm install
```

Create a `.env` file with your Coinbase Developer Platform credentials (used to settle x402 payments on Base mainnet via the CDP facilitator):

```bash
CDP_API_KEY_ID=your_cdp_key_id
CDP_API_KEY_SECRET=your_cdp_key_secret
PROJECT_WALLET=0xYourReceivingWalletAddress
```

```bash
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
The agent will prepare the transactions, automatically settling the $0.01 USDC x402 payment for the final vote before returning the signed transaction data.

## Builder Code

All vote transactions include a Builder Code in the calldata for Base ecosystem attribution. This follows the [Base Builder Code](https://base.dev) standard.

## x402 Payments

The final vote in any batch is gated behind an x402 payment requirement. This demonstrates how MCP-connected agents can both interact with on-chain state (voting) and pay for premium actions (x402) in the same workflow, using the official [x402-express](https://www.npmjs.com/package/x402-express) middleware with the Coinbase Developer Platform facilitator for Base mainnet settlement.

## License

MIT
