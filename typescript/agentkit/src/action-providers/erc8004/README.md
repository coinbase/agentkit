# ERC-8004 Action Providers

This directory contains **ERC8004IdentityActionProvider** and **ERC8004ReputationActionProvider**, which expose actions for the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) trustless agent registries (identity and reputation) on supported EVM networks. Implementation uses the Agent0 SDK (`getAgent0SDK`).

## Directory Structure

```
erc8004/
├── erc8004IdentityActionProvider.ts      # Identity registry: register, metadata, discovery
├── erc8004IdentityActionProvider.test.ts
├── erc8004ReputationActionProvider.ts    # Reputation registry: feedback, responses, queries
├── erc8004ReputationActionProvider.test.ts
├── identitySchemas.ts                    # Zod schemas for identity actions
├── reputationSchemas.ts                  # Zod schemas for reputation actions
├── constants.ts                          # Supported network IDs and helpers
├── utils.ts                              # Agent0 SDK wiring
├── index.ts                              # Public exports
└── README.md                             # This file
```

## Providers

Register both providers on an `EvmWalletProvider` when you want full ERC-8004 coverage:

```typescript
import {
  erc8004IdentityActionProvider,
  erc8004ReputationActionProvider,
} from "@coinbase/agentkit";

const identity = erc8004IdentityActionProvider({ pinataJwt: process.env.PINATA_JWT });
const reputation = erc8004ReputationActionProvider({ pinataJwt: process.env.PINATA_JWT });
```

Optional `pinataJwt` enables IPFS uploads for richer metadata and off-chain feedback payloads (comments, A2A task fields).

## Identity actions (`erc8004_identity`)

- `register_agent`: Mint an agent NFT on the Identity Registry and set registration JSON / URI.

- `update_agent_metadata`: Patch agent configuration (name, description, image, MCP/A2A endpoints, ENS, active/x402 flags, trust models, OASF taxonomies, custom metadata).

- `get_owned_agents`: List agents owned by an address (defaults to the connected wallet).

- `search_agents`: Discover agents via semantic keyword search, filters (capabilities, status, reputation), sort, and pagination.

- `get_agent_info`: Fetch full agent profile (identity, endpoints, capabilities, reputation summary, status).

## Reputation actions (`erc8004_reputation`)

- `give_feedback`: Submit scored feedback (tags, endpoint, optional comment / A2A context); core data on-chain, optional IPFS file when JWT is set. Callers cannot rate their own agent.

- `revoke_feedback`: Revoke feedback previously sent from the connected wallet.

- `append_response`: Append an off-chain response URI to a feedback entry (agent owners, aggregators, auditors, etc., per spec).

- `get_agent_feedback`: Read feedback for an agent with optional filters (reviewers, value range, tags).

## Adding New Actions

1. Add or extend Zod schemas in `identitySchemas.ts` or `reputationSchemas.ts`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema).
2. Implement the action on `ERC8004IdentityActionProvider` or `ERC8004ReputationActionProvider` with `@CreateAction`.
3. Cover behavior in the matching `*.test.ts` file.

## Network Support

Supported `networkId` values are defined in `constants.ts` (e.g. Ethereum and Base mainnet/sepolia, Polygon mainnet). Other networks are rejected by `supportsNetwork`.

## Notes

- Agent IDs may be passed as a local token id (e.g. `"123"`) or as `"chainId:tokenId"` (e.g. `"84532:123"`).
- For broader setup and examples, see the AgentKit [8004 guide](../../../../8004.md) in this repo.
