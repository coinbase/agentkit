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
- [Action Providers](#action-providers)
- [Wallet Providers](#wallet-providers)
    - [CdpWalletProvider](#cdpwalletprovider)
        - [Network Configuration](#network-configuration)
        - [Configuring from an existing CDP API Wallet](#configuring-from-an-existing-cdp-api-wallet)
        - [Configuring from a mnemonic phrase](#configuring-from-a-mnemonic-phrase)
        - [Exporting a wallet](#exporting-a-wallet)
        - [Importing a wallet from WalletData JSON string](#importing-a-wallet-from-walletdata-json-string)
        - [Configuring gas parameters](#configuring-cdpwalletprovider-gas-parameters)
    - [EthAccountWalletProvider](#ethaccountwalletprovider)
        - [Configuring gas parameters](#configuring-ethaccountwalletprovider-gas-parameters)
    - [SmartWalletProvider](#smartwalletprovider)
- [Contributing](#contributing)

## Getting Started

_Prerequisites_:

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

_Prerequisites_:

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
from coinbase_agentkit import ActionProvider, WalletProvider
from coinbase_agentkit.network import Network

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
from coinbase_agentkit import ActionProvider, WalletProvider, create_action
from coinbase_agentkit.network import Network

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

## Action Providers

This section provides a detailed list of all available action providers and their actions.

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
<summary><strong>CDP API</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>fetch_price</code></td>
    <td width="768">Retrieves the current price of a cryptocurrency from the CDP API.</td>
</tr>
<tr>
    <td width="200"><code>fetch_base_scan</code></td>
    <td width="768">Fetches on-chain data from Base blockchain explorer via CDP API.</td>
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
    <td width="200"><code>transfer</code></td>
    <td width="768">Transfers ownership of a specific NFT token to a destination address.</td>
</tr>
<tr>
    <td width="200"><code>mint</code></td>
    <td width="768">Creates a new NFT token and assigns it to a specified destination address.</td>
</tr>
</table>
</details>

<details>
<summary><strong>Hyperbolic</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>generate_text</code></td>
    <td width="768">Generate text using AI models.</td>
</tr>
<tr>
    <td width="200"><code>generate_image</code></td>
    <td width="768">Generate images using AI models.</td>
</tr>
<tr>
    <td width="200"><code>generate_audio</code></td>
    <td width="768">Generate text-to-speech audio.</td>
</tr>
<tr>
    <td width="200"><code>get_available_gpus</code></td>
    <td width="768">Get available GPU resources.</td>
</tr>
<tr>
    <td width="200"><code>get_available_gpus_by_type</code></td>
    <td width="768">Get GPUs filtered by model type.</td>
</tr>
<tr>
    <td width="200"><code>get_available_gpus_types</code></td>
    <td width="768">Get list of available GPU types.</td>
</tr>
<tr>
    <td width="200"><code>get_gpu_status</code></td>
    <td width="768">Check status of GPU resources.</td>
</tr>
<tr>
    <td width="200"><code>rent_compute</code></td>
    <td width="768">Rent GPU compute resources.</td>
</tr>
<tr>
    <td width="200"><code>terminate_compute</code></td>
    <td width="768">Terminate a rented GPU compute instance.</td>
</tr>
<tr>
    <td width="200"><code>get_current_balance</code></td>
    <td width="768">Get current account balance.</td>
</tr>
<tr>
    <td width="200"><code>get_purchase_history</code></td>
    <td width="768">Get purchase history.</td>
</tr>
<tr>
    <td width="200"><code>get_spend_history</code></td>
    <td width="768">Get spending history.</td>
</tr>
<tr>
    <td width="200"><code>link_wallet_address</code></td>
    <td width="768">Link a wallet address to your account.</td>
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
<summary><strong>SSH</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>ssh_connect</code></td>
    <td width="768">Establishes an SSH connection to a remote server.</td>
</tr>
<tr>
    <td width="200"><code>remote_shell</code></td>
    <td width="768">Executes shell commands on a remote server via SSH.</td>
</tr>
<tr>
    <td width="200"><code>ssh_status</code></td>
    <td width="768">Checks status of SSH connections.</td>
</tr>
<tr>
    <td width="200"><code>ssh_list_connections</code></td>
    <td width="768">Lists active SSH connections.</td>
</tr>
<tr>
    <td width="200"><code>ssh_disconnect</code></td>
    <td width="768">Disconnects from an SSH server.</td>
</tr>
<tr>
    <td width="200"><code>ssh_add_host_key</code></td>
    <td width="768">Adds an SSH host key to known_hosts.</td>
</tr>
<tr>
    <td width="200"><code>sftp_upload</code></td>
    <td width="768">Uploads files to a remote server via SFTP.</td>
</tr>
<tr>
    <td width="200"><code>sftp_download</code></td>
    <td width="768">Downloads files from a remote server via SFTP.</td>
</tr>
</table>
</details>

<details>
<summary><strong>Superfluid</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>create_flow</code></td>
    <td width="768">Creates a new token streaming flow to a recipient address.</td>
</tr>
<tr>
    <td width="200"><code>delete_flow</code></td>
    <td width="768">Deletes an existing token streaming flow.</td>
</tr>
<tr>
    <td width="200"><code>get_flow</code></td>
    <td width="768">Gets details of an existing token streaming flow.</td>
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
    <td width="200"><code>get_balance</code></td>
    <td width="768">Gets the native currency balance of the connected wallet.</td>
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
    <td width="768">Converts native ETH to Wrapped ETH (WETH) on supported networks.</td>
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

The `CdpWalletProvider` can be configured from a mnemonic phrase by passing the `mnemonic_phrase` and `network_id` parameters to the `CdpWalletProviderConfig`. If `network_id` is not defined, the `CdpWalletProvider` will fall back to the env var `NETWORK_ID`, and if that is not defined, it will default to `base-sepolia`.

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    mnemonic_phrase="MNEMONIC PHRASE",
    network_id="base-sepolia",
))
```

#### Exporting a wallet

The `CdpWalletProvider` can export a wallet by calling the `export_wallet` method.

```python
from coinbase_agentkit import CdpWalletProvider

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    mnemonic_phrase="MNEMONIC PHRASE",
    network_id="base-sepolia",
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

#### Configuring `CdpWalletProvider` gas parameters

The `CdpWalletProvider` also exposes parameters for effecting the gas calculations.

```python
from coinbase_agentkit import CdpWalletProvider, CdpWalletProviderConfig

wallet_provider = CdpWalletProvider(CdpWalletProviderConfig(
    wallet_data="WALLET DATA JSON STRING",
    api_key_name="CDP API KEY NAME",
    api_key_private="CDP API KEY PRIVATE KEY",
    gas={
        "gas_limit_multiplier": 2.0,   # Adjusts gas limit estimation
        "fee_per_gas_multiplier": 2.0  # Adjusts max fee per gas
    }
))
```

**Note**: Gas parameters only impact the `wallet_provider.send_transaction` behavior. Actions that do not rely on direct transaction calls, such as `deploy_token`, `deploy_contract`, and `native_transfer`, remain unaffected.

### EthAccountWalletProvider

Example usage with a private key:

```python
import os
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
        chain_id="84532",
    )
)

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

#### Configuring `EthAccountWalletProvider` gas parameters

The `EthAccountWalletProvider` also exposes parameters for effecting the gas calculations.

```python
import os
from eth_account import Account

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig
)

private_key = os.environ.get("PRIVATE_KEY")
assert private_key is not None, "You must set PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

account = Account.from_key(private_key)

wallet_provider = EthAccountWalletProvider(
    config=EthAccountWalletProviderConfig(
        account=account,
        chain_id="84532",
        gas={
            "gas_limit_multiplier": 2,
            "fee_per_gas_multiplier": 2
        }
    )
)

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

#### Configuring `EthAccountWalletProvider` rpc url

The `EthAccountWalletProvider` also exposes parameters for defining the rpc url manually.

```python
import os
from eth_account import Account

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig
)

private_key = os.environ.get("PRIVATE_KEY")
assert private_key is not None, "You must set PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

account = Account.from_key(private_key)

wallet_provider = EthAccountWalletProvider(
    config=EthAccountWalletProviderConfig(
        account=account,
        rpc_url="https://sepolia.base.org",
    )
)

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

### SmartWalletProvider

The `SmartWalletProvider` is a wallet provider that uses [CDP Smart Wallets](https://docs.cdp.coinbase.com/wallet-api/docs/smart-wallets).

```python
import os
from eth_account import Account

from coinbase_agentkit import (
    AgentKit, 
    AgentKitConfig, 
    SmartWalletProvider, 
    SmartWalletProviderConfig
)

# See here for creating a private key:
# https://web3py.readthedocs.io/en/stable/web3.eth.account.html#creating-a-private-key
private_key = os.environ.get("PRIVATE_KEY")
assert private_key is not None, "You must set PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

signer = Account.from_key(private_key)

network_id = os.getenv("NETWORK_ID", "base-sepolia")

wallet_provider = SmartWalletProvider(SmartWalletProviderConfig(
    network_id=network_id,
    signer=signer,
    smart_wallet_address=None, # If not provided, a new smart wallet will be created
    paymaster_url=None, # Sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
))

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider
))
```

## Contributing

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/master/CONTRIBUTING.md) for more information.
