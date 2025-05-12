import json
import os
import time
from collections.abc import AsyncIterator, Callable

from agents import Agent, Runner, TResponseInputItem
from agents.voice import VoiceWorkflowBase, VoiceWorkflowHelper
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmServerWalletProvider,
    CdpEvmServerWalletProviderConfig,
    cdp_api_action_provider,
    compound_action_provider,
    erc20_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_openai_agents_sdk import get_openai_agents_sdk_tools
from dotenv import load_dotenv

load_dotenv()


def initialize_agent(config: CdpEvmServerWalletProviderConfig):
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the CDP EVM Server Wallet Provider

    Returns:
        tuple[Agent, CdpEvmServerWalletProvider]: The initialized agent and wallet provider

    """
    # Initialize the wallet provider with the config
    wallet_provider = CdpEvmServerWalletProvider(
        CdpEvmServerWalletProviderConfig(
            api_key_id=config.api_key_id,  # CDP API Key ID
            api_key_secret=config.api_key_secret,  # CDP API Key Secret
            wallet_secret=config.wallet_secret,  # CDP Wallet Secret
            network_id=config.network_id,  # Network ID - Optional, will default to 'base-sepolia'
            address=config.address,  # Wallet Address - Optional, will trigger idempotency flow if not provided
            idempotency_key=config.idempotency_key,  # Idempotency Key - Optional, seeds generation of a new wallet
        )
    )

    # Create AgentKit instance with wallet and action providers
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

    # Get tools for the agent
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

    return agent, wallet_provider


def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration

    """
    # Configure network and file path
    network_id = os.getenv("NETWORK_ID", "base-sepolia")
    wallet_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load existing wallet data if available
    wallet_data = {}
    if os.path.exists(wallet_file):
        try:
            with open(wallet_file) as f:
                wallet_data = json.load(f)
                print(f"Loading existing wallet from {wallet_file}")
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data for {network_id}")
            wallet_data = {}

    # Determine wallet address using priority order
    wallet_address = (
        wallet_data.get("address")  # First priority: Saved wallet file
        or os.getenv("ADDRESS")  # Second priority: ADDRESS env var
        or None  # Will trigger idempotency flow if needed
    )

    # Create the wallet provider config
    config = CdpEvmServerWalletProviderConfig(
        api_key_id=os.getenv("CDP_API_KEY_ID"),
        api_key_secret=os.getenv("CDP_API_KEY_SECRET"),
        wallet_secret=os.getenv("CDP_WALLET_SECRET"),
        network_id=network_id,
        address=wallet_address,
        # Only include idempotency_key if we need to create a new wallet
        idempotency_key=(os.getenv("IDEMPOTENCY_KEY") if not wallet_address else None),
    )

    # Initialize the agent and get the wallet provider
    agent, wallet_provider = initialize_agent(config)

    # Save the wallet data after successful initialization
    new_wallet_data = {
        "address": wallet_provider.get_address(),
        "network_id": network_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        if not wallet_data
        else wallet_data.get("created_at"),
    }

    with open(wallet_file, "w") as f:
        json.dump(new_wallet_data, f, indent=2)
        print(f"Wallet data saved to {wallet_file}")

    return agent


class MyWorkflow(VoiceWorkflowBase):
    """A workflow that interacts with the Coinbase Developer Platform AgentKit."""

    def __init__(self, on_start: Callable[[str], None]):
        """Initialize the workflow.

        Args:
            on_start: A callback that is called when the workflow starts. The transcription
                is passed in as an argument.

        """
        self._input_history: list[TResponseInputItem] = []
        self._current_agent = setup()
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
