# Agentkit

AgentKit is a framework for easily enabling AI agents to take actions onchain. It is designed to be framework-agnostic, so you can use it with any AI framework, and wallet-agnostic, so you can use it with any wallet.

## Table of Contents

- [Agentkit](#agentkit)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage](#usage)
  - [Create an AgentKit instance](#create-an-agentkit-instance)
  - [Create an AgentKit instance with a specified wallet provider](#create-an-agentkit-instance-with-a-specified-wallet-provider)
  - [Create an AgentKit instance with a specified action providers](#create-an-agentkit-instance-with-a-specified-action-providers)
  - [Use the agent's actions with a framework extension. For example, using LangChain + OpenAI](#use-the-agents-actions-with-a-framework-extension-for-example-using-langchain--openai)
- [Action Providers](#action-providers)
- [Creating an Action Provider](#creating-an-action-provider)
  - [Adding Actions to your Action Provider](#adding-actions-to-your-action-provider)
  - [Adding Actions to your Action Provider that use a Wallet Provider](#adding-actions-to-your-action-provider-that-use-a-wallet-provider)
  - [Adding an Action Provider to your AgentKit instance](#adding-an-action-provider-to-your-agentkit-instance)
- [EVM Wallet Providers](#evm-wallet-providers)
  - [CdpV2EvmWalletProvider](#cdpv2evmwalletprovider)
  - [CdpWalletProvider](#cdpwalletprovider)
    - [Network Configuration](#network-configuration)
    - [Configuring from an existing CDP API Wallet](#configuring-from-an-existing-cdp-api-wallet)
    - [Configuring from a mnemonic phrase](#configuring-from-a-mnemonic-phrase)
    - [Exporting a wallet](#exporting-a-wallet)
    - [Importing a wallet from WalletData JSON string](#importing-a-wallet-from-walletdata-json-string)
    - [Configuring gas parameters](#configuring-cdpwalletprovider-gas-parameters)
  - [ViemWalletProvider](#viemwalletprovider)
    - [Configuring gas parameters](#configuring-viemwalletprovider-gas-parameters)
  - [PrivyWalletProvider](#privywalletprovider)
    - [Authorization Keys](#authorization-keys)
    - [Exporting Privy Wallet information](#exporting-privy-wallet-information)
  - [SmartWalletProvider](#smartwalletprovider)
  - [ZeroDevWalletProvider](#zerodevwalletprovider)
    - [Configuring from CdpWalletProvider](#configuring-from-cdpwalletprovider)
    - [Configuring from PrivyWalletProvider](#configuring-from-privywalletprovider)
    - [Configuring from ViemWalletProvider](#configuring-from-viemwalletprovider)
- [SVM Wallet Providers](#svm-wallet-providers)
  - [CdpV2SolanaWalletProvider](#cdpv2solanawalletprovider)
  - [SolanaKeypairWalletProvider](#solanakeypairwalletprovider)
    - [Network Configuration](#solana-network-configuration)
    - [RPC URL Configuration](#rpc-url-configuration)
  - [PrivyWalletProvider](#privywalletprovider-solana)
    - [Connection Configuration](#connection-configuration)
    - [Authorization Keys](#authorization-keys)
    - [Exporting Privy Wallet information](#exporting-privy-wallet-information)
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
  cdpApiKeyId: "CDP API KEY NAME",
  cdpApiKeyPrivate: "CDP API KEY SECRET",
});
```

### Create an AgentKit instance

If no wallet or action provider are specified, the agent will use the `CdpWalletProvider` and `WalletActionProvider` action provider by default.

```typescript
const agentKit = await AgentKit.from({
  cdpApiKeyId: "CDP API KEY NAME",
  cdpApiKeyPrivate: "CDP API KEY SECRET",
});
```

### Create an AgentKit instance with a specified wallet provider.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
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
            apiKeyId: "CDP API KEY NAME",
            apiKeyPrivate: "CDP API KEY SECRET",
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

## Action Providers
<details>
<summary><strong>Across</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>bridge_token</code></td>
    <td width="768">Bridges tokens between supported chains using Across Protocol.</td>
</tr>
<tr>
    <td width="200"><code>check_deposit_status</code></td>
    <td width="768">Checks the status of a cross-chain bridge deposit on the Across Protocol (mainnet networks only).</td>
</tr>
</table>
</details>
<details>
<summary><strong>Basename</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>register_basename</code></td>
    <td width="768">Registers a custom .base.eth or .basetest.eth domain name for the wallet address.</td>
</tr>
</table>
</details>
<details>
<summary><strong>CDP Wallet</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>deploy_contract</code></td>
    <td width="768">Deploys a custom smart contract using specified Solidity version and constructor arguments.</td>
</tr>
<tr>
    <td width="200"><code>deploy_nft</code></td>
    <td width="768">Deploys a standard ERC-721 NFT contract with configurable name, symbol, and metadata URI.</td>
</tr>
<tr>
    <td width="200"><code>deploy_token</code></td>
    <td width="768">Deploys a standard ERC-20 token contract with configurable name, symbol, and initial supply.</td>
</tr>
<tr>
    <td width="200"><code>trade</code></td>
    <td width="768">Executes a token swap between two assets at current market rates on mainnet networks.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Compound</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>supply</code></td>
    <td width="768">Supplies collateral assets (WETH, CBETH, CBBTC, WSTETH, or USDC) to Compound.</td>
</tr>
<tr>
    <td width="200"><code>withdraw</code></td>
    <td width="768">Withdraws previously supplied collateral assets from Compound.</td>
</tr>
<tr>
    <td width="200"><code>borrow</code></td>
    <td width="768">Borrows base assets (WETH or USDC) from Compound using supplied collateral.</td>
</tr>
<tr>
    <td width="200"><code>repay</code></td>
    <td width="768">Repays borrowed assets back to Compound.</td>
</tr>
<tr>
    <td width="200"><code>get_portfolio</code></td>
    <td width="768">Retrieves portfolio details including collateral balances and borrowed amounts.</td>
</tr>
</table>
</details>
<details>
<summary><strong>DefiLlama</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>find_protocol</code></td>
    <td width="768">Searches for DeFi protocols on DefiLlama by name, returning protocol metadata including TVL, chain, and category.</td>
</tr>
<tr>
    <td width="200"><code>get_protocol</code></td>
    <td width="768">Fetches detailed information about a specific protocol from DefiLlama, including TVL, description, and historical data.</td>
</tr>
<tr>
    <td width="200"><code>get_token_prices</code></td>
    <td width="768">Fetches current token prices from DefiLlama for specified token addresses with chain prefixes.</td>
</tr>
</table>
</details>
<details>
<summary><strong>ERC20</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>get_balance</code></td>
    <td width="768">Retrieves the token balance for a specified address and ERC-20 contract.</td>
</tr>
<tr>
    <td width="200"><code>transfer</code></td>
    <td width="768">Transfers a specified amount of ERC-20 tokens to a destination address.</td>
</tr>
</table>
</details>
<details>
<summary><strong>ERC721</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>get_balance</code></td>
    <td width="768">Retrieves the NFT balance for a specified address and ERC-721 contract.</td>
</tr>
<tr>
    <td width="200"><code>mint</code></td>
    <td width="768">Creates a new NFT token and assigns it to a specified destination address.</td>
</tr>
<tr>
    <td width="200"><code>transfer</code></td>
    <td width="768">Transfers ownership of a specific NFT token to a destination address.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Farcaster</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>account_details</code></td>
    <td width="768">Fetches profile information and metadata for the authenticated Farcaster account.</td>
</tr>
<tr>
    <td width="200"><code>post_cast</code></td>
    <td width="768">Creates a new cast (message) on Farcaster with up to 280 characters.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Flaunch</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>flaunch</code></td>
    <td width="768">Launches a new memecoin token with customizable name, symbol, image, and metadata.</td>
</tr>
<tr>
    <td width="200"><code>buyCoinWithETHInput</code></td>
    <td width="768">Purchases Flaunch memecoin tokens by specifying ETH input amount with configurable slippage.</td>
</tr>
<tr>
    <td width="200"><code>buyCoinWithCoinInput</code></td>
    <td width="768">Purchases Flaunch memecoin tokens by specifying desired token output amount with configurable slippage.</td>
</tr>
<tr>
    <td width="200"><code>sellCoin</code></td>
    <td width="768">Sells Flaunch memecoin tokens back to ETH with configurable slippage.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Messari</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>research_question</code></td>
    <td width="768">Queries Messari AI for comprehensive crypto research across news, market data, protocol information, and more.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Morpho</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>deposit</code></td>
    <td width="768">Deposits a specified amount of assets into a designated Morpho Vault.</td>
</tr>
<tr>
    <td width="200"><code>withdraw</code></td>
    <td width="768">Withdraws a specified amount of assets from a designated Morpho Vault.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Onramp</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>get_onramp_buy_url</code></td>
    <td width="768">Gets a URL to purchase cryptocurrency from Coinbase via Debit card or other payment methods.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Opensea</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>list_nft</code></td>
    <td width="768">Lists an NFT for sale on OpenSea.</td>
</tr>
<tr>
    <td width="200"><code>get_nfts_by_account</code></td>
    <td width="768">Fetches NFTs owned by a specific wallet address on OpenSea.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Pyth</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>fetch_price</code></td>
    <td width="768">Retrieves current price data from a specified Pyth price feed.</td>
</tr>
<tr>
    <td width="200"><code>fetch_price_feed_id</code></td>
    <td width="768">Retrieves the unique price feed identifier for a given token symbol.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Twitter</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>account_details</code></td>
    <td width="768">Fetches profile information and metadata for the authenticated Twitter account.</td>
</tr>
<tr>
    <td width="200"><code>account_mentions</code></td>
    <td width="768">Retrieves recent mentions and interactions for the authenticated account.</td>
</tr>
<tr>
    <td width="200"><code>post_tweet</code></td>
    <td width="768">Creates a new tweet on the authenticated Twitter account.</td>
</tr>
<tr>
    <td width="200"><code>post_tweet_reply</code></td>
    <td width="768">Creates a reply to an existing tweet using the tweet's unique identifier.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Wallet</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>get_wallet_details</code></td>
    <td width="768">Retrieves wallet address, network info, balances, and provider details.</td>
</tr>
<tr>
    <td width="200"><code>native_transfer</code></td>
    <td width="768">Transfers native blockchain tokens (e.g., ETH) to a destination address.</td>
</tr>
</table>
</details>
<details>
<summary><strong>WETH</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>wrap_eth</code></td>
    <td width="768">Converts native ETH to Wrapped ETH (WETH) on Base Sepolia or Base Mainnet.</td>
</tr>
</table>
</details>
<details>
<summary><strong>WOW</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>buy_token</code></td>
    <td width="768">Purchases WOW tokens from a contract using ETH based on bonding curve pricing.</td>
</tr>
<tr>
    <td width="200"><code>create_token</code></td>
    <td width="768">Creates a new WOW memecoin with bonding curve functionality via Zora factory.</td>
</tr>
<tr>
    <td width="200"><code>sell_token</code></td>
    <td width="768">Sells WOW tokens back to the contract for ETH based on bonding curve pricing.</td>
</tr>
</table>
</details>
<details>
<summary><strong>Jupiter</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>swap</code></td>
    <td width="768">Swap tokens on Solana using the Jupiter DEX aggregator.</td>
</tr>
</table>
</details>
<details>
<summary><strong>X402</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>paid_request</code></td>
    <td width="768">Makes HTTP requests to x402-protected API endpoints with automatic payment handling.</td>
</tr>
<tr>
    <td width="200"><code>fetch_payment_info</code></td>
    <td width="768">Fetches payment information from x402-protected endpoints without making payments.</td>
</tr>
</table>
</details>
<details>
<summary><strong>ZeroDev Wallet</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>getCAB</code></td>
    <td width="768">Retrieves chain abstracted balances (CAB) for specified tokens across multiple networks.</td>
</tr>
</table>
</details>

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
  cdpApiKeyId: "CDP API KEY NAME",
  cdpApiKeyPrivate: "CDP API KEY SECRET",
  actionProviders: [myActionProvider()],
});
```

## EVM Wallet Providers

Wallet providers give an agent access to a wallet. AgentKit currently supports the following wallet providers:

EVM:
- [CdpV2EvmWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/cdpV2EvmWalletProvider.ts)
- [CdpWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/cdpWalletProvider.ts)
- [ViemWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/viemWalletProvider.ts)
- [PrivyWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/privyWalletProvider.ts)
- [ZeroDevWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/zeroDevWalletProvider.ts)

### CdpV2EvmWalletProvider

The `CdpV2EvmWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) V2 API. It provides a more modern and streamlined interface for interacting with CDP wallets.

#### Basic Configuration

```typescript
import { CdpV2EvmWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2EvmWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    networkId: "base-sepolia", // Optional, defaults to "base-sepolia"
});
```

#### Using an Existing Wallet

You can configure the provider with an existing wallet by providing the wallet's address:

```typescript
import { CdpV2EvmWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2EvmWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    address: "0x...", // The address of an existing wallet
    networkId: "base-sepolia",
});
```

#### Creating a New Wallet

To create a new wallet, you can provide an idempotency key. The same idempotency key will always generate the same wallet address, and these keys are valid for 24 hours:

```typescript
import { CdpV2EvmWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2EvmWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    idempotencyKey: "unique-key-123", // Optional, if not provided a new wallet will be created
    networkId: "base-sepolia",
});
```

#### Environment Variables

The provider can also be configured using environment variables:

```typescript
// Environment variables:
// CDP_API_KEY_ID=your_api_key_id
// CDP_API_KEY_SECRET=your_api_key_secret
// CDP_WALLET_SECRET=your_wallet_secret
// NETWORK_ID=base-sepolia (optional)
// IDEMPOTENCY_KEY=unique-key-123 (optional)

const walletProvider = await CdpV2EvmWalletProvider.configureWithWallet();
```

### CdpWalletProvider

The `CdpWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) [API Wallet](https://docs.cdp.coinbase.com/wallet-api/docs/welcome).

#### Network Configuration

The `CdpWalletProvider` can be configured to use a specific network by passing the `networkId` parameter to the `configureWithWallet` method. The `networkId` is the ID of the network you want to use. You can find a list of [supported networks on the CDP API docs](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
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
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
});
```

#### Configuring from a mnemonic phrase

The `CdpWalletProvider` can be configured from a mnemonic phrase by passing the `mnemonicPhrase` and `networkId` parameters to the `configureWithWallet` method. If `networkId` is not defined, the `CdpWalletProvider` will fall back to the env var `NETWORK_ID`, and if that is not defined, it will default to `base-sepolia`.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    mnemonicPhrase: "MNEMONIC PHRASE",
    networkId: "base-sepolia",
});
```

#### Exporting a wallet

The `CdpWalletProvider` can export a wallet by calling the `exportWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    mnemonicPhrase: "MNEMONIC PHRASE",
    networkId: "base-sepolia",
});

const walletData = await walletProvider.exportWallet();
```

#### Importing a wallet from `WalletData` JSON string

The `CdpWalletProvider` can import a wallet from a `WalletData` JSON string by passing the `cdpWalletData` parameter to the `configureWithWallet` method.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    cdpWalletData: "WALLET DATA JSON STRING",
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
});
```

#### Configuring CdpWalletProvider gas parameters

The `CdpWalletProvider` also exposes parameters for effecting the gas calculations.

```typescript
import { CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
    cdpWalletData: "WALLET DATA JSON STRING",
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
    gas: {
        gasLimitMultiplier: 2.0,  // Adjusts gas limit estimation
        feePerGasMultiplier: 2.0, // Adjusts max fee per gas
    }
});
```

**Note**: Gas parameters only impact the `walletProvider.sendTransaction` behavior. Actions that do not rely on direct transaction calls, such as `deploy_token`, `deploy_contract`, and `native_transfer`, remain unaffected.


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

#### Configuring ViemWalletProvider gas parameters

The `ViemWalletProvider` also exposes parameters for effecting the gas calculations.

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

const walletProvider = new ViemWalletProvider(client, {
    gasLimitMultiplier: 2.0,  // Adjusts gas limit estimation
    feePerGasMultiplier: 2.0, // Adjusts max fee per gas
});
```

### PrivyWalletProvider

The `PrivyWalletProvider` is a wallet provider that uses [Privy Server Wallets](https://docs.privy.io/guide/server-wallets/) or [Privy Embedded Wallets](https://docs.privy.io/guide/embedded-wallets/). This implementation extends the `EvmWalletProvider`.

#### Server Wallet Configuration

```typescript
import { PrivyWalletProvider } from "@coinbase/agentkit";

// Configure Server Wallet Provider
const config = {
    appId: "PRIVY_APP_ID",
    appSecret: "PRIVY_APP_SECRET",
    chainId: "84532", // base-sepolia
    walletId: "PRIVY_WALLET_ID", // optional, otherwise a new wallet will be created
    authorizationPrivateKey: "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY", // optional, required if your account is using authorization keys
    authorizationKeyId: "PRIVY_WALLET_AUTHORIZATION_KEY_ID", // optional, only required to create a new wallet if walletId is not provided
};

const walletProvider = await PrivyWalletProvider.configureWithWallet(config);
```

#### Delegated Embedded Wallet Configuration

You can also use Privy's embedded wallets with delegation for agent actions. This allows your agent to use wallets that have been delegated transaction signing authority by users.

```typescript
import { PrivyWalletProvider } from "@coinbase/agentkit";

// Configure Embedded Wallet Provider
const config = {
    appId: "PRIVY_APP_ID",
    appSecret: "PRIVY_APP_SECRET",
    authorizationPrivateKey: "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
    walletId: "PRIVY_DELEGATED_WALLET_ID", // The ID of the wallet that was delegated to your server
    networkId: "base-mainnet", // or any supported network
    walletType: "embedded" // Specify "embedded" to use the embedded wallet provider
};

const walletProvider = await PrivyWalletProvider.configureWithWallet(config);
```

### Prerequisites

Before using this wallet provider, you need to:

1. Set up Privy in your application
2. Enable server delegated actions
3. Have users delegate permissions to your server
4. Obtain the delegated wallet ID

For more information on setting up Privy and enabling delegated actions, see [Privy's documentation](https://docs.privy.io/guide/embedded/server-delegated-actions).

### Supported Operations

The `PrivyEvmDelegatedEmbeddedWalletProvider` supports all standard wallet operations including transaction signing, message signing, and native transfers, using the wallet that was delegated to your server.

#### Authorization Keys

Privy offers the option to use authorization keys to secure your server wallets.

You can manage authorization keys from your [Privy dashboard](https://dashboard.privy.io/account).

When using authorization keys, you must provide the `authorizationPrivateKey` and `authorizationKeyId` parameters to the `configureWithWallet` method if you are creating a new wallet. Please note that when creating a key, if you enable "Create and modify wallets", you will be required to use that key when creating new wallets via the PrivyWalletProvider.

#### Exporting Privy Wallet information

The `PrivyWalletProvider` can export wallet information by calling the `exportWallet` method. 

```typescript
const walletData = await walletProvider.exportWallet();

// For server wallets, walletData will be in the following format:
{
    walletId: string;
    authorizationKey: string | undefined;
    chainId: string | undefined;
}

// For embedded wallets, walletData will be in the following format:
{
    walletId: string;
    networkId: string;
    chainId: string | undefined;
}
```

### SmartWalletProvider

The `SmartWalletProvider` is a wallet provider that uses [CDP Smart Wallets](https://docs.cdp.coinbase.com/wallet-api/docs/smart-wallets).

```typescript
import { SmartWalletProvider, SmartWalletConfig } from "@coinbase/agentkit";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const networkId = process.env.NETWORK_ID || "base-sepolia";

const privateKey = process.env.PRIVATE_KEY || generatePrivateKey();
const signer = privateKeyToAccount(privateKey);

// Configure Wallet Provider
const walletProvider = await SmartWalletProvider.configureWithWallet({
  networkId,
  signer,
  smartWalletAddress: undefined, // If not provided a new smart wallet will be created
  paymasterUrl: undefined, // Sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
});
```

### ZeroDevWalletProvider

The `ZeroDevWalletProvider` is a wallet provider that uses [ZeroDev](https://docs.zerodev.app/) smart accounts.  It supports features like chain abstraction, gasless transactions, batched transactions, and more.

In the context of Agent Kit, "chain abstraction" means that the agent can spend funds across chains without explicitly bridging.  For example, if you send funds to the agent's address on Base, the agent will be able to spend the funds on any supported EVM chains such as Arbitrum and Optimism.

The ZeroDev wallet provider does not itself manage keys.  Rather, it can be used with any EVM wallet provider (e.g. CDP/Privy/Viem) which serves as the "signer" for the ZeroDev smart account.

#### Configuring from CdpWalletProvider

```typescript
import { ZeroDevWalletProvider, CdpWalletProvider } from "@coinbase/agentkit";

// First create a CDP wallet provider as the signer
const cdpWalletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyId: "CDP API KEY NAME",
    apiKeyPrivate: "CDP API KEY SECRET",
    networkId: "base-mainnet",
});

// Configure ZeroDev Wallet Provider with CDP signer
const walletProvider = await ZeroDevWalletProvider.configureWithWallet({
    signer: cdpWalletProvider.toSigner(),
    projectId: "ZERODEV_PROJECT_ID",
    entryPointVersion: "0.7" as const,
    networkId: "base-mainnet",
});
```

#### Configuring from PrivyWalletProvider

```typescript
import { ZeroDevWalletProvider, PrivyWalletProvider } from "@coinbase/agentkit";

// First create a Privy wallet provider as the signer
const privyWalletProvider = await PrivyWalletProvider.configureWithWallet({
    appId: "PRIVY_APP_ID",
    appSecret: "PRIVY_APP_SECRET",
    chainId: "8453", // base-mainnet
});

// Configure ZeroDev Wallet Provider with Privy signer
const walletProvider = await ZeroDevWalletProvider.configureWithWallet({
    signer: privyWalletProvider.toSigner(),
    projectId: "ZERODEV_PROJECT_ID",
    entryPointVersion: "0.7" as const,
    networkId: "base-mainnet",
});
```

#### Configuring from ViemWalletProvider

```typescript
import { ZeroDevWalletProvider, ViemWalletProvider } from "@coinbase/agentkit";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createWalletClient, http } from "viem";

// First create a Viem wallet provider as the signer
const account = privateKeyToAccount("PRIVATE_KEY");

const viemWalletProvider = new ViemWalletProvider(
  createWalletClient({
    account,
    chain: base,
    transport: http(),
  })
);

// Configure ZeroDev Wallet Provider with Viem signer
const walletProvider = await ZeroDevWalletProvider.configureWithWallet({
    signer: viemWalletProvider.toSigner(),
    projectId: "ZERODEV_PROJECT_ID",
    entryPointVersion: "0.7" as const,
    networkId: "base-mainnet",
});
```

## SVM Wallet Providers

Wallet providers give an agent access to a wallet. AgentKit currently supports the following wallet providers:

SVM:
- [CdpV2SolanaWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/cdpV2SolanaWalletProvider.ts)
- [SolanaKeypairWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/solanaKeypairWalletProvider.ts)
- [PrivyWalletProvider](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers/privySvmWalletProvider.ts)

### CdpV2SolanaWalletProvider

The `CdpV2SolanaWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) V2 API for Solana. It provides a more modern and streamlined interface for interacting with CDP wallets on the Solana network.

#### Basic Configuration

```typescript
import { CdpV2SolanaWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2SolanaWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    networkId: "solana-devnet", // Optional, defaults to "solana-devnet"
});
```

#### Using an Existing Wallet

You can configure the provider with an existing wallet by providing the wallet's address:

```typescript
import { CdpV2SolanaWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2SolanaWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    address: "your-solana-address", // The address of an existing wallet
    networkId: "solana-devnet",
});
```

#### Creating a New Wallet

To create a new wallet, you can provide an idempotency key. The same idempotency key will always generate the same wallet address, and these keys are valid for 24 hours:

```typescript
import { CdpV2SolanaWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpV2SolanaWalletProvider.configureWithWallet({
    apiKeyId: "CDP_API_KEY_ID",
    apiKeySecret: "CDP_API_KEY_SECRET",
    walletSecret: "CDP_WALLET_SECRET",
    idempotencyKey: "unique-key-123", // Optional, if not provided a new wallet will be created
    networkId: "solana-devnet",
});
```

#### Environment Variables

The provider can also be configured using environment variables:

```typescript
// Environment variables:
// CDP_API_KEY_ID=your_api_key_id
// CDP_API_KEY_SECRET=your_api_key_secret
// CDP_WALLET_SECRET=your_wallet_secret
// NETWORK_ID=solana-devnet (optional)
// IDEMPOTENCY_KEY=unique-key-123 (optional)

const walletProvider = await CdpV2SolanaWalletProvider.configureWithWallet();
```

#### Supported Networks

The `CdpV2SolanaWalletProvider` supports the following Solana networks:
- `solana-mainnet`
- `solana-devnet`
- `solana-testnet`

### SolanaKeypairWalletProvider

The `SolanaKeypairWalletProvider` is a wallet provider that uses the API [Solana web3.js](https://solana.com/docs/clients/javascript).

NOTE: It is highly recommended to use a dedicated RPC provider. See [here](https://solana.com/rpc) for more info on Solana RPC infrastructure, and see [here](#rpc-url-configuration) for instructions on configuring `SolanaKeypairWalletProvider` with a custom RPC URL.

#### Solana Network Configuration

The `SolanaKeypairWalletProvider` can be configured to use a specific network by passing the `networkId` parameter to the `fromNetwork` method. The `networkId` is the ID of the Solana network you want to use. Valid values are `solana-mainnet`, `solana-devnet` and `solana-testnet`.

The default RPC endpoints for each network are as follows:
- `solana-mainnet`: `https://api.mainnet-beta.solana.com`
- `solana-devnet`: `https://api.devnet.solana.com`
- `solana-testnet`: `https://api.testnet.solana.com`

```typescript
import { SOLANA_NETWORK_ID, SolanaKeypairWalletProvider } from "@coinbase/agentkit";

// Configure Solana Keypair Wallet Provider
const privateKey = process.env.SOLANA_PRIVATE_KEY;
const network = process.env.NETWORK_ID as SOLANA_NETWORK_ID;
const walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, privateKey);
```

#### RPC URL Configuration

The `SolanaKeypairWalletProvider` can be configured to use a specific RPC url by passing the `rpcUrl` parameter to the `fromRpcUrl` method. The `rpcUrl` will determine the network you are using.

```typescript
import { SOLANA_NETWORK_ID, SolanaKeypairWalletProvider } from "@coinbase/agentkit";

// Configure Solana Keypair Wallet Provider
const privateKey = process.env.SOLANA_PRIVATE_KEY;
const rpcUrl = process.env.SOLANA_RPC_URL;
const walletProvider = await SolanaKeypairWalletProvider.fromRpcUrl(network, privateKey);
```

### PrivyWalletProvider (Solana)

The `PrivyWalletProvider` is a wallet provider that uses [Privy Server Wallets](https://docs.privy.io/guide/server-wallets/).

NOTE: It is highly recommended to use a dedicated RPC provider. See [here](https://solana.com/rpc) for more info on Solana RPC infrastructure, and see [here](#connection-configuration) for instructions on configuring `PrivyWalletProvider` with a custom RPC URL.

```typescript
import { PrivyWalletProvider, PrivyWalletConfig } from "@coinbase/agentkit";

// Configure Wallet Provider
const config: PrivyWalletConfig = {
    appId: "PRIVY_APP_ID",
    appSecret: "PRIVY_APP_SECRET",
    connection,
    chainType: "solana", // optional, defaults to "evm". Make sure to set this to "solana" if you want to use Solana!
    networkId: "solana-devnet", // optional, defaults to "solana-devnet"
    walletId: "PRIVY_WALLET_ID", // optional, otherwise a new wallet will be created
    authorizationPrivateKey: PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY, // optional, required if your account is using authorization keys
    authorizationKeyId: PRIVY_WALLET_AUTHORIZATION_KEY_ID, // optional, only required to create a new wallet if walletId is not provided
};

const walletProvider = await PrivyWalletProvider.configureWithWallet(config);
```

#### Connection Configuration

Optionally, you can configure your own `@solana/web3.js` connection by passing the `connection` parameter to the `configureWithWallet` method.

```typescript
import { PrivyWalletProvider, PrivyWalletConfig } from "@coinbase/agentkit";

const connection = new Connection("YOUR_RPC_URL");

// Configure Wallet Provider
const config: PrivyWalletConfig = {
    appId: "PRIVY_APP_ID",
    appSecret: "PRIVY_APP_SECRET",
    connection,
    chainType: "solana", // optional, defaults to "evm". Make sure to set this to "solana" if you want to use Solana!
    networkId: "solana-devnet", // optional, defaults to "solana-devnet"
    walletId: "PRIVY_WALLET_ID", // optional, otherwise a new wallet will be created
    authorizationPrivateKey: PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY, // optional, required if your account is using authorization keys
    authorizationKeyId: PRIVY_WALLET_AUTHORIZATION_KEY_ID, // optional, only required to create a new wallet if walletId is not provided
};

const walletProvider = await PrivyWalletProvider.configureWithWallet(config);
```

#### Authorization Keys

Privy offers the option to use authorization keys to secure your server wallets.

You can manage authorization keys from your [Privy dashboard](https://dashboard.privy.io/account).

When using authorization keys, you must provide the `authorizationPrivateKey` and `authorizationKeyId` parameters to the `configureWithWallet` method if you are creating a new wallet. Please note that when creating a key, if you enable "Create and modify wallets", you will be required to use that key when creating new wallets via the PrivyWalletProvider.

#### Exporting Privy Wallet information

The `PrivyWalletProvider` can export wallet information by calling the `exportWallet` method.

```typescript
const walletData = await walletProvider.exportWallet();

// walletData will be in the following format:
{
    walletId: string;
    authorizationKey: string | undefined;
    networkId: string | undefined;
}
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for more information.
