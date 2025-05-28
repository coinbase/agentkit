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
    - [CdpEvmServerWalletProvider](#cdpevmserverwalletprovider)
        - [Network Configuration](#network-configuration)
        - [Configuring from an existing CDP API Wallet](#configuring-from-an-existing-cdp-api-wallet)
        - [Creating a new wallet](#creating-a-new-wallet)
        - [Example Usage with AgentKit](#example-usage-with-agentkit)
    - [CdpEvmSmartWalletProvider](#cdpevmsmartwalletprovider)
        - [Network Configuration](#network-configuration)
        - [Configuring with a Private Key Owner](#configuring-with-a-private-key-owner)
        - [Configuring with a Server Wallet Owner](#configuring-with-a-server-wallet-owner)
        - [Creating a New Smart Wallet](#creating-a-new-smart-wallet)
        - [Gasless Transactions with Paymaster](#gasless-transactions-with-paymaster)
        - [Example Usage with AgentKit](#example-usage-with-agentkit)
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
    api_key_id="CDP API KEY NAME",
    api_key_secret="CDP API KEY SECRET",
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
            api_key_id="CDP API KEY NAME",
            api_key_secret="CDP API KEY SECRET"
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
pip install coinbase-agentkit-langchain langchain-openai langgraph
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
    cdp_api_key_id="CDP API KEY ID",
    cdp_api_key_secret="CDP API KEY SECRET",
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
<summary><strong>CDP API</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>request_faucet_funds</code></td>
    <td width="768">Requests testnet ETH, USDC, EURC or CBBTC.</td>
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
<summary><strong>Nillion</strong></summary>
<table width="100%">
<tr>
    <td width="200"><code>lookup_schema</code></td>
    <td width="768">Looks up a schema by description and returns both the schema UUID and corresponding JSON schema.</td>
</tr>
<tr>
    <td width="200"><code>create_schema</code></td>
    <td width="768">Creates a new schema in the Nillion SecretVault based on a natural language description.</td>
</tr>
<tr>
    <td width="200"><code>data_upload</code></td>
    <td width="768">Uploads data into the Nillion SecretVault using a specified schema UUID.</td>
</tr>
<tr>
    <td width="200"><code>data_download</code></td>
    <td width="768">Downloads all data from the Nillion SecretVault for a specified schema UUID.</td>
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

- [CdpEvmServerWalletProvider](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/coinbase_agentkit/wallet_providers/cdp_evm_server_wallet_provider.py) - Uses the Coinbase Developer Platform (CDP) API Server Wallet
- [CdpEvmSmartWalletProvider](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/coinbase_agentkit/wallet_providers/cdp_evm_smart_wallet_provider.py) - Uses the Coinbase Developer Platform (CDP) API Smart Wallet
- [EthAccountWalletProvider](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/coinbase_agentkit/wallet_providers/eth_account_wallet_provider.py) - Uses a local private key for any EVM-compatible chain

### CdpEvmServerWalletProvider

The `CdpEvmServerWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) [API Server Wallet](https://docs.cdp.coinbase.com/wallet-api/docs/welcome).

#### Network Configuration

The `CdpEvmServerWalletProvider` can be configured to use a specific network by passing the `network_id` parameter to the `CdpEvmServerWalletProviderConfig`. The `network_id` is the ID of the network you want to use. You can find a list of [supported networks on the CDP API docs](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

```python
from coinbase_agentkit import CdpEvmServerWalletProvider, CdpEvmServerWalletProviderConfig

wallet_provider = CdpEvmServerWalletProvider(CdpEvmServerWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    network_id="base-mainnet",
))
```

#### Configuring from an existing CDP API Wallet

If you already have a CDP API Wallet, you can configure the `CdpEvmServerWalletProvider` by passing the `address` parameter to the config.

```python
from coinbase_agentkit import CdpEvmServerWalletProvider, CdpEvmServerWalletProviderConfig

wallet_provider = CdpEvmServerWalletProvider(CdpEvmServerWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    address="YOUR_WALLET_ADDRESS",
))
```

#### Creating a new wallet

The `CdpEvmServerWalletProvider` can create a new wallet by providing an `idempotency_key`. If no `address` is provided, a new wallet will be created.

```python
from coinbase_agentkit import CdpEvmServerWalletProvider, CdpEvmServerWalletProviderConfig

wallet_provider = CdpEvmServerWalletProvider(CdpEvmServerWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    idempotency_key="UNIQUE_IDEMPOTENCY_KEY",
))
```

#### Example Usage with AgentKit

Here's a complete example of using `CdpEvmServerWalletProvider` with AgentKit:

```python
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmServerWalletProvider,
    CdpEvmServerWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)

# Initialize the wallet provider
wallet_provider = CdpEvmServerWalletProvider(CdpEvmServerWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    network_id="base-sepolia",
))

# Create AgentKit instance with wallet and action providers
agentkit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[
        cdp_api_action_provider(),
        erc20_action_provider(),
        pyth_action_provider(),
        wallet_action_provider(),
        weth_action_provider(),
    ],
))
```

### CdpEvmSmartWalletProvider

The `CdpEvmSmartWalletProvider` is a wallet provider that uses the Coinbase Developer Platform (CDP) [Smart Wallets](https://docs.cdp.coinbase.com/wallet-api/docs/smart-wallets). Smart wallets are controlled by an owner, which can be either an EVM private key or a CDP server wallet address.

#### Network Configuration

The `CdpEvmSmartWalletProvider` can be configured to use a specific network by passing the `network_id` parameter to the `CdpEvmSmartWalletProviderConfig`. The `network_id` is the ID of the network you want to use. You can find a list of [supported networks on the CDP API docs](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

```python
from coinbase_agentkit import CdpEvmSmartWalletProvider, CdpEvmSmartWalletProviderConfig

wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    network_id="base-mainnet",
    owner="OWNER_PRIVATE_KEY_OR_SERVER_WALLET_ADDRESS",
))
```

#### Configuring with a Private Key Owner

You can configure the `CdpEvmSmartWalletProvider` with a private key owner:

```python
from coinbase_agentkit import CdpEvmSmartWalletProvider, CdpEvmSmartWalletProviderConfig

wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    owner="0x123...",  # Private key
    network_id="base-sepolia",
))
```

#### Configuring with a Server Wallet Owner

You can also configure the `CdpEvmSmartWalletProvider` with a CDP server wallet address as the owner:

```python
from coinbase_agentkit import CdpEvmSmartWalletProvider, CdpEvmSmartWalletProviderConfig

wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    owner="0x456...",  # Server wallet address
    network_id="base-sepolia",
))
```

#### Creating a New Smart Wallet

If no `address` is provided, a new smart wallet will be created for the owner. You can optionally provide an `idempotency_key` to ensure idempotent wallet creation:

```python
from coinbase_agentkit import CdpEvmSmartWalletProvider, CdpEvmSmartWalletProviderConfig

wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    owner="OWNER_PRIVATE_KEY_OR_SERVER_WALLET_ADDRESS",
    idempotency_key="UNIQUE_IDEMPOTENCY_KEY",
))
```

#### Gasless Transactions with Paymaster

You can enable gasless transactions by providing a paymaster URL:

```python
from coinbase_agentkit import CdpEvmSmartWalletProvider, CdpEvmSmartWalletProviderConfig

wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    owner="OWNER_PRIVATE_KEY_OR_SERVER_WALLET_ADDRESS",
    paymaster_url="https://your-paymaster-url.com",  # Optional paymaster URL for gasless transactions
))
```

#### Example Usage with AgentKit

Here's a complete example of using `CdpEvmSmartWalletProvider` with AgentKit:

```python
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmSmartWalletProvider,
    CdpEvmSmartWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)

# Initialize the wallet provider
wallet_provider = CdpEvmSmartWalletProvider(CdpEvmSmartWalletProviderConfig(
    api_key_id="CDP API KEY ID",
    api_key_secret="CDP API KEY SECRET",
    wallet_secret="CDP WALLET SECRET",
    owner="OWNER_PRIVATE_KEY_OR_SERVER_WALLET_ADDRESS",
    network_id="base-sepolia",
))

# Create AgentKit instance with wallet and action providers
agentkit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[
        cdp_api_action_provider(),
        erc20_action_provider(),
        pyth_action_provider(),
        wallet_action_provider(),
        weth_action_provider(),
    ],
))
```

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

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md) for more information.
