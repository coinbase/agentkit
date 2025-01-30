# Farcaster Langchain Toolkit
Farcaster integration with Langchain to enable agentic workflows using the core primitives defined in `cdp-agentkit-core`.

This toolkit contains tools that enable an LLM agent to interact with [Farcaster](https://www.farcaster.xyz/) via the [Neynar API](https://docs.neynar.com/). The toolkit provides a wrapper around the Neynar API, allowing agents to perform social operations like posting casts and replies.

## Setup

### Prerequisites
- Python 3.10 or higher 
- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Neynar API Key](https://docs.neynar.com/reference/getting-started)
- [Neynar Signer UUID](https://docs.neynar.com/reference/create-signer)
- Farcaster Account with FID

### Installation 
bash
pip install farcaster-langchain

### Environment Setup

Set the following environment variables:
bash
export OPENAI_API_KEY=<your-openai-api-key>
export NEYNAR_API_KEY=<your-neynar-api-key>
export NEYNAR_SIGNER_UUID=<your-signer-uuid>
export FARCASTER_FID=<your-farcaster-id>

## API Reference

### FarcasterApiWrapper
The main wrapper class that handles interactions with the Farcaster API via Neynar.

#### Methods

##### cast
python
def cast(text: str, channel_id: Optional[str] = None, embeds: Optional[List[str]] = None) -> str

Post a new cast to Farcaster. Optionally specify a channel or include embedded URLs.

##### get_notifications
python
def get_notifications(fid: Optional[str] = None) -> str

Get recent notifications for the authenticated user or specified FID.

##### get_user_details

python
def get_user_details(username: str) -> str

Get details about a specific Farcaster user.

### FarcasterToolkit
A collection of LangChain tools for Farcaster interactions.

#### Available Tools
1. **user_details** - Get user details by FID
2. **user_notifications** - Get notifications for the authenticated user
3. **cast** - Post a cast (max 320 characters, with optional channel and embeds)
4. **reply_to_cast** - Reply to an existing cast

For detailed examples and usage, see the [main README](../README.md).

## Contributing
See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.

## Documentation
For detailed documentation, please visit:
- [Agentkit-Core](https://coinbase.github.io/cdp-agentkit/cdp-agentkit-core/)
- [Neynar API Documentation](https://docs.neynar.com/)