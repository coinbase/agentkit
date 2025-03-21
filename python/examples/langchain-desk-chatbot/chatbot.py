import os
import sys
import time

from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import EthAccountWalletProvider, EthAccountWalletProviderConfig
from coinbase_agentkit_langchain import get_langchain_tools
from dotenv import load_dotenv
from eth_account import Account
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from openrouter import ChatOpenRouter

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    desk_action_provider,
)

load_dotenv()


def initialize_agent():
    """Initialize the agent with CDP Agentkit."""
    # Initialize LLM
    llm = ChatOpenRouter(model="gpt-4o-mini")

    private_key = os.getenv("PRIVATE_KEY")
    assert private_key, "You must set the PRIVATE_KEY environment variable"
    assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

    chain_id = os.getenv("CHAIN_ID")
    assert chain_id, "You must set the CHAIN_ID environment variable"

    sub_account_id = os.getenv("SUB_ACCOUNT_ID")
    assert sub_account_id, "You must set the SUB_ACCOUNT_ID environment variable"

    # Optional
    rpc_url = os.getenv("RPC_URL")
    
    account = Account.from_key(private_key)

    wallet_provider = EthAccountWalletProvider(
        config=EthAccountWalletProviderConfig(account=account, chain_id=chain_id)
    )

    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                erc20_action_provider(),
                pyth_action_provider(),
                wallet_action_provider(),
                desk_action_provider(sub_account_id=sub_account_id, rpc_url=rpc_url, private_key=private_key, chain_id=chain_id),
            ],
        )
    )

    # use get_langchain_tools
    tools = get_langchain_tools(agentkit)

    # Store buffered conversation history in memory.
    memory = MemorySaver()
    config = {"configurable": {"thread_id": "CDP Agentkit Chatbot Example!"}}

    # Create ReAct Agent using the LLM and CDP Agentkit tools.
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
            "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
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
