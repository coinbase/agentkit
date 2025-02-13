# AgentKit

AgentKit is a framework for easily enabling AI agents to take actions onchain. It is designed to be framework-agnostic, so you can use it with any AI framework, and wallet-agnostic, so you can use it with any wallet.

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage](#usage)
  - [Create an AgentKit instance](#create-an-agentkit-instance)
  - [Create an AgentKit instance with a specified wallet provider](#create-an-agentkit-instance-with-a-specified-wallet-provider)
  - [Create an AgentKit instance with specified action providers](#create-an-agentkit-instance-with-specified-action-providers)
  - [Use with a framework extension (e.g., LangChain + OpenAI)](#use-with-a-framework-extension)
- [Creating an Action Provider](#creating-an-action-provider)
  - [Adding Actions to your Action Provider](#adding-actions-to-your-action-provider)
  - [Adding Actions that use a Wallet Provider](#adding-actions-that-use-a-wallet-provider)
  - [Adding an Action Provider to your AgentKit instance](#adding-an-action-provider-to-your-agentkit-instance)
- [Wallet Providers](#wallet-providers)
  - [CdpWalletProvider](#cdpwalletprovider)
    - [Network Configuration](#network-configuration)
    - [Configuring from an existing CDP API Wallet](#configuring-from-an-existing-cdp-api-wallet)
    - [Configuring from a mnemonic phrase](#configuring-from-a-mnemonic-phrase)
    - [Exporting a wallet](#exporting-a-wallet)
    - [Importing a wallet from WalletData JSON string](#importing-a-wallet-from-walletdata-json-string)
  - [EthAccountWalletProvider](#ethaccountwalletprovider)
- [Contributing](#contributing)

## Getting Started

*Prerequisites*:
- [Python 3.10+](https://www.python.org/downloads/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)

## Installation

```bash
pip install coinbase-agentkit
```

## Usage

### Create an AgentKit instance

If no wallet or action providers are specified, the agent will use the `CdpWalletProvider` and `WalletActionProvider` action provider by default.

```python
from coinbase_agentkit import AgentKit, AgentKitConfig

agent_kit = AgentKit()
```

### Create an AgentKit instance with a specified wallet provider

```python
from coinbase_agentkit import (
    AgentKit, 
    AgentKitConfig, 
    CdpWalletProvider, 
    CdpWalletProviderConfig
)

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    api_key_name="CDP API KEY NAME",
    api_key_private="CDP API KEY PRIVATE KEY",
    network_id="base-mainnet"
))

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

### Create an AgentKit instance with specified action providers

```python
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    cdp_api_action_provider,
    pyth_action_provider
)

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[
        cdp_api_action_provider(
            api_key_name="CDP API KEY NAME",
            api_key_private="CDP API KEY PRIVATE KEY"
        ),
        pyth_action_provider()
    ]
))
```

### Use with a framework extension

Example using LangChain + OpenAI:

*Prerequisites*:
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)
- Set `OPENAI_API_KEY` environment variable

```bash
poetry add coinbase-agentkit-langchain langchain-openai langgraph
```

```python
from coinbase_agentkit_langchain import get_langchain_tools
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

tools = get_langchain_tools(agent_kit)

llm = ChatOpenAI(model="gpt-4")

agent = create_react_agent(
    llm=llm,
    tools=tools
)
```

## Creating an Action Provider

Action providers define the actions that an agent can take. They are created by subclassing the `ActionProvider` abstract class.

```python
from coinbase_agentkit import ActionProvider, WalletProvider, Network

class MyActionProvider(ActionProvider[WalletProvider]):
    def __init__(self):
        super().__init__("my-action-provider", [])
    
    # Define if the action provider supports the given network
    def supports_network(self, network: Network) -> bool:
        return True
```

### Adding Actions to your Action Provider

Actions are defined using the `@create_action` decorator. They can optionally use a wallet provider and must return a string.

1. Define the action schema using Pydantic:

```python
from pydantic import BaseModel

class MyActionSchema(BaseModel):
    my_field: str
```

2. Define the action:

```python
from coinbase_agentkit import ActionProvider, WalletProvider, Network, create_action

class MyActionProvider(ActionProvider[WalletProvider]):
    def __init__(self):
        super().__init__("my-action-provider", [])

    @create_action(
        name="my-action",
        description="My action description",
        schema=MyActionSchema
    )
    def my_action(self, args: dict[str, Any]) -> str:
        return args["my_field"]

    def supports_network(self, network: Network) -> bool:
        return True

def my_action_provider():
    return MyActionProvider()
```

### Adding Actions that use a Wallet Provider

Actions that need access to a wallet provider can include it as their first parameter:

```python
from coinbase_agentkit import ActionProvider, WalletProvider, create_action

class MyActionProvider(ActionProvider[WalletProvider]):
    @create_action(
        name="my-action",
        description="My action description",
        schema=MyActionSchema
    )
    def my_action(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        return wallet_provider.sign_message(args["my_field"])
```

### Adding an Action Provider to your AgentKit instance

```python
agent_kit = AgentKit(AgentKitConfig(
    cdp_api_key_name="CDP API KEY NAME",
    cdp_api_key_private="CDP API KEY PRIVATE KEY",
    action_providers=[my_action_provider()]
))
```

## Wallet Providers

AgentKit supports the following wallet providers:

EVM:
- [CdpWalletProvider](https://github.com/coinbase/agentkit/blob/master/python/coinbase_agentkit/wallet_providers/cdp_wallet_provider.py) - Uses the Coinbase Developer Platform (CDP) API Wallet
- [EthAccountWalletProvider](https://github.com/coinbase/agentkit/blob/master/python/coinbase_agentkit/wallet_providers/eth_account_wallet_provider.py) - Uses a local private key for any EVM-compatible chain

### CdpWalletProvider

The `CdpWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) [API Wallet](https://docs.cdp.coinbase.com/wallet-api/docs/welcome).

#### Network Configuration

The `CdpWalletProvider` can be configured to use a specific network by passing the `network_id` parameter to the `CdpWalletProviderConfig`. The `network_id` is the ID of the network you want to use. You can find a list of [supported networks on the CDP API docs](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    api_key_name="CDP API KEY NAME",
    api_key_private="CDP API KEY PRIVATE KEY",
    network_id="base-mainnet",
))
```

#### Configuring from an existing CDP API Wallet

If you already have a CDP API Wallet, you can configure the `CdpWalletProvider` by passing the `wallet` parameter to the `configureWithWallet` method.

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig
from cdp import Wallet

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    wallet=wallet,
    api_key_name="CDP API KEY NAME",
    api_key_private="CDP API KEY PRIVATE KEY",
))
```

#### Configuring from a mnemonic phrase

The `CdpWalletProvider` can be configured from a mnemonic phrase by passing the `mnemonic_phrase` parameter to the `CdpWalletProviderConfig`.

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    mnemonic_phrase="MNEMONIC PHRASE",
))
```

#### Exporting a wallet

The `CdpWalletProvider` can export a wallet by calling the `export_wallet` method.

```python
from coinbase_agentkit import CdpWalletProvider

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    mnemonic_phrase="MNEMONIC PHRASE",
))

wallet_data = wallet_provider.export_wallet()
```

#### Importing a wallet from `WalletData` JSON string

The `CdpWalletProvider` can import a wallet from a `WalletData` JSON string by passing the `cdp_wallet_data` parameter to the `CdpWalletProviderConfig`.

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    wallet_data="WALLET DATA JSON STRING",
    api_key_name="CDP API KEY NAME",
    api_key_private="CDP API KEY PRIVATE KEY",
))
```

### EthAccountWalletProvider

Example usage with a private key:

```python
from eth_account import Account

from coinbase_agentkit import (
    AgentKit, 
    AgentKitConfig, 
    EthAccountWalletProvider, 
    EthAccountWalletProviderConfig
)

# See here for creating a private key:
# https://web3py.readthedocs.io/en/stable/web3.eth.account.html#creating-a-private-key
private_key = os.environ.get("PRIVATE_KEY")
assert private_key is not None, "You must set PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

account = Account.from_key(private_key)

wallet_provider = EthAccountWalletProvider(
    config=EthAccountWalletProviderConfig(
        account=account,
        chain_id=84532,
    )
)

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

## Contributing

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/master/CONTRIBUTING.md) for more information.
