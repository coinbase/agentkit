# Python Development Guide

This guide covers Python-specific setup and development for AgentKit.

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

AgentKit uses Python 3.10 or higher and uv 0.6.0 or higher.

You can run the following commands in your terminal to check your local Python and uv versions:

```bash
python --version
uv --version
```

If the versions are not correct or you don't have Python or uv installed, download and follow their setup instructions:

- Python: install with [pyenv](https://github.com/pyenv/pyenv)
- uv: follow the official [uv installation instructions](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)

Once you have these installed, make sure you install the project dependencies by running `uv sync` from the package directory.

## Adding an Action Provider

An Action is an interface for an AI Agent to interact with the real world: any Python function that you can think of can be used by an Agent via an Action! Actions are grouped by Action Providers, which are classes that contain a collection of actions along with configuration and helper functions.

You can use the `generate-action-provider` script to generate a new action provider. See the [Generate Action Provider](./python/coinbase-agentkit/scripts/generate_action_provider/README.md) for more information.

Action Components:

1. **Name**: The name of the action. This is used to identify the action when it is added to an Agent.

2. **Description**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.

3. **Input Schema**: Define the input parameters using [Pydantic](https://docs.pydantic.dev/) schemas. Pydantic is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs.

4. **Invocation Function**: The actual logic that executes the action. This function receives as input the wallet that the Agent has access to, and as you'll see in the walkthrough below, we can use this wallet to invoke an onchain contract! For more information on contract invocations using a CDP wallet, see [here](https://docs.cdp.coinbase.com/cdp-sdk/docs/onchain-interactions#smart-contract-interactions).

In practice, action providers are housed in `python/coinbase-agentkit/coinbase_agentkit/action_providers` and generally grouped by the type of action they are. For example, actions related to interacting with social platforms such as X (Twitter) are housed in `action_providers/twitter`. When adding a new action, check if there is an existing action provider for the type of action you are adding and add your new action to the appropriate folder.

Here's the structure of the action providers directory:

```
./python/coinbase-agentkit/coinbase_agentkit
└── action_providers
    └── pyth
       ├── __init__.py
       ├── pyth_action_provider.py
       ├── schemas.py
       └── utils.py
    └── ...
```

Once you decide which folder to add your action to, go ahead and create a new file there to house your action, then read through the following sections to learn how to implement your action. For a complete example of an action provider, see [erc20_action_provider.py](./python/coinbase-agentkit/coinbase_agentkit/action_providers/erc20/erc20_action_provider.py).

### Crafting a good description prompt

The description prompt is used by the LLM to understand when and how to use the action. It's important to be as specific as possible in describing the inputs and outputs of the action and include examples. Take the Mint NFT prompt for example:

```python
@create_action(
    name="mint",
    description="""
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
    """,
    schema=MintSchema,
)
```

- The prompt disambiguates the type of NFT by specifying "ERC-721"
- The prompt specifies that the destination address should not be the contract address
- The prompt specifies that the LLM should ask the user for the destination address if it is unsure
- Think about the best UX: if a contract address from a known list of addresses is required, you can instruct the LLM to use another action to get the list of addresses and prompt the user to choose an address from that list. For example, consider a DeFi action that allows a user to withdraw funds from a liquidity provider position. This action would take a contract address, so it would be valuable to have another action that can pull a list of addresses representing the user's positions. You can then instruct the LLM via the prompt to use that action in the case that no contract address is provided.

### Defining the input schema

The input schema is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs. For Python, we use [Pydantic](https://docs.pydantic.dev/) to define the input schema. For example, the Deploy NFT input schema is defined as follows:

```python
class MintSchema(BaseModel):
    """Input schema for minting an NFT."""

    contract_address: str = Field(
        ...,
        description="The contract address of the NFT to mint"
    )
    destination: str = Field(
        ...,
        description="The destination address that will receive the NFT"
    )
```

This says that the input schema has two fields: `contract_address` and `destination`. The `contract_address` field is required and must be a string. The `destination` field is required and must be a string. For more information on Pydantic, see the [Pydantic documentation](https://docs.pydantic.dev/).

### Implementing the action provider

```python
class CdpWalletActionProvider(ActionProvider[CdpWalletProvider]):
    """Provides actions for interacting with CDP wallets."""

    def __init__(self):
        super().__init__("cdp-wallet", [])

    def supports_network(self, network: Network) -> bool:
        return network.protocol_family == "evm"
```

### Implementing the action

Now we need to implement the actual function that the AI will call when using your action. Actions are defined using the `@create_action` decorator. The function receives as input the wallet provider that the Agent has access to, along with the inputs defined in the input schema, and it must return a string. Here's an example of the Mint NFT implementation:

```python
@create_action(
    name="mint",
    description="""
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
    """,
    schema=MintSchema,
)
def mint(self, wallet_provider: CdpWalletProvider, args: dict[str, Any]) -> str:
    """Mint an NFT."""
    try:
        nft_contract = wallet_provider.mint(
            contract_address=args["contract_address"],
            destination=args["destination"]
        ).wait()
    except Exception as e:
        return f"Error deploying NFT {e!s}"

    return f"Minted NFT to address {args['destination']}.\nTransaction hash: {nft_contract.transaction.transaction_hash}\nTransaction link: {nft_contract.transaction.transaction_link}"
```

Notice the return value contains useful information for the user, such as the transaction hash and link. It's important to include this information in the return value so that the user can easily see the result of the action.

This class is then exported out of [python/coinbase-agentkit/coinbase_agentkit/\_\_init\_\_.py](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/coinbase_agentkit/__init__.py) so that it is consumable by users of the `coinbase-agentkit` package.

### Testing the action provider

There are two forms of testing you should do: unit testing and manual end-to-end testing.

To add a unit test for your action provider, add a file to the appropriate folder in `python/coinbase-agentkit/tests/action_providers` for your action provider, pre-fixing it with `test_`. For an example, see [test_erc20_action_provider.py](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/tests/action_providers/erc20/test_erc20_action_provider.py).

You can then run the unit tests with the following command:

```bash
cd python/coinbase-agentkit
make test
```

Check out the [Testing](#testing) section to learn how to manually test your new action provider.

## Adding a Wallet Provider

Wallet providers give an agent access to a wallet. AgentKit currently supports the following wallet providers:

EVM:

- [CdpEvmServerWalletProvider](./python/coinbase-agentkit/coinbase_agentkit/wallet_providers/cdp_evm_server_wallet_provider.py)
- [CdpEvmSmartWalletProvider](./python/coinbase-agentkit/coinbase_agentkit/wallet_providers/cdp_evm_smart_wallet_provider.py)
- [EthAccountWalletProvider](./python/coinbase-agentkit/coinbase_agentkit/wallet_providers/eth_account_wallet_provider.py)

### Adding a new EVM wallet provider

The EVM Wallet Providers are housed in `wallet_providers/`. EVM Wallet Providers extend `EvmWalletProvider` which is an abstract class that provides core EVM wallet functionality. To add a new EVM wallet provider, create a new file in the `wallet_providers` directory and implement a class that extends `EvmWalletProvider`.

### Adding a new non-EVM wallet provider

Non-EVM Wallet Providers are housed in `wallet_providers/`. Non-EVM Wallet Providers extend `WalletProvider` which is an abstract class that provides a core set of wallet functionality. To add a new non-EVM wallet provider, create a new file in the `wallet_providers` directory and implement a class that extends `WalletProvider`.

## Integrating into an AI Agent Framework

Actions are necessary building blocks powering onchain AI applications, but they're just one piece of the puzzle. To make them truly useful, they must be integrated into an AI Agent framework such as [LangChain](https://www.langchain.com/) or other frameworks.

Integrations into AI Agent frameworks are specific to the framework itself, so we can't go into specific implementation details here, but we can offer up some examples and tips:

- Check out how [AgentKit actions are mapped into LangChain Tools](https://github.com/coinbase/agentkit/blob/master/python/framework-extensions/langchain/coinbase_agentkit_langchain/langchain_tools.py)

## Testing

### Local Testing

A good way to test new actions locally is by using the chatbot example in `python/examples/langchain-smart-wallet-chatbot`. See the [chatbot README](./python/examples/langchain-smart-wallet-chatbot/README.md) for instructions on setting up and running the chatbot.

The flow is:

1. Make your change as described in the [Adding an Action Provider](#adding-an-action-provider) section
2. In the example directory, run `uv sync && uv run chatbot.py`
3. You can now interact with your new action via the chatbot!

### Running Tests

From the package you are working in, you can run:

```bash
make test
```

For example, to run all tests in the `coinbase-agentkit` package, you can run:

```bash
cd python/coinbase-agentkit
make test
```

## Code Style

We use `ruff` for linting and formatting. Run:

```bash
# Format code
make format

# Lint code
make lint

# Fix linting issues
make lint-fix
```

## Documentation

The majority of our documentation exists within the AgentKit repo itself, in the form of colocated `README.md` files and inline docstrings. When adding new functionality or changing documented behavior, please update the relevant `README.md` file and inline docstrings to reflect the changes. For example, if you're adding a new action provider, also include a `README.md` in your new folder (see [the ERC20 Action Provider README](https://github.com/coinbase/agentkit/blob/main/python/coinbase-agentkit/coinbase_agentkit/action_providers/erc20/README.md) as a reference). Or, if you're updating an existing action provider, update its `README.md` to reflect the changes. If it doesn't have a README, please add one! These are just a couple examples; docs exist throughout the codebase and most code changes will also require updates to the docs.

## Changelog

We use [towncrier](https://towncrier.readthedocs.io/en/stable/index.html) to manage the changelog.

Changelog entries should be in the past tense, and they should be as specific as possible. Some examples of good changelog entries:

- Added a new action provider to interact with Fancy Protocol
- Fixed a bug preventing wallet balances to be formatted correctly

Changelog entries are stored in the `changelog.d` directory. Each changelog entry is stored as a markdown file named after the type of change it is and the issue number it is associated with. For example, a bug fix associated with issue #123 would be stored in `changelog.d/123.bugfix.md`. If your change does not have an associated issue, you can first create the Pull Request, and then use the PR number in the changelog entry filename.

To add a changelog entry, you can create the changelog entry file yourself, or use `towncrier` to create it for you. For example, to create a changelog entry for a bug fix in `coinbase-agentkit` associated with issue #123, run the following command from the package you are making a change to:

```bash
cd python/coinbase-agentkit

# Create a new changelog entry file for a bugfix relating to issue #123
uv run towncrier create --content "Fixed a bug" 123.bugfix.md

# Or, create a new changelog entry for a feature relating to issue #124
uv run towncrier create --content "Added a new feature" 124.feature.md
```

This will create a new changelog entry in the `changelog.d` directory, which should be committed along with the changes in your Pull Request.

The types of changes you can add are:

- `feature`
- `bugfix`
