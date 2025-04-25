import json
import os
from collections.abc import AsyncIterator, Callable

from agents import Agent, Runner, TResponseInputItem
from agents.voice import VoiceWorkflowBase, VoiceWorkflowHelper
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpWalletProvider,
    CdpWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    compound_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_openai_agents_sdk import get_openai_agents_sdk_tools
from dotenv import load_dotenv

load_dotenv()


# Configure a file to persist the agent's CDP API Wallet Data.
wallet_data_file = "wallet_data.txt"


def initialize_agent():
    """Initialize the agent with CDP Agentkit."""
    # Initialize CDP Wallet Provider
    wallet_data = None
    if os.path.exists(wallet_data_file):
        with open(wallet_data_file) as f:
            wallet_data = f.read()

    cdp_config = None
    if wallet_data is not None:
        cdp_config = CdpWalletProviderConfig(wallet_data=wallet_data)

    wallet_provider = CdpWalletProvider(cdp_config)

    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                cdp_api_action_provider(),
                erc20_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
                compound_action_provider(),
            ],
        )
    )

    wallet_data_json = json.dumps(wallet_provider.export_wallet().to_dict())

    with open(wallet_data_file, "w") as f:
        f.write(wallet_data_json)

    # use get_openai_agents_sdk_tools
    tools = get_openai_agents_sdk_tools(agentkit)

    # Create Agent using the OpenAI Agents SDK
    agent = Agent(
        name="CDP Agent",
        instructions=(
            "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
            "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
            "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
            "details and request funds from the user. Before executing your first action, get the wallet details "
            "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
            "again later. If someone asks you to do something you can't do with your currently available tools, "
            "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
            "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
            "responses. Refrain from restating your tools' descriptions unless it is explicitly requested."
            "Your mode of communication is voice. You should respond with short, concise answers. When requested "
            "for a wallet address, you should only respond with the last 4 characters of the address. When "
            "a tool returns a transaction hash, do not respond to the user with the hash, simply instruct "
            "the user to go to a block explorer to view the transaction."
        ),
        model="gpt-4o-mini",
        tools=tools,
    )

    return agent


class MyWorkflow(VoiceWorkflowBase):
    """A workflow that interacts with the Coinbase Developer Platform AgentKit."""

    def __init__(self, on_start: Callable[[str], None]):
        """Initialize the workflow.

        Args:
        secret_word: The secret word to guess.
        on_start: A callback that is called when the workflow starts. The transcription
            is passed in as an argument.

        """
        self._input_history: list[TResponseInputItem] = []
        self._current_agent = initialize_agent()
        self._on_start = on_start

    async def run(self, transcription: str) -> AsyncIterator[str]:
        """Run the workflow."""
        self._on_start(transcription)

        # Add the transcription to the input history
        self._input_history.append(
            {
                "role": "user",
                "content": transcription,
            }
        )

        # Otherwise, run the agent
        result = Runner.run_streamed(self._current_agent, self._input_history)

        async for chunk in VoiceWorkflowHelper.stream_text_from(result):
            yield chunk

        # Update the input history and current agent
        self._input_history = result.to_input_list()
        self._current_agent = result.last_agent
