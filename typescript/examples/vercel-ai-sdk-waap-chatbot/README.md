# WaaP AgentKit Vercel AI SDK Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal-style chatbot with a [WaaP (Wallet as a Protocol)](https://waap.xyz) wallet.

WaaP uses two-party computation (2PC) to split private keys between the client and server, so keys are never fully exposed in any single location. The AgentKit integration wraps the `waap-cli` binary behind the standard wallet provider interface.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "What kind of wallet do you have?"
- "What is your wallet address?"
- "Sign this message: AgentKit WAAP smoke test"
- "Sign EIP-712 typed data for this payload: ..."
- "Read `balanceOf` from this ERC-20 contract for my wallet address"

## Requirements

- [Node.js 18+](https://nodejs.org/en/download/current)
- [waap-cli](https://www.npmjs.com/package/@human.tech/waap-cli) installed globally or available on `$PATH`
- A WaaP account (sign up via `waap-cli signup --email you@example.com`)

### Install waap-cli

```bash
npm install -g @human.tech/waap-cli
```

### Checking Node Version

```bash
node --version
npm --version
```

### API Keys

You'll need:

- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- WaaP account credentials (`WAAP_EMAIL` and `WAAP_PASSWORD`)

Once you have them, rename `.env-local` to `.env` and set:

```bash
# Required
OPENAI_API_KEY=
WAAP_EMAIL=
WAAP_PASSWORD=

# Optional
WAAP_CLI_PATH=
WAAP_CHAIN_ID=
WAAP_RPC_URL=
```

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This installs dependencies and builds packages locally. The chatbot uses local `@coinbase/agentkit-vercel-ai-sdk` and `@coinbase/agentkit`.

Now from the `typescript/examples/vercel-ai-sdk-waap-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start telling your agent to do things onchain.

## Prompts to test advanced WAAP actions

After startup, try these prompts:

- `Sign this message: AgentKit WAAP smoke test at 2026-04-13T10:00:00Z`
- `Sign EIP-712 typed data with domain {"name":"AgentKitTest","version":"1","chainId":11155111,"verifyingContract":"0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"}, types {"Test":[{"name":"contents","type":"string"},{"name":"value","type":"uint256"}]}, primaryType "Test", and message {"contents":"hello","value":"123","from":"<wallet address>"}`
- `Read contract 0x... using ABI [{"name":"balanceOf","type":"function","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}], function balanceOf, args ["0x..."]`

## License

[Apache-2.0](../../../LICENSE.md)
