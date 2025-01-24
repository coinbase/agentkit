# TypeScript Development Guide

This guide covers TypeScript-specific setup and development for AgentKit.

## Contents

- [Development Setup](#development-setup)
- [Adding an Agentic Action](#adding-an-agentic-action)
- [Adding an Agentic Action to Langchain Toolkit](#adding-an-agentic-action-to-langchain-toolkit)
- [Testing](#testing)
- [Code Style](#code-style)

## Development Setup

AgentKit uses Node.js v18.x or higher and npm 8.x or higher.

You can run the following commands in your terminal to check your local Node.js and npm versions:

```bash
node --version
npm --version
```

If the versions are not correct or you don't have Node.js or npm installed, download through [nvm](https://github.com/nvm-sh/nvm).

Once you have these installed, make sure you install the project dependencies by running `npm install` from the root of the repository.

## Adding an Agentic Action

One of the most common ways to contribute to AgentKit is by adding a new agentic action. Here are the high level steps:

1. Create a new file in `cdp-agentkit-core/typescript/src/actions/cdp`
2. Implement your new action inside your newly created file
    - For an example of an action, see [mint_nft.ts](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/src/actions/cdp/mint_nft.ts)
3. Add your action to [cdp-agentkit-core/typescript/src/actions/cdp/index.ts`](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/src/actions/cdp/index.ts)
4. Add a test for your action in `cdp-agentkit-core/typescript/src/tests`
    - For an example, see [mint_nft_test.ts](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/src/tests/mint_nft_test.ts)

Actions are created by implementing the `CdpAction` interface:

```typescript
import { CdpAction } from "./cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const MINT_NFT_PROMPT = `
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation. It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs. Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.`;

/**
 * Input schema for mint NFT action.
 */
const MintNftInput = z
  .object({
    contractAddress: z.string().describe("The contract address of the NFT to mint"),
    destination: z.string().describe("The destination address that will receive the NFT"),
  })
  .strip()
  .describe("Instructions for minting an NFT");

/**
 * Mints an NFT (ERC-721) to a specified destination address onchain.
 *
 * @param wallet - The wallet to mint the NFT from.
 * @param args - The input arguments for the action.
 * @returns A message containing the NFT mint details.
 */
async function mintNft(wallet: Wallet, args: z.infer<typeof MintNftInput>): Promise<string> {
  const mintArgs = {
    to: args.destination,
    quantity: "1",
  };

  try {
    const mintInvocation = await wallet.invokeContract({
      contractAddress: args.contractAddress,
      method: "mint",
      args: mintArgs,
    });

    const result = await mintInvocation.wait();

    return `Minted NFT from contract ${args.contractAddress} to address ${args.destination} on network ${wallet.getNetworkId()}.\nTransaction hash for the mint: ${result.getTransaction().getTransactionHash()}\nTransaction link for the mint: ${result.getTransaction().getTransactionLink()}`;
  } catch (error) {
    return `Error minting NFT: ${error}`;
  }
}

/**
 * Mint NFT action.
 */
export class MintNftAction implements CdpAction<typeof MintNftInput> {
  public name = "mint_nft";
  public description = MINT_NFT_PROMPT;
  public argsSchema = MintNftInput;
  public func = mintNft;
}
```

#### Components of an Agentic Action

1. **Input Schema**: Define the input parameters using Zod schemas
2. **Prompt**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.
3. **Action Class**: Implements the `CdpAction` interface with:
   - `name`: Unique identifier for the action
   - `description`: The prompt text
   - `argsSchema`: The Zod schema for validating inputs
   - `func`: The implementation function
4. **Implementation Function**: The actual logic that executes the action

Check out the [Testing](#testing) section to learn how to manually test your new action.

## Adding an Agentic Action to Langchain Toolkit

The action will be included automatically, all you need to do is add the action to the list of tools in the `CdpToolkit` class documentation in `cdp-langchain/typescript/src/toolkits/cdp_toolkit.ts`.

## Testing

### Local Testing

A good way to test new actions locally is by using the chatbot example in `cdp-langchain`. See the [chatbot README](https://github.com/coinbase/agentkit/blob/master/cdp-langchain/examples/chatbot-typescript/README.md) for instructions on setting up and running the chatbot.

The flow is:

1. Make your change as described in the [Adding an Agentic Action](#adding-an-agentic-action) section
2. From root, run  `npm run build`
3. In `cdp-langchain/examples/chatbot-typescript`, run `npm run start`
4. You can now interact with your new action via the chatbot!

### Running Tests

From the package you are working in, you can run:

```bash
npm test
```

For example, to run all tests in the `cdp-agentkit-core` package, you can run:
```bash
cd cdp-agentkit-core/typescript
npm test
```

## Code Style

We use ESLint and Prettier for linting and formatting. Run:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```
