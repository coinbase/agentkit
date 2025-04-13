# Aerodrome Action Provider

This directory contains the **AerodromeActionProvider** implementation, which enables AI agents to interact with [Aerodrome Finance](https://aerodrome.finance/) on Base Mainnet.

## Overview

The AerodromeActionProvider extends the ActionProvider class and integrates with EvmWalletProvider for blockchain interactions. It enables programmatic access to core Aerodrome DeFi operations including:

- Creating veAERO governance locks
- Voting for liquidity pool emissions with veAERO NFTs
- Swapping tokens using Aerodrome's pools

## Directory Structure

```
aerodome/
├── aerodomeActionProvider.ts       # Main provider implementation
├── aerodomeActionProvider.test.ts  # Provider test suite
├── constants.ts                    # Contract addresses and ABIs
├── schemas.ts                      # Action schemas and type validation
├── index.ts                        # Package exports
└── README.md                       # Documentation (this file)
```

## Network Support

This provider **only** supports Base Mainnet (`base-mainnet`). All contract interactions are configured for this specific network.

## Contract Addresses

The provider interacts with the following Aerodrome contract addresses on Base Mainnet:

- AERO Token: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Voting Escrow (veAERO): `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4`
- Voter: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`
- Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`

## Actions

### Create Lock
- `createLock`: Creates a new veAERO lock by depositing AERO tokens for a specified duration
  - **Purpose**: Generate a veAERO NFT that provides governance and voting power
  - **Input**:
    - `aeroAmount` (string): Amount of AERO tokens to lock (e.g., '100.5')
    - `lockDurationSeconds` (string): Lock duration in seconds (min: 604800 for 1 week, max: 126144000 for 4 years)
  - **Output**: String describing the transaction result or error
  - **Example**:
    ```typescript
    const result = await provider.createLock(walletProvider, {
      aeroAmount: "100.5",
      lockDurationSeconds: "2592000" // 30 days
    });
    ```
  - **Notes**: The contract automatically rounds lock durations down to the nearest week boundary

### Vote
- `vote`: Casts votes for liquidity pool emissions using a veAERO NFT
  - **Purpose**: Allocate veAERO voting power to direct AERO emissions to specific pools
  - **Input**:
    - `veAeroTokenId` (string): The ID of the veAERO NFT to vote with
    - `poolAddresses` (string[]): Array of Aerodrome pool addresses to vote for
    - `weights` (string[]): Array of positive integer voting weights corresponding to the pools
  - **Output**: String describing the transaction result or error
  - **Example**:
    ```typescript
    const result = await provider.vote(walletProvider, {
      veAeroTokenId: "1",
      poolAddresses: [
        "0xaaaa567890123456789012345678901234567890",
        "0xbbbb567890123456789012345678901234567890"
      ],
      weights: ["70", "30"] // 70% to first pool, 30% to second pool
    });
    ```
  - **Notes**: Voting is restricted to once per weekly epoch per veAERO token

### Swap Exact Tokens
- `swapExactTokens`: Swaps an exact amount of input tokens for a minimum amount of output tokens
  - **Purpose**: Execute token swaps through Aerodrome's liquidity pools
  - **Input**:
    - `amountIn` (string): The exact amount of input token to swap (e.g., '1.5')
    - `amountOutMin` (string): Minimum amount of output tokens expected (in atomic units)
    - `tokenInAddress` (string): Address of the token being swapped from
    - `tokenOutAddress` (string): Address of the token being swapped to
    - `to` (string): Address to receive the output tokens
    - `deadline` (string): Unix timestamp deadline for the transaction
    - `useStablePool` (boolean, optional): Whether to use stable pool (default: false)
  - **Output**: String describing the transaction result or error
  - **Example**:
    ```typescript
    const result = await provider.swapExactTokens(walletProvider, {
      amountIn: "10",
      amountOutMin: "9500000000",
      tokenInAddress: "0xcccc567890123456789012345678901234567890",
      tokenOutAddress: "0xdddd567890123456789012345678901234567890",
      to: "0x1234567890123456789012345678901234567890",
      deadline: "1714675200", // April 2, 2024
      useStablePool: false
    });
    ```
  - **Notes**: Supports both volatile and stable pools depending on the token pair

## Implementation Details

### Error Handling
All actions include comprehensive error handling for common failure scenarios:
- Token approval failures
- Insufficient balance/allowance
- Pool liquidity constraints
- Network validation

## Adding New Actions

To add new Aerodrome actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `aerodomeActionProvider.ts`
3. Add tests in `aerodomeActionProvider.test.ts`

## Usage Example

```typescript
import { AerodromeActionProvider } from "./action-providers/aerodome";
import { ViemWalletProvider } from "./wallet-providers";

// Initialize providers
const aerodrome = new AerodromeActionProvider();
const wallet = new ViemWalletProvider(/* wallet config */);

// Create a veAERO lock
const lockResult = await aerodrome.createLock(wallet, {
  aeroAmount: "100",
  lockDurationSeconds: "604800" // 1 week
});

console.log(lockResult);
