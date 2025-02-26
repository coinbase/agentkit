import os
import sys
import json
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from eth_account.account import Account

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    SmartWalletProvider,
    SmartWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_langchain import get_langchain_tools

wallet_data_file = "wallet_data.txt"

load_dotenv()

def initialize_agent():
    """Initialize the agent with SmartWalletProvider."""
    llm = ChatOpenAI(model="gpt-4o-mini")
    
    # Load wallet data from JSON file
    wallet_data = {
        "private_key": None,
        "smart_wallet_address": None
    }
    if os.path.exists(wallet_data_file):
        try:
            with open(wallet_data_file) as f:
                wallet_data = json.load(f)
        except json.JSONDecodeError:
            print("Warning: Invalid wallet data file format. Creating new wallet.")
    
    # Use private key from env if not in wallet data
    private_key = wallet_data.get("private_key") or os.getenv("PRIVATE_KEY")
    
    if not private_key:
        raise ValueError("PRIVATE_KEY environment variable is required")
    
    network_id = os.getenv("NETWORK_ID", "base-sepolia")

    # Convert private key string to LocalAccount
    signer = Account.from_key(private_key)
    
    smart_wallet_provider = SmartWalletProvider(SmartWalletProviderConfig(
        network_id=network_id,
        signer=signer,
        smart_wallet_address=wallet_data.get("smart_wallet_address"),
    ))
    
    # Save both private key and smart wallet address
    wallet_data = {
        "private_key": private_key,
        "smart_wallet_address": smart_wallet_provider.get_address()
    }
    with open(wallet_data_file, "w") as f:
        json.dump(wallet_data, f, indent=2)
    
    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=smart_wallet_provider,
        action_providers=[
            cdp_api_action_provider(),
            erc20_action_provider(),
            pyth_action_provider(),
            wallet_action_provider(),
            weth_action_provider(),
        ]
    ))
    
    tools = get_langchain_tools(agentkit)
    memory = MemorySaver()
    config = {"configurable": {"thread_id": "Smart Wallet Chatbot Example!"}}
    
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
            "responses."
        ),
    ), config

def run_chat_mode(agent_executor, config):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break
            for chunk in agent_executor.stream({"messages": [HumanMessage(content=user_input)]}, config):
                if "agent" in chunk:
                    print(chunk["agent"]["messages"][0].content)
                elif "tools" in chunk:
                    print(chunk["tools"]["messages"][0].content)
                print("-------------------")
        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)

def main():
    """Start the chatbot agent."""
    agent_executor, config = initialize_agent()
    run_chat_mode(agent_executor=agent_executor, config=config)

if __name__ == "__main__":
    print("Starting Agent...")
    main()
