# CDP Agentkit Extension - Farcaster Langchain Toolkit

This toolkit contains tools that enable an LLM agent to interact with Farcaster using Neynar's API. The toolkit provides a wrapper around the Neynar API, allowing agents to interact with Farcaster and perform actions like posting casts.

## Setup

### Prerequisites

- [Farcaster Account](https://docs.farcaster.xyz/developers/guides/accounts/create-account)
- [Neynar API Key](https://neynar.com)
- [Neynar Managed Signer ID](https://docs.neynar.com/docs/integrate-managed-signers)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/farcaster-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_NAME=<your-api-key-name>
export CDP_API_KEY_PRIVATE_KEY=$'<your-private-key>'
export AGENT_FID=<your-farcaster-fid>
export NEYNAR_API_KEY=<your-neynar-api-key>
export NEYNAR_MANAGED_SIGNER=<your-neynar-managed-signer>
export OPENAI_API_KEY=<your-openai-api-key>
export NETWORK_ID=base-sepolia  # Optional: Defaults to base-sepolia
```

## Usage

### Basic Setup

```typescript
import { FarcasterToolkit } from "@coinbase/farcaster-langchain";
import { FarcasterAgentkit } from "@coinbase/cdp-agentkit-core";

// Initialize LLM
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

// Farcaster Agentkit
const farcasterAgentkit = new FarcasterAgentkit();

// Farcaster Toolkit
const farcasterToolkit = new FarcasterToolkit(farcasterAgentkit);

// Get available Farcaster tools
const tools = farcasterToolkit.getTools();
```

The toolkit provides the following tools:

1.  **farcaster_account_details** - Retrieve account details for the agent's Farcaster account
2.  **farcaster_post_cast**       - Post a cast to Farcaster


## Examples

Check out [farcaster-langchain/examples](./examples) for sample implementations!
- [Chatbot Typescript](./examples/chatbot-typescript/README.md): Simple example of a Node.js Chatbot that can post casts to Farcaster.
