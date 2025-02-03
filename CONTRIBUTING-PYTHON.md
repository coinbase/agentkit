# Python Development Guide

This guide covers Python-specific setup and development for AgentKit.

## Contents

- [Development Setup](#development-setup)
- [Adding an Agentic Action](#adding-an-agentic-action)
- [Adding an Agentic Action to LangChain Toolkit](#adding-an-agentic-action-to-langchain-toolkit)
- [Adding an Agentic Action to the Twitter Toolkit](#adding-an-agentic-action-to-the-twitter-toolkit)
- [Integrating into an AI Agent Framework](#integrating-into-an-ai-agent-framework)
- [Testing](#testing)
- [Code Style](#code-style)

## Development Setup

AgentKit uses Python 3.10 or higher and Poetry 1.8.5 or higher.

You can run the following commands in your terminal to check your local Python and Poetry versions:

```bash
python --version
poetry --version
```

If the versions are not correct or you don't have Python or Poetry installed, download and follow their setup instructions:
* Python: install with [pyenv](https://github.com/pyenv/pyenv)
* Poetry: follow the official [Poetry installation instructions](https://python-poetry.org/docs/#installation)

**Note**: You will also need to have Rust and Cargo installed. Follow the official [Rust installation instructions](https://doc.rust-lang.org/cargo/getting-started/installation.html)

## Adding an Agentic Action

An Action is an interface for an AI Agent to interact with the real world: any Python function that you can think of can be used by an Agent via an Action! There are a few components to an Action:

1. **Prompt**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.
2. **Input Schema**: Define the input parameters using [Pydantic](https://docs.pydantic.dev/latest/) schemas. Pydantic is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs.
3. **Implementation Function**: The actual logic that executes the action. This function receives as input the wallet that the Agent has access to, and as you'll see in the walkthrough below, we can use this wallet to invoke an onchain contract! For more information on contract invocations using a CDP wallet, see [here](https://docs.cdp.coinbase.com/cdp-sdk/docs/onchain-interactions#smart-contract-interactions).

In practice, Actions are housed in `python/cdp-agentkit-core/cdp_agentkit_core/actions` and generally grouped by the type of action they are. For example, actions related to interacting with social platforms such as X (Twitter) are housed in `python/cdp-agentkit-core/cdp_agentkit_core/actions/social/twitter`. When adding a new action, check if there is an existing folder for the type of action you are adding and add your new action to the appropriate folder.

Here's the structure of the actions directory:

```
./python/cdp-agentkit-core
└── cdp_agentkit_core
    └── actions
       ├── defi
       ├── morpho
       ├── pyth
       ├── social
       ├── superfluid
       └── wow
```

Once you decide which folder to add your action to, go ahead and create a new file there to house your action, then read through the following sections to learn how to implement your action. For a complete example of an action, see [mint_nft.py](https://github.com/coinbase/agentkit/blob/master/python/cdp-agentkit-core/cdp_agentkit_core/actions/mint_nft.py).

### Crafting a good prompt

The prompt is used by the LLM to understand when and how to use the action. It's important to be as specific as possible in describing the inputs and outputs of the action and include examples. Take the Mint NFT prompt for example:

```python
MINT_NFT_PROMPT = """
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
"""
```

* The prompt disambiguates the type of NFT by specifying "ERC-721"
* The prompt specifies that the destination address should not be the contract address
* The prompt specifies that the LLM should ask the user for the destination address if it is unsure
* Think about the best UX: if a contract address from a known list of addresses is required, you can instruct the LLM to use another action to get the list of addresses and prompt the user to choose an address from that list. For example, consider a DeFi action that allows a user to withdraw funds from a liquidity provider position. This action would take a contract address, so it would be valuable to have another action that can pull a list of addresses representing the user's positions. You can then instruct the LLM via the prompt to use that action in the case that no contract address is provided.

### Defining the input schema

The input schema is used to validate the inputs to the action and to generate a JSON schema that can be used by the LLM to understand the inputs. For Python, we use [Pydantic](https://docs.pydantic.dev/latest/) to define the input schema. For example, the Mint NFT input schema is defined as follows:

```python
class MintNftInput(BaseModel):
    """Input argument schema for mint NFT action."""

    contract_address: str = Field(
        ...,
        description="The contract address of the NFT (ERC-721) to mint, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )
    destination: str = Field(
        ...,
        description="The destination address that will receive the NFT onchain, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )
```

This says that the input schema has two fields: `contract_address` and `destination`. The `contract_address` field is required and must be a string. The `destination` field is required and must be a string. For more information on Pydantic, see the [Pydantic documentation](https://docs.pydantic.dev/latest/).

### Implementing the action

Now we need to implement the actual function that the AI will call when using your action. The function receives as input the wallet that the Agent has access to, along with the inputs defined in the input schema, and it must return a string. This return value is used by the LLM to understand the result of the action, which in turn will generate a user-facing response. Here's an example of the Mint NFT implementation function:

```python
def mint_nft(wallet: Wallet, contract_address: str, destination: str) -> str:
    """Mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.

    Args:
        wallet (Wallet): The wallet to trade the asset from.
        contract_address (str): The contract address of the NFT (ERC-721) to mint, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
        destination (str): The destination address that will receive the NFT onchain, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

    Returns:
        str: A message containing the NFT mint details.

    """
    mint_args = {"to": destination, "quantity": "1"}

    try:
        mint_invocation = wallet.invoke_contract(
            contract_address=contract_address, method="mint", args=mint_args
        ).wait()
    except Exception as e:
        return f"Error minting NFT {e!s}"

    return f"Minted NFT from contract {contract_address} to address {destination} on network {wallet.network_id}.\nTransaction hash for the mint: {mint_invocation.transaction.transaction_hash}\nTransaction link for the mint: {mint_invocation.transaction.transaction_link}"

```

Notice the return value contains useful information for the user, such as the transaction hash and link. It's important to include this information in the return value so that the user can easily see the result of the action.

Finally, we need to create a class that implements the `CdpAction` interface and export it. This class contains the name, description, input schema, and implementation function of the action. Here's an example of the Mint NFT action class:

```python
class MintNftAction(CdpAction):
    """Mint NFT action."""

    name: str = "mint_nft"
    description: str = MINT_NFT_PROMPT
    args_schema: type[BaseModel] | None = MintNftInput
    func: Callable[..., str] = mint_nft
```

This class is then exported out of [`cdp_agentkit_core/actions/__init__.py`](https://github.com/coinbase/agentkit/blob/master/python/cdp-agentkit-core/cdp_agentkit_core/actions/__init__.py) so that is is consumable by users of the `cdp-agentkit-core` package.

### Testing the action

There are two forms of testing you should do: unit testing and manual end-to-end testing.

To add a unit test for your action, add a file to the folder in `python/cdp-agentkit-core/tests/actions` that corresponds to the same folder that you are adding your action to. For an example, see [test_mint_nft.py](https://github.com/coinbase/agentkit/blob/master/python/cdp-agentkit-core/tests/actions/test_mint_nft.py).

You can then run the unit tests with the following command:
```bash
cd python/cdp-agentkit-core
make test
```

For instructions on manual end-to-end testing, see the [Testing](#testing) section.

## Adding an Agentic Action to LangChain Toolkit

The action will be included automatically, all you need to do is add the action to the list of tools in the `CdpToolkit` class documentation in `python/cdp-langchain/cdp_langchain/agent_toolkits/cdp_toolkit.py`.

## Adding an Agentic Action to the Twitter Toolkit

1. Ensure the action is implemented in `cdp-agentkit-core/actions/social/twitter`.
2. Add a wrapper method to `TwitterApiWrapper` in `python/twitter-langchain/twitter_langchain/twitter_api_wrapper.py`
   - E.g.
```python
    def post_tweet_wrapper(self, tweet: str) -> str:
        """Post tweet to Twitter.

        Args:
            client (tweepy.Client): The tweepy client to use.
            tweet (str): The text of the tweet to post to twitter. Tweets can be maximum 280 characters.

        Returns:
            str: A message containing the result of the post action and the tweet.

        """

        return post_tweet(client=self.client, tweet=tweet)
```
3. Add call to the wrapper in `TwitterApiWrapper.run` in `python/twitter-langchain/twitter_langchain/twitter_api_wrapper.py`
   - E.g.
```python
        if mode == "post_tweet":
            return self.post_tweet_wrapper(**kwargs)

```
4. Add the action to the list of available tools in the `TwitterToolkit` in `python/twitter-langchain/twitter_langchain/twitter_toolkit.py`
   - E.g.
```python
        actions: List[Dict] = [
            {
                "mode": "post_tweet",
                "name": "post_tweet",
                "description": POST_TWEET_PROMPT,
                "args_schema": PostTweetInput,
            },
        ]
```
5. Update `TwitterToolkit` documentation
    - Add the action to the list of tools
    - Add any additional ENV requirements

## Integrating into an AI Agent Framework

Actions are necessary building blocks powering onchain AI applications, but they're just one piece of the puzzle. To make them truly useful, they must be integrated into an AI Agent framework such as [LangChain](https://www.langchain.com/) or [Eliza](https://elizaos.github.io/eliza/), among others.

Integrations into AI Agent frameworks are specific to the framework itself, so we can't go into specific implementation details here, but we can offer up some examples and tips.
- To automatically get access to new actions as they are released, make sure to import the `CDP_ACTIONS` constant from `cdp-agentkit-core`. This will make it so that all you / the framework authors have to do to get new actions is bump the version of AgentKit the framework is using.
- Check out how [AgentKit Actions are mapped into LangChain Tools](https://github.com/coinbase/agentkit/blob/master/python/cdp-langchain/cdp_langchain/agent_toolkits/cdp_toolkit.py#L132-L141)

## Testing

### Local Testing

A good way to test new actions locally is by using the chatbot example in `cdp-langchain`. See the [chatbot README](https://github.com/coinbase/agentkit/blob/master/python/examples/cdp-langchain-chatbot/README.md) for instructions on setting up and running the chatbot.

The flow is:

1. Make your change as described in the [Adding an Agentic Action](#adding-an-agentic-action) section
2. Update `python/examples/cdp-langchain-chatbot/pyproject.toml` to point to the local package
```diff
[tool.poetry]
name = "cdp-langchain-chatbot"
version = "0.0.1"
description = "CDP AgentKit Example Chatbot"
authors = ["John Peterson <john.peterson@coinbase.com>"]
readme = "README.md"
package-mode = false

[tool.poetry.dependencies]
python = "^3.10"
- cdp-langchain = "^0.0.11"
+ cdp-langchain = { path: "../cdp-agentkit-core", develop: true }

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```
3. In `python/examples/cdp-langchain-chatbot`, run `python chatbot.py`
4. You can now interact with your new action via the chatbot!

### Running Unit Tests

From the package you are working in, you can run:

```bash
make test
```

For example, to run all tests in the `cdp-agentkit-core` package, you can run:
```bash
cd python/cdp-agentkit-core
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
