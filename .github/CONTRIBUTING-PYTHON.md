# Python Development Guide

This guide covers Python-specific setup and development for AgentKit.

## Contents

- [Development Setup](#development-setup)
- [Adding an Agentic Action](#adding-an-agentic-action)
- [Adding an Agentic Action to Langchain Toolkit](#adding-an-agentic-action-to-langchain-toolkit)
- [Adding an Agentic Action to the Twitter Toolkit](#adding-an-agentic-action-to-the-twitter-toolkit)
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

One of the most common ways to contribute to AgentKit is by adding a new agentic action. Here are the high level steps:

1. Create a new file in `cdp-agentkit-core/python/cdp_agentkit_core/actions`
2. Implement your new action inside your newly created file
    - For an example of an action, see [mint_nft.py](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/python/cdp_agentkit_core/actions/mint_nft.py)
3. Add your action to [`cdp_agentkit_core/actions/__init__.py`](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/python/cdp_agentkit_core/actions/__init__.py)
4. Add a test for your action in `cdp-agentkit-core/python/tests/actions`
    - For an example, see [test_mint_nft.py](https://github.com/coinbase/agentkit/blob/master/cdp-agentkit-core/python/tests/actions/test_mint_nft.py)

Actions are created by implementing the `CdpAction` interface:

```python
from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

MINT_NFT_PROMPT = """
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
"""


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


class MintNftAction(CdpAction):
    """Mint NFT action."""

    name: str = "mint_nft"
    description: str = MINT_NFT_PROMPT
    args_schema: type[BaseModel] | None = MintNftInput
    func: Callable[..., str] = mint_nft
```

#### Components of an Agentic Action

1. **Input Schema**: Define the input parameters using Pydantic schemas
2. **Prompt**: A description that helps the AI understand when and how to use the action. It's important to describe the inputs and outputs of the action and include examples. Additionally, think about what inputs can be removed entirely and fetched or inferred by the LLM, so that users don't have to manually provide them.
3. **Action Class**: Implements the `CdpAction` interface with:
   - `name`: Unique identifier for the action
   - `description`: The prompt text
   - `args_schema`: The Pydantic schema for validating inputs
   - `func`: The implementation function
4. **Implementation Function**: The actual logic that executes the action

Check out the [Testing](#testing) section to learn how to manually test your new action.

## Adding an Agentic Action to Langchain Toolkit

The action will be included automatically, all you need to do is add the action to the list of tools in the `CdpToolkit` class documentation in `cdp-langchain/python/cdp_langchain/agent_toolkits/cdp_toolkit.py`.

## Adding an Agentic Action to the Twitter Toolkit

1. Ensure the action is implemented in `cdp-agentkit-core/actions/social/twitter`.
2. Add a wrapper method to `TwitterApiWrapper` in `./twitter_langchain/twitter_api_wrapper.py`
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
3. Add call to the wrapper in `TwitterApiWrapper.run` in `./twitter_langchain/twitter_api_wrapper.py`
   - E.g.
```python
        if mode == "post_tweet":
            return self.post_tweet_wrapper(**kwargs)

```
4. Add the action to the list of available tools in the `TwitterToolkit` in `./twitter_langchain/twitter_toolkit.py`
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

## Testing

### Local Testing

A good way to test new actions locally is by using the chatbot example in `cdp-langchain`. See the [chatbot README](https://github.com/coinbase/agentkit/blob/master/cdp-langchain/examples/chatbot-python/README.md) for instructions on setting up and running the chatbot.

The flow is:

1. Make your change as described in the [Adding an Agentic Action](#adding-an-agentic-action) section
2. Update `cdp-langchain/examples/chatbot-python/pyproject.toml` to point to the local package
```diff
[tool.poetry]
name = "chatbot-python"
version = "0.0.1"
description = "CDP AgentKit Example Chatbot"
authors = ["John Peterson <john.peterson@coinbase.com>"]
readme = "README.md"
package-mode = false

[tool.poetry.dependencies]
python = "^3.10"
- cdp-langchain = "^0.0.11"
+ cdp-langchain = { path: "../../cdp-agentkit-core/python", develop: true }

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```
3. In `cdp-langchain/examples/chatbot-python`, run `python chatbot.py`
4. You can now interact with your new action via the chatbot!

### Running Unit Tests

From the package you are working in, you can run:

```bash
make test
```

For example, to run all tests in the `cdp_agentkit_core` package, you can run:
```bash
cd cdp-agentkit-core/python
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
