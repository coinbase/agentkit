# TypeScript Development Guide

This guide covers TypeScript-specific setup and development for AgentKit.

## Contents

- [Development Setup](#development-setup)
- [Adding an Agentic Action](#adding-an-agentic-action)
- [Adding an Agentic Action to Langchain Toolkit](#adding-an-agentic-action-to-langchain-toolkit)
- [Integrating into an AI Agent Framework](#integrating-into-an-ai-agent-framework)
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

An Action is an interface for an AI Agent to interact with the real world: any TypeScript function that you can think of can be used by an Agent via an Action! There are a few components to an Action:

1. **Prompt**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.
2. **Input Schema**: Define the input parameters using [Zod](https://zod.dev/) schemas. Zod is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs.
3. **Implementation Function**: The actual logic that executes the action. This function receives as input the wallet that the Agent has access to, and as you'll see in the walkthrough below, we can use this wallet to invoke an onchain contract! For more information on contract invocations using a CDP wallet, see [here](https://docs.cdp.coinbase.com/cdp-sdk/docs/onchain-interactions#smart-contract-interactions).

In practice, Actions are housed in `cdp-agentkit-core/typescript/src/actions/cdp` and generally grouped by the type of action they are. For example, actions related to interacting with social platforms such as X (Twitter) are housed in `cdp-agentkit-core/typescript/src/actions/cdp/social/twitter`. When adding a new action, check if there is an existing folder for the type of action you are adding and add your new action to the appropriate folder.

Here's the structure of the actions directory:

```
./cdp-agentkit-core/typescript/src
└── actions
    └── cdp
       ├── data
       ├── defi
       └── social
```

Once you decide which folder to add your action to, go ahead and create a new file there to house your action, then read through the following sections to learn how to implement your action. For a complete example of an action, see  [mint_nft.ts](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/src/actions/cdp/mint_nft.ts).

### Crafting a good prompt

The prompt is used by the LLM to understand when and how to use the action. It's important to be as specific as possible in describing the inputs and outputs of the action and include examples. Take the Mint NFT prompt for example:

```typescript
const MINT_NFT_PROMPT = `
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation. It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs. Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.`;
```

* The prompt disambuguates the type of NFT by specifying "ERC-721"
* The prompt specifies that the destination address should not be the contract address
* The prompt specifies that the LLM should ask the user for the destination address if it is unsure
* Think about the best UX: if a contract address from a known list of addresses is required, you can instruct the LLM to use another action to get the list of addresses and prompt the user to choose an address from that list. For example, consider a DeFi action that allows a user to withdraw funds from a liquidity provider position. This action would take a contract address, so it would be valuable to have another action that can pull a list of addresses representing the user's positions. You can then instruct the LLM via the prompt to use that action in the case that no contract address is provided.

### Defining the input schema

The input schema is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs. For TypeScript, we use [Zod](https://zod.dev/) to define the input schema. For example, the Mint NFT input schema is defined as follows:

```typescript
const MintNftInput = z
  .object({
    contractAddress: z.string().describe("The contract address of the NFT to mint"),
    destination: z.string().describe("The destination address that will receive the NFT"),
  })
  .strip()
  .describe("Instructions for minting an NFT");
```

This says that the input schema has two fields: `contractAddress` and `destination`. The `contractAddress` field is required and must be a string. The `destination` field is required and must be a string. For more information on Zod, see the [Zod documentation](https://zod.dev/).

### Implementing the action

Now we need to implement the actual function that the AI will call when using your action. The function receives as input the wallet that the Agent has access to, along with the inputs defined in the input schema, and it must return a string. This return value is used by the LLM to understand the result of the action, which in turn will generate a user-facing response. Here's an example of the Mint NFT implementation function:

```typescript
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
```

Notice the return value contains useful information for the user, such as the transaction hash and link. It's important to include this information in the return value so that the user can easily see the result of the action.

Finally, we need to create a class that implements the `CdpAction` interface and export it. This class contains the name, description, input schema, and implementation function of the action. Here's an example of the Mint NFT action class:

```typescript
export class MintNftAction implements CdpAction<typeof MintNftInput> {
  public name = "mint_nft";
  public description = MINT_NFT_PROMPT;
  public argsSchema = MintNftInput;
  public func = mintNft;
}
```

This class is then exported out of [cdp-agentkit-core/typescript/src/actions/cdp/index.ts](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/src/actions/cdp/index.ts) so that is is consumable by users of the `@coinbase/cdp-agentkit-core` package.

### Testing the action

There are two forms of testing you should do: unit testing and manual end-to-end testing.

To add a unit test for your action, add a file to the folder in `cdp-agentkit-core/typescript/src/tests/actions` that corresponds to the same folder that you are adding your action to, or to the top-level if there is no folder. For an example, see [test_mint_nft.ts](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/typescript/tests/actions/test_mint_nft.ts).

You can then run the unit tests with the following command:
```bash
cd cdp-agentkit-core/typescript
npm test
```

For instructions on manual end-to-end testing, see the [Testing](#testing) section.

Check out the [Testing](#testing) section to learn how to manually test your new action.

## Adding an Agentic Action to Langchain Toolkit

The action will be included automatically, all you need to do is add the action to the list of tools in the `CdpToolkit` class documentation in `cdp-langchain/typescript/src/toolkits/cdp_toolkit.ts`.

## Integrating into an AI Agent Framework

Actions are necessary building blocks powering onchain AI applications, but they're just one piece of the puzzle. To make them truly useful, they must be integrated into an AI Agent framework such as [LangChain](https://www.langchain.com/) or [Eliza](https://elizaos.github.io/eliza/), among others.

Integrations into AI Agent frameworks are specific to the framework itself, so we can't go into specific implementation details here, but we can offer up some examples and tips.
- To automatically get access to new actions as they are released, make sure to import the `CDP_ACTIONS` constant from `@coinbase/cdp-agentkit-core`. This will make it so that all you / the framework authors have to do to get new actions is bump the version of AgentKit the framework is using.
- Check out how [AgentKit actions are mapped into LangChain Tools](https://github.com/coinbase/agentkit/blob/master/cdp-langchain/typescript/src/toolkits/cdp_toolkit.ts#L59)
- Check out how [AgentKit Actions are mapped into Eliza Actions](https://github.com/elizaOS/eliza/blob/develop/packages/plugin-agentkit/src/actions.ts#L31)

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
