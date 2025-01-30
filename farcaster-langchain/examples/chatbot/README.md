# CDP Agentkit Farcaster Langchain Extension Examples - Chatbot

This example demonstrates an agent setup as a terminal style chatbot with access to Farcaster API actions via Neynar.

## Ask the chatbot to engage in the Farcaster ecosystem!
- "What are my account details?"
- "Please post a cast for me"
- "Please post in the python channel"
- "Please post with an embedded link"
- "Please get my notifications"
- "Please reply to my mentions"

## Requirements
- Python 3.10+
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Neynar API Key and Signer](https://docs.neynar.com/reference/getting-started)

### Farcaster Account Setup
1. Create a Farcaster account if you haven't already
2. Get your Neynar API key from [Neynar Dashboard](https://neynar.com/)
3. Create a signer using the Neynar API
4. Make sure you have your:
   - Neynar API Key
   - Neynar Signer UUID
   - Farcaster ID (FID)

### Checking Python Version

```bash
python --version
pip --version
```

## Run the Chatbot

### Env
Ensure the following vars are set in .env-local:
- "OPENAI_API_KEY"
- "NEYNAR_API_KEY"
- "NEYNAR_SIGNER_UUID"
- "FARCASTER_FID"

Rename .env-local to .env

```bash
make run
```

## Features
- Post casts with text up to 320 characters
- Post in specific channels (e.g., "python", "ethereum")
- Include embedded URLs in your casts
- Reply to other casts
- View user details and casts 