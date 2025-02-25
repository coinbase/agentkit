import os
import sys
import json
import time

from dotenv import load_dotenv

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

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

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3

from litActionProvider import lit_action_provider
from litAgentWalletProvider import lit_agent_wallet_provider

from agent_wallet_python.client import AgentWalletClient

load_dotenv()


def initialize_agent():
    """Initialize the agent with EVM Agentkit."""
    # Initialize LLM
    llm = ChatOpenAI(model="gpt-4o-mini")

    # Load EVM_PRIVATE_KEY from .env
    evm_private_key = os.getenv("EVM_PRIVATE_KEY")
    if not evm_private_key:
        raise ValueError("EVM_PRIVATE_KEY not found in .env file. Please add it.")

    # Create a LocalAccount object from the private key
    account: LocalAccount = Account.from_key(evm_private_key)

    # Set the chain ID for Base Sepolia (or Base Mainnet if needed)
    chain_id = "84532"  # Base Sepolia (use "8453" for Base Mainnet)

    # Initialize EVM Wallet Provider Config with the LocalAccount and chain_id
    evm_config = EthAccountWalletProviderConfig(
        private_key=evm_private_key,
        account=account,  # Pass the LocalAccount object
        chain_id=chain_id  # Pass the chain_id as a string
    )
    # Initialize the wallet provider
    wallet_provider = EthAccountWalletProvider(evm_config)

    # Initialize AgentKit
    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[
            erc20_action_provider(),
            pyth_action_provider(),
            wallet_action_provider(),
            weth_action_provider(),
            lit_action_provider(),
            lit_agent_wallet_provider(),
        ]
    ))

    # Use get_langchain_tools
    tools = get_langchain_tools(agentkit)

    # Store buffered conversation history in memory.
    memory = MemorySaver()
    config = {"configurable": {"thread_id": "EVM Agentkit Chatbot Example!"}}

    # Create ReAct Agent using the LLM and EVM Agentkit tools.
    return create_react_agent(
        llm,
        tools=tools,
        checkpointer=memory,
        state_modifier=(
            "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
            "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
            "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
            "details and request funds from the user. Before executing your first action, get the wallet details "
            "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
            "again later. If someone asks you to do something you can't do with your currently available tools, "
            "you must say so, and encourage them to implement it themselves using the EVM SDK + Agentkit, "
            "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
            "responses. Refrain from restating your tools' descriptions unless it is explicitly requested."
        ),
    ), config


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
    agent_executor, config = initialize_agent()

    mode = choose_mode()
    if mode == "chat":
        run_chat_mode(agent_executor=agent_executor, config=config)
    elif mode == "auto":
        run_autonomous_mode(agent_executor=agent_executor, config=config)


if __name__ == "__main__":
    print("Starting Agent...")
    main()
