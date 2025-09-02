import asyncio
import json
import os
import time

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.messages import BaseChatMessage, TextMessage
from autogen_core.memory import ListMemory
from autogen_ext.models.openai import OpenAIChatCompletionClient
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
    x402_action_provider,
)
from coinbase_agentkit_autogen.autogen_tools import get_autogen_tools
from dotenv import load_dotenv


def initialize_agent(
    config: CdpEvmWalletProviderConfig,
) -> tuple[AssistantAgent, CdpEvmWalletProvider]:
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the CDP EVM Server Wallet Provider

    Returns:
        tuple[Agent, CdpEvmServerWalletProvider]: The initialized agent and wallet provider

    """
    # Initialize the language model
    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-mini",
    )

    # Initialize the wallet provider with the config
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
            api_key_id=config.api_key_id,  # CDP API Key ID
            api_key_secret=config.api_key_secret,  # CDP API Key Secret
            wallet_secret=config.wallet_secret,  # CDP Wallet Secret
            network_id=config.network_id,  # Network ID - Optional, will default to 'base-sepolia'
            address=config.address,  # Wallet Address - Optional, will trigger idempotency flow if not provided
            idempotency_key=config.idempotency_key,  # Idempotency Key - Optional, seeds generation of a new wallet
            rpc_url=config.rpc_url,  # Optional RPC URL override
        )
    )

    # Create AgentKit instance with wallet and action providers
    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                cdp_api_action_provider(),
                erc20_action_provider(),
                pyth_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
                x402_action_provider(),
            ],
        )
    )

    # Get tools for the agent
    tools = get_autogen_tools(agentkit)

    # Set up conversation memory
    memory = ListMemory()

    # Set up Autogen Assistant Agent
    agent = AssistantAgent(
        name="assistant",
        model_client=model_client,
        reflect_on_tool_use=True,
        tools=tools,
        memory=[memory],
        max_tool_iterations=3,
        system_message=(
            "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
            "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
            "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
            "details and request funds from the user. Before executing your first action, get the wallet details "
            "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
            "again later. If someone asks you to do something you can't do with your currently available tools, "
            "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
            "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
            "responses. Refrain from restating your tools' descriptions unless it is explicitly requested."
        ),
    )

    # Create and return the agent and wallet provider
    return agent, wallet_provider


def setup() -> AssistantAgent:
    """Set up the agent with persistent wallet storage.

    Returns:
        AssistantAgent: The initialized agent used for handling wallet interactions and
                        executing associated operations.

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
    config = CdpEvmWalletProviderConfig(
        api_key_id=os.getenv("CDP_API_KEY_ID"),
        api_key_secret=os.getenv("CDP_API_KEY_SECRET"),
        wallet_secret=os.getenv("CDP_WALLET_SECRET"),
        network_id=network_id,
        address=wallet_address,
        # Only include idempotency_key if we need to create a new wallet
        idempotency_key=(os.getenv("IDEMPOTENCY_KEY") if not wallet_address else None),
    )

    # Initialize the agent and get the wallet provider
    agent_executor, wallet_provider = initialize_agent(config)

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

    return agent_executor


# Autonomous Mode
async def run_autonomous_mode(agent_executor: AssistantAgent, interval=10) -> None:
    """Run the autonomous mode of the AssistantAgent with a specified interval between actions.

    Args:
        agent_executor (AssistantAgent): The agent responsible for executing tasks autonomously.
        interval (int, optional): Time in seconds to wait between consecutive autonomous actions. Defaults to 10.

    """
    print("Starting autonomous mode...")
    while True:
        try:
            # Provide instructions autonomously
            thought = (
                "Be creative and do something interesting on the blockchain. "
                "Choose an action or set of actions and execute it that highlights your abilities."
            )

            # Run agent in autonomous mode
            async for chunk in agent_executor.run_stream(
                task=TextMessage(content=thought, source="User"), output_task_messages=False
            ):
                if isinstance(chunk, BaseChatMessage):
                    print("\n-------------------")
                    print(chunk.to_text())
                    print("-------------------")

            # Wait before the next action
            await asyncio.sleep(interval)

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            await agent_executor._model_client.close()
            return


# Chat Mode
async def run_chat_mode(agent_executor: AssistantAgent) -> None:
    """Run the assistant agent in chat mode.

    Args:
        agent_executor (AssistantAgent): The agent executor responsible for handling the
        chatbot functionality and running tasks based on user input.

    """
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break

            # Run agent with the user's input in chat mode
            async for chunk in agent_executor.run_stream(
                task=TextMessage(content=user_input, source="User"), output_task_messages=False
            ):
                if isinstance(chunk, BaseChatMessage):
                    print("\n-------------------")
                    print(chunk.to_text())
                    print("-------------------")

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            await agent_executor._model_client.close()
            return


# Mode Selection
def choose_mode():
    """Prompt the user to select a mode of operation from the available options.

    Returns
    -------
    str
        The selected mode, either "chat" or "auto".

    """
    while True:
        print("\nAvailable modes:")
        print("1. chat    - Interactive chat mode")
        print("2. auto    - Autonomous action mode")

        choice = input("\nChoose a mode (enter number or name): ").lower().strip()
        if choice in ["1", "chat"]:
            return "chat"
        elif choice in ["2", "auto"]:
            return "auto"
        print("Invalid choice. Please try again.")


async def main():
    """Start the chatbot agent."""
    # Load environment variables
    load_dotenv()

    # Set up the agent
    agent_executor = setup()

    # Run the agent in the selected mode
    mode = choose_mode()
    if mode == "chat":
        await run_chat_mode(agent_executor=agent_executor)
    elif mode == "auto":
        await run_autonomous_mode(agent_executor=agent_executor)


if __name__ == "__main__":
    print("Starting Agent...")
    asyncio.run(main())
