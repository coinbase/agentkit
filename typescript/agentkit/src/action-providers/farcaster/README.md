# Farcaster Action Provider

This directory contains the **FarcasterActionProvider** implementation, which provides actions to interact with the **Farcaster Protocol** for social media operations.

## Directory Structure

```
farcaster/
├── farcasterActionProvider.ts         # Main provider with Farcaster functionality
├── farcasterActionProvider.test.ts    # Test file for Farcaster provider
├── schemas.ts                         # Farcaster action schemas
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `account_details`: Get the details of the agent's Farcaster account

  - Returns the agent's account information

- `get_user_details`: Get the details of any Farcaster user

  - Look up users by username or FID
  - Useful for getting information about other users before interacting

- `post_cast`: Create a new Farcaster post

  - Supports text content up to 280 characters
  - Supports up to 2 embedded URLs via the optional `embeds` parameter

- `reply_to_cast`: Reply to an existing cast

  - Takes the parent cast hash and reply text
  - Supports up to 2 embedded URLs
  - Enables conversational interactions on Farcaster

- `get_feed`: Get a user's casts/feed

  - Retrieve casts from any user (defaults to agent's own casts)
  - Configurable limit (1-100 casts)
  - Option to include or exclude replies
  - Useful for getting context on previous conversations

- `get_mentions`: Get casts that mention the agent

  - Retrieve notifications where the agent was mentioned
  - Enables the agent to respond to users who have tagged them
  - Configurable limit (1-100 mentions)

## Adding New Actions

To add new Farcaster actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `farcasterActionProvider.ts`
3. Add tests in `farcasterActionProvider.test.ts`

## Network Support

The Farcaster provider supports all EVM-compatible networks.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEYNAR_API_KEY` | Your Neynar API key |
| `NEYNAR_MANAGER_SIGNER` | The managed signer UUID for posting |
| `AGENT_FID` | The FID of your agent's Farcaster account |

## Notes

- Requires a Neynar API key. Visit the [Neynar Dashboard](https://dev.neynar.com/) to get your key.
- Embeds allow you to attach URLs to casts that will render as rich previews in the Farcaster client
- The `get_mentions` action is useful for building conversational agents that respond to user interactions

For more information on the **Farcaster Protocol**, visit [Farcaster Documentation](https://docs.farcaster.xyz/).
