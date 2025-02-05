# Agentkit

AgentKit is a framework for easily enabling AI agents to take actions onchain. It is designed to be framework-agnostic, so you can use it with any AI framework, and wallet-agnostic, so you can use it with any wallet.

## Table of Contents

- [Agentkit](#agentkit)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage](#usage)
  - [Create an AgentKit instance](##create-an-agentkit-instance-if-no-wallet-or-action-providers-are-specified-the-agent-will-use-the-cdpwalletprovider-and-walletprovider-action-provider)
  - [Create an AgentKit instance with a specified wallet provider](#create-an-agentkit-instance-with-a-specified-wallet-provider)
  - [Create an AgentKit instance with a specified action providers](#create-an-agentkit-instance-with-a-specified-action-providers)
  - [Use the agent's actions with a framework extension. For example, using LangChain + OpenAI](#use-the-agents-actions-with-a-framework-extension-for-example-using-langchain--openai)
- [Creating an Action Provider](#creating-an-action-provider)
  - [Adding Actions to your Action Provider](#adding-actions-to-your-action-provider)
  - [Adding Actions to your Action Provider that use a Wallet Provider](#adding-actions-to-your-action-provider-that-use-a-wallet-provider)
  - [Adding an Action Provider to your AgentKit instance](#adding-an-action-provider-to-your-agentkit-instance)
- [Wallet Providers](#wallet-providers)
  - [CdpWalletProvider](#cdpwalletprovider)
    - [Network Configuration](#network-configuration)
    - [Configuring from an existing CDP API Wallet](#configuring-from-an-existing-cdp-api-wallet)
    - [Configuring from a mnemonic phrase](#configuring-from-a-mnemonic-phrase)
    - [Exporting a wallet](#exporting-a-wallet)
    - [Importing a wallet from WalletData JSON string](#importing-a-wallet-from-walletdata-json-string)
  - [ViemWalletProvider](#viemwalletprovider)
- [Contributing](#contributing)

## Getting Started

*Prerequisites*:
- [Node.js 18+](https://nodejs.org/en/download/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)

## Installation

```bash
npm install @coinbase/agentkit
```

## Usage

### Create an AgentKit instance. If no wallet or action providers are specified, the agent will use the `CdpWalletProvider` and `WalletProvider` action provider.

```typescript
const agentKit = await AgentKit.from({
  cdpApiKeyName: "CDP API KEY NAME",
  cdpApiKeyPrivate: "CDP API KEY PRIVATE KEY",
});
```

### Create an AgentKit instance with a specified wallet provider.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY PRIVATE KEY",
    networkId: "base-mainnet",
});

const agentKit = await AgentKit.from({
    walletProvider,
});
```

### Create an AgentKit instance with a specified action providers.

```typescript
import { cdpApiActionProvider, pythActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [
        cdpApiActionProvider({
            apiKeyName: "CDP API KEY NAME",
            apiKeyPrivate: "CDP API KEY PRIVATE KEY",
        }),
        pythActionProvider(),
    ],
});
```

### Use the agent's actions with a framework extension. For example, using LangChain + OpenAI.

*Prerequisites*:
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)
- Set `OPENAI_API_KEY` environment variable.

```bash
npm install @langchain @langchain/langgraph @langchain/openai
```

```typescript
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const tools = await getLangChainTools(agentKit);

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
});

const agent = createReactAgent({
    llm,
    tools,
});
```

## Creating an Action Provider

Action providers are used to define the actions that an agent can take. They are defined as a class that extends the `ActionProvider` abstract class.

```typescript
import { ActionProvider, WalletProvider, Network } from "@coinbase/agentkit";

// Define an action provider that uses a wallet provider.
class MyActionProvider extends ActionProvider<WalletProvider> {
    constructor() {
        super("my-action-provider", []);
    }

    // Define if the action provider supports the given network
    supportsNetwork = (network: Network) => true;
}
```

### Adding Actions to your Action Provider

Actions are defined as instance methods on the action provider class with the `@CreateAction` decorator. Actions can use a wallet provider or not and always return a Promise that resolves to a string.

#### Required Typescript Compiler Options

Creating actions with the `@CreateAction` decorator requires the following compilerOptions to be included in your project's `tsconfig.json`.

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
} 
```

#### Steps to create an action

1. Define the action schema. Action schemas are defined using the `zod` library.

```typescript
import { z } from "zod";

export const MyActionSchema = z.object({
  myField: z.string(),
});
```

2. Define the action.

```typescript
import { ActionProvider, WalletProvider, Network, CreateAction } from "@coinbase/agentkit";

class MyActionProvider extends ActionProvider<WalletProvider> {
    constructor() {
        super("my-action-provider", []);
    }

    @CreateAction({
        name: "my-action",
        description: "My action description",
        schema: MyActionSchema,
    })
    async myAction(args: z.infer<typeof MyActionSchema>): Promise<string> {
        return args.myField;
    }

    supportsNetwork = (network: Network) => true;
}

export const myActionProvider = () => new MyActionProvider();
```

#### Adding Actions to your Action Provider that use a Wallet Provider

Actions that use a wallet provider can be defined as instance methods on the action provider class with the `@CreateAction` decorator that have a `WalletProvider` as the first parameter.

```typescript
class MyActionProvider extends ActionProvider<WalletProvider> {
    constructor() {
        super("my-action-provider", []);
    }

    @CreateAction({
        name: "my-action",
        description: "My action description",
        schema: MyActionSchema,
    })
    async myAction(walletProvider: WalletProvider, args: z.infer<typeof MyActionSchema>): Promise<string> {
        return walletProvider.signMessage(args.myField);
    }

    supportsNetwork = (network: Network) => true;
}
```

### Adding an Action Provider to your AgentKit instance. 

This gives your agent access to the actions defined in the action provider.

```typescript
const agentKit = new AgentKit({
  cdpApiKeyName: "CDP API KEY NAME",
  cdpApiKeyPrivate: "CDP API KEY PRIVATE KEY",
  actionProviders: [myActionProvider()],
});
```

## Wallet Providers

Wallet providers give an agent access to a wallet. AgentKit currently supports the following wallet providers:

EVM:
- [CdpWalletProvider](./src/wallet-providers/cdpWalletProvider.ts)
- [ViemWalletProvider](./src/wallet-providers/viemWalletProvider.ts)

### CdpWalletProvider

The `CdpWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) [API Wallet](https://docs.cdp.coinbase.com/wallet-api/docs/welcome).

#### Network Configuration

The `CdpWalletProvider` can be configured to use a specific network by passing the `networkId` parameter to the `configureWithWallet` method. The `networkId` is the ID of the network you want to use. You can find a list of [supported networks on the CDP API docs](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY PRIVATE KEY",
    networkId: "base-mainnet",
});
```

#### Configuring from an existing CDP API Wallet

If you already have a CDP API Wallet, you can configure the `CdpWalletProvider` by passing the `wallet` parameter to the `configureWithWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";
import { Wallet } from "@coinbase/coinbase-sdk";
const walletProvider = await CdpWalletProvider.configureWithWallet({
    wallet,
    apiKeyName: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY PRIVATE KEY",
});
```

#### Configuring from a mnemonic phrase

The `CdpWalletProvider` can be configured from a mnemonic phrase by passing the `mnemonicPhrase` parameter to the `configureWithWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    mnemonicPhrase: "MNEMONIC PHRASE",
});
```

#### Exporting a wallet

The `CdpWalletProvider` can export a wallet by calling the `exportWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    mnemonicPhrase: "MNEMONIC PHRASE",
});

const walletData = await walletProvider.exportWallet();
```

#### Importing a wallet from `WalletData` JSON string

The `CdpWalletProvider` can import a wallet from a `WalletData` JSON string by passing the `cdpWalletData` parameter to the `configureWithWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    cdpWalletData: "WALLET DATA JSON STRING",
    apiKeyName: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY PRIVATE KEY",
});
```

### ViemWalletProvider

The `ViemWalletProvider` is a wallet provider that uses the [Viem library](https://viem.sh/docs/getting-started). It is useful for interacting with any EVM-compatible chain.

```typescript
import { ViemWalletProvider } from "@coinbase/agentkit";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { http } from "viem/transports";
import { createWalletClient } from "viem";

const account = privateKeyToAccount(
  "0x4c0883a69102937d6231471b5dbb6208ffd70c02a813d7f2da1c54f2e3be9f38",
);

const client = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const walletProvider = new ViemWalletProvider(client);
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for more information.
