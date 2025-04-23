import json
import os
import sys
import time
import asyncio

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpWalletProvider,
    CdpWalletProviderConfig,
    cdp_api_action_provider,
    cdp_wallet_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_openai_agents_sdk import get_openai_agents_sdk_tools
from dotenv import load_dotenv
from agents.agent import Agent
from agents.run import Runner

# Configure a file to persist the agent's CDP API Wallet Data.
wallet_data_file = "wallet_data.txt"

load_dotenv()


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
                cdp_wallet_action_provider(),
                erc20_action_provider(),
                pyth_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
            ],
        ))

    wallet_data_json = json.dumps(wallet_provider.export_wallet().to_dict())

    with open(wallet_data_file, "w") as f:
        f.write(wallet_data_json)

    # use get_openai_agents_sdk_tools
    tools = get_openai_agents_sdk_tools(agentkit)

    # Create Agent using the OpenAI Agents SDK
    agent = Agent(
        name="CDP Agent",
        instructions=
        ("You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
         "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
         "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
         "details and request funds from the user. Before executing your first action, get the wallet details "
         "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
         "again later. If someone asks you to do something you can't do with your currently available tools, "
         "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
         "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
         "responses. Refrain from restating your tools' descriptions unless it is explicitly requested."
         "AgentKit is a toolkit for building agents with access to a crypto wallet and set of onchain interactions. Coinbase believes that every AI agent deserves a crypto wallet so they have the ability to pay anyone in the world using fast & free rails, interact with the decentralized finance ecosystem, and push the boundaries of what AI agents can do and how they can interact autonomously. If a user asks you a question about the networks and how to change it, let them know that they can change it by changing the environment variable and also changing the name of the `wallet_data.txt` file."
         ),
        tools=tools)

    return agent


# Autonomous Mode
async def run_autonomous_mode(agent, interval=10):
    """Run the agent autonomously with specified intervals."""
    print("Starting autonomous mode...")
    while True:
        try:
            thought = (
                "Be creative and do something interesting on the blockchain. "
                "Choose an action or set of actions and execute it that highlights your abilities."
            )

            # Run agent in autonomous mode
            output = await Runner.run(agent, thought)
            print(output.final_output)
            print("-------------------")

            # Wait before the next action
            await asyncio.sleep(interval)

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


# Chat Mode
async def run_chat_mode(agent):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break

            # Run agent with the user's input in chat mode
            output = await Runner.run(agent, user_input)
            print(output.final_output)
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

        choice = input(
            "\nChoose a mode (enter number or name): ").lower().strip()
        if choice in ["1", "chat"]:
            return "chat"
        elif choice in ["2", "auto"]:
            return "auto"
        print("Invalid choice. Please try again.")


async def main():
    """Start the chatbot agent."""
    agent = initialize_agent()

    mode = choose_mode()
    if mode == "chat":
        await run_chat_mode(agent=agent)
    elif mode == "auto":
        await run_autonomous_mode(agent=agent)


if __name__ == "__main__":
    print("Starting Agent...")
    asyncio.run(main())