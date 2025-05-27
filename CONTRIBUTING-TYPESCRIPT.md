# TypeScript Development Guide

This guide covers TypeScript-specific setup and development for AgentKit.

## Contents

- [Development Setup](#development-setup)
- [Adding an Action Provider](#adding-an-action-provider)
- [Adding a Wallet Provider](#adding-a-wallet-provider)
- [Integrating into an AI Agent Framework](#integrating-into-an-ai-agent-framework)
- [Testing](#testing)
- [Code Style](#code-style)
- [Documentation](#documentation)
- [Changelog](#changelog)

## Development Setup

AgentKit uses Node.js v18.x or higher and pnpm 10.7.x or higher.

You can run the following commands in your terminal to check your local Node.js and pnpm versions:

```bash
node --version
pnpm --version
```

If the versions are not correct or you don't have Node.js or pnpm installed, download Node.Js through [fnm](https://github.com/Schniz/fnm) and then install [pnpm](https://pnpm.io/installation).

Once you have these installed, make sure you install the project dependencies by running `pnpm install` from the root of the TypeScript monorepo, in other words, from the root `typescript/` folder.

> **Note for existing contributors**: If you previously contributed when this was an npm turbo monorepo, you'll need to remove existing node_modules directories and reinstall dependencies with pnpm. From the `typescript/` directory, run:
> ```bash
> find . -name "node_modules" -type d -exec rm -rf {} + && pnpm i
> ```

## Adding an Action Provider

An Action is an interface for an AI Agent to interact with the real world: any TypeScript function that you can think of can be used by an Agent via an Action! Actions are grouped by Action Providers, which are classes that contain a collection of actions along with configuration and helper functions.

You can use the `generate-action-provider` script to generate a new action provider. See the [Generate Action Provider](./typescript/agentkit/scripts/generate-action-provider/README.md) for more information.

Action Components:

1. **Name**: The name of the action. This is used to identify the action when it is added to an Agent.

2. **Description**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.

3. **Input Schema**: Define the input parameters using [Zod](https://zod.dev/) schemas. Zod is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs.

4. **Invocation Function**: The actual logic that executes the action. This function receives as input the wallet that the Agent has access to, and as you'll see in the walkthrough below, we can use this wallet to invoke an onchain contract! For more information on contract invocations using a CDP wallet, see [here](https://docs.cdp.coinbase.com/cdp-sdk/docs/onchain-interactions#smart-contract-interactions).

In practice, action providers are housed in `typescript/agentkit/src/action-providers` and generally grouped by the type of action they are and the configuration they require. For example, actions related to interacting with social platforms such as X (Twitter) are housed in `typescript/agentkit/src/action-providers/twitter`. When adding a new action, check if there is an existing action provider for the type of action you are adding and add your new action to the appropriate folder.

Here's the structure of the action providers directory:

```
./typescript/agentkit/src
└── action-providers
    └── pyth
       ├── pythActionProvider.ts
       ├── schemas.ts
       └── pythActionProvider.test.ts
    └── ...
```

Once you decide which folder to add your action to, go ahead and create a new file there to house your action, then read through the following sections to learn how to implement your action. For a complete example of an action provider, see [erc721ActionProvider.ts](https://github.com/coinbase/agentkit/blob/master/typescript/agentkit/src/action-providers/erc721/erc721ActionProvider.ts).

### Crafting a good description prompt

The description prompt is used by the LLM to understand when and how to use the action. It's important to be as specific as possible in describing the inputs and outputs of the action and include examples. Take the Mint NFT prompt for example:

```typescript
// src/action-providers/erc721/erc721ActionProvider.ts

  @CreateAction({
    name: "mint",
    description: `
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    schema: MintSchema,
  })
```

- The prompt disambiguates the type of NFT by specifying "ERC-721"
- The prompt specifies that the destination address should not be the contract address
- The prompt specifies that the LLM should ask the user for the destination address if it is unsure
- Think about the best UX: if a contract address from a known list of addresses is required, you can instruct the LLM to use another action to get the list of addresses and prompt the user to choose an address from that list. For example, consider a DeFi action that allows a user to withdraw funds from a liquidity provider position. This action would take a contract address, so it would be valuable to have another action that can pull a list of addresses representing the user's positions. You can then instruct the LLM via the prompt to use that action in the case that no contract address is provided.

### Defining the input schema

The input schema is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs. For TypeScript, we use [Zod](https://zod.dev/) to define the input schema. For example, the Mint NFT input schema is defined as follows:

```typescript
// src/action-providers/erc721/schemas.ts

const MintSchema = z
  .object({
    contractAddress: z
      .string()
      .describe("The contract address of the NFT to mint"),
    destination: z
      .string()
      .describe("The destination address that will receive the NFT"),
  })
  .strip()
  .describe("Instructions for minting an NFT");
```

This says that the input schema has two fields: `contractAddress` and `destination`. The `contractAddress` field is required and must be a string. The `destination` field is required and must be a string. For more information on Zod, see the [Zod documentation](https://zod.dev/).

### Implementing the action provider

```typescript
// src/action-providers/erc721/erc721ActionProvider.ts

export class Erc721ActionProvider extends ActionProvider {
  constructor() {
    super("erc721", []);
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const erc721ActionProvider = () => new Erc721ActionProvider();
```

### Implementing the action

Now we need to implement the actual function that the AI will call when using your action. Actions are defined as instance methods on the action provider class with the `@CreateAction` decorator. The function receives as input the wallet provider that the Agent has access to, along with the inputs defined in the input schema, and it must return a string. This return value is used by the LLM to understand the result of the action, which in turn will generate a user-facing response. Here's an example of the Mint NFT implementation instance method:

```typescript
// src/action-providers/erc721/erc721ActionProvider.ts

export class Erc721ActionProvider extends ActionProvider {
  constructor() {
    super("erc721", []);
  }

  @CreateAction({
    name: "mint",
    description: `
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation. 
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs. 
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    schema: MintSchema,
  })
  async mint(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintSchema>
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: ERC721_ABI,
        functionName: "mint",
        args: [args.destination as Hex, 1n],
      });

      const hash = await walletProvider.sendTransaction({
        to: args.contractAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully minted NFT ${args.contractAddress} to ${args.destination}`;
    } catch (error) {
      return `Error minting NFT ${args.contractAddress} to ${args.destination}: ${error}`;
    }
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}
```

Notice the return value contains useful information for the user, such as the transaction hash and link. It's important to include this information in the return value so that the user can easily see the result of the action.

This class is then exported out of [typescript/agentkit/src/action-providers/erc721/index.ts](https://github.com/coinbase/agentkit/blob/master/typescript/agentkit/src/action-providers/erc721/index.ts) so that is consumable by users of the `@coinbase/agentkit` package.

### Testing the action provider

There are two forms of testing you should do: unit testing and manual end-to-end testing.

To add a unit test for your action provider, add a file to your action provider folder post-fixing it with `.test.ts`. For an example, see [pythActionProvider.test.ts](https://github.com/coinbase/agentkit/blob/master/typescript/agentkit/src/action-providers/pyth/pythActionProvider.test.ts).

You can then run the unit tests with the following command:

```bash
cd typescript/agentkit
pnpm test
```

Check out the [Testing](#testing) section to learn how to manually test your new action provider.

## Adding a Wallet Provider

Wallet providers give an agent access to a wallet. AgentKit currently supports the following wallet providers:

EVM:

- [CdpWalletProvider](https://github.com/coinbase/agentkit/blob/master/typescript/agentkit/src/wallet-providers/cdpWalletProvider.ts)
- [ViemWalletProvider](https://github.com/coinbase/agentkit/blob/master/typescript/agentkit/src/wallet-providers/viemWalletProvider.ts)

### Adding a new EVM wallet provider

The EVM Wallet Providers are housed in `typescript/agentkit/src/wallet-providers`. EVM Wallet Providers extend `EvmWalletProvider` which is an abstract class that conforms to [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193). To add a new EVM wallet provider, create a new file in the `wallet-providers` directory and implement a class that extends `EvmWalletProvider`.

### Adding a new non-EVM wallet provider

Non-EVM Wallet Providers are housed in `typescript/agentkit/src/wallet-providers`. Non-EVM Wallet Providers extend `WalletProvider` which is an abstract class that provides a core set of wallet functionality. To add a new non-EVM wallet provider, create a new file in the `wallet-providers` directory and implement a class that extends `WalletProvider`.

## Integrating into an AI Agent Framework

Actions are necessary building blocks powering onchain AI applications, but they're just one piece of the puzzle. To make them truly useful, they must be integrated into an AI Agent framework such as [LangChain](https://www.langchain.com/) or [Eliza](https://eliza.how/), among others.

Integrations into AI Agent frameworks are specific to the framework itself, so we can't go into specific implementation details here, but we can offer up some examples and tips.

- Check out how [AgentKit actions are mapped into LangChain Tools](https://github.com/coinbase/agentkit/blob/master/typescript/framework-extensions/langchain/src/index.ts)
- Check out how [AgentKit Actions are mapped into Eliza Actions](https://github.com/elizaOS/eliza/blob/develop/packages/plugin-agentkit/src/actions.ts#L31)

## Testing

### Local Testing

A good way to test new actions locally is by using the chatbot example in `typescript/examples/langchain-smart-wallet-chatbot`. See the [chatbot README](https://github.com/coinbase/agentkit/blob/master/typescript/examples/langchain-smart-wallet-chatbot/README.md) for instructions on setting up and running the chatbot.

The flow is:

1. Make your change as described in the [Adding an Agentic Action](#adding-an-agentic-action) section
2. From `typescript/`, run `pnpm i && pnpm build`
3. In `typescript/examples/langchain-smart-wallet-chatbot`, run `pnpm run start`
4. You can now interact with your new action via the chatbot!

### Running Tests

From the package you are working in, you can run:

```bash
pnpm test
```

For example, to run all tests in the `@coinbase/agentkit` package, you can run:

```bash
cd typescript/agentkit
pnpm test
```

## Code Style

We use ESLint and Prettier for linting and formatting. Run:

```bash
# Format code
pnpm run format

# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

## Documentation

The majority of our documentation exists within the AgentKit repo itself, in the form of colocated `README.md` files and inline docstrings. When adding new functionality or changing documented behavior, please update the relevant `README.md` file and inline docstrings to reflect the changes. For example, if you're adding a new action provider, also include a `README.md` in your new folder (see [the ERC20 Action Provider README](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/action-providers/erc20/README.md) as a reference). Or, if you're updating an existing action provider, update its `README.md` to reflect the changes. If it doesn't have a README, please add one! These are just a couple examples; docs exist throughout the codebase and most code changes will also require updates to the docs.

## Changelog

We use [changesets](https://github.com/changesets/changesets) to manage the changelog.

Changesets should be in the past tense, and they should be as specific as possible. Some examples of good changesets:

- Added a new action provider to interact with Fancy Protocol
- Fixed a bug preventing wallet balances to be formatted correctly

Changesets are stored in the `.changeset` directory. Each changeset is stored as a markdown file with a random name generated by `changesets`.

To add a changeset, use `changesets` to create it for you:

```bash
pnpm run changeset
```

This will kick off an interactive prompt to help you create the changeset. Use the arrow keys to navigate the different options, and press the `Space` key to select an option. You should select the package(s) you are making a change to – most of the time this will be `@coinbase/agentkit`. Once selected, hit `Enter`. You'll then be prompted to specify the type of change you are making (major, minor or patch), starting with major. Most of the time you will not be making a major change, so hitting `Enter` will progress to the next step. If you're adding a new feature, you should select `minor`. If you're fixing a bug, you should select `patch`. Once selected, you will be prompted to provide a summary of your changes. This should be a short, specific description in the past tense (see above for examples).

Once complete, a new changeset will be created in the `.changeset` directory, which should be committed along with the changes in your Pull Request.

For more info on adding changelog entries, [see here](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).
