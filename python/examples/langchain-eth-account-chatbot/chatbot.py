import json
import os
import sys
import time

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_langchain import get_langchain_tools
from dotenv import load_dotenv
from eth_account import Account
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent


def initialize_agent(config: EthAccountWalletProviderConfig):
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the Ethereum Account Wallet Provider

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration

    """
    # Initialize LLM
    llm = ChatOpenAI(model="gpt-4o-mini")

    # Initialize Ethereum Account Wallet Provider
    wallet_provider = EthAccountWalletProvider(
        config=EthAccountWalletProviderConfig(
            account=config.account,  # Ethereum account from private key
            chain_id=config.chain_id,  # Chain ID for the network
        )
    )

    # Initialize AgentKit
    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                erc20_action_provider(),
                pyth_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
            ],
        )
    )

    # Get tools for the agent
    tools = get_langchain_tools(agentkit)

    # Store buffered conversation history in memory
    memory = MemorySaver()
    agent_config = {"configurable": {"thread_id": "Ethereum Account Chatbot"}}

    # Create ReAct Agent using the LLM and Ethereum Account Wallet tools
    return (
        create_react_agent(
            llm,
            tools=tools,
            checkpointer=memory,
            state_modifier=(
                "You are a helpful agent that can interact onchain using an Ethereum Account Wallet. "
                "You have tools to send transactions, query blockchain data, and interact with contracts. "
                "If you run into a 5XX (internal) error, ask the user to try again later."
            ),
        ),
        agent_config,
    )


def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration

    """
    # Configure chain ID and file path
    chain_id = os.getenv("CHAIN_ID", "84532")  # Default to Base Sepolia
    wallet_file = f"wallet_data_{chain_id}.txt"

    # Load existing wallet data if available
    wallet_data = {}
    if os.path.exists(wallet_file):
        try:
            with open(wallet_file) as f:
                wallet_data = json.load(f)
                print(f"Loading existing wallet from {wallet_file}")
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data for chain {chain_id}")
            wallet_data = {}

    # Get or generate private key
    private_key = (
        os.getenv("PRIVATE_KEY")  # First priority: Environment variable
        or wallet_data.get("private_key")  # Second priority: Saved wallet file
        or Account.create().key.hex()  # Third priority: Generate new key
    )

    # Ensure private key has 0x prefix
    if not private_key.startswith("0x"):
        private_key = f"0x{private_key}"

    # Create Ethereum account from private key
    account = Account.from_key(private_key)

    # Create the wallet provider config
    config = EthAccountWalletProviderConfig(
        account=account,
        chain_id=chain_id,
    )

    # Initialize the agent
    agent_executor, agent_config = initialize_agent(config)

    # Save the wallet data after successful initialization
    new_wallet_data = {
        "private_key": private_key,
        "chain_id": chain_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        if not wallet_data
        else wallet_data.get("created_at"),
    }

    with open(wallet_file, "w") as f:
        json.dump(new_wallet_data, f, indent=2)
        print(f"Wallet data saved to {wallet_file}")

    return agent_executor, agent_config


# Autonomous Mode
def run_autonomous_mode(agent_executor, config, interval=10):
    """Run the agent autonomously with specified intervals."""
    print("Starting autonomous mode...")
    while True:
        try:
            # Provide instructions autonomously
            thought = (
                "Be creative and do something interesting on the blockchain. "
                "Choose an action or set of actions and execute it that highlights your abilities."
            )

            # Run agent in autonomous mode
            for chunk in agent_executor.stream(
                {"messages": [HumanMessage(content=thought)]}, config
            ):
                if "agent" in chunk:
                    print(chunk["agent"]["messages"][0].content)
                elif "tools" in chunk:
                    print(chunk["tools"]["messages"][0].content)
                print("-------------------")

            # Wait before the next action
            time.sleep(interval)

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


# Chat Mode
def run_chat_mode(agent_executor, config):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break

            # Run agent with the user's input in chat mode
            for chunk in agent_executor.stream(
                {"messages": [HumanMessage(content=user_input)]}, config
            ):
                if "agent" in chunk:
                    print(chunk["agent"]["messages"][0].content)
                elif "tools" in chunk:
                    print(chunk["tools"]["messages"][0].content)
                print("-------------------")

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


# Mode Selection
def choose_mode():
    """Choose whether to run in autonomous or chat mode based on user input."""
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


def main():
    """Start the chatbot agent."""
    # Load environment variables
    load_dotenv()

    # Set up the agent
    agent_executor, agent_config = setup()

    # Run the agent in the selected mode
    mode = choose_mode()
    if mode == "chat":
        run_chat_mode(agent_executor=agent_executor, config=agent_config)
    elif mode == "auto":
        run_autonomous_mode(agent_executor=agent_executor, config=agent_config)


if __name__ == "__main__":
    print("Starting Agent...")
    main()
