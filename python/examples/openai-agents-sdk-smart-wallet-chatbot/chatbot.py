import asyncio
import json
import os
import sys
import time

from agents.agent import Agent
from agents.run import Runner
from cdp import CdpClient
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmSmartWalletProvider,
    CdpEvmSmartWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from coinbase_agentkit_openai_agents_sdk import get_openai_agents_sdk_tools
from dotenv import load_dotenv


def initialize_agent(config: CdpEvmSmartWalletProviderConfig):
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the CDP EVM Smart Wallet Provider

    Returns:
        Agent: The initialized agent

    """
    # Initialize the wallet provider with the config
    wallet_provider = CdpEvmSmartWalletProvider(
        CdpEvmSmartWalletProviderConfig(
            api_key_id=config.api_key_id,  # CDP API Key ID
            api_key_secret=config.api_key_secret,  # CDP API Key Secret
            wallet_secret=config.wallet_secret,  # CDP Wallet Secret
            owner=config.owner,  # Owner - Either private key or server wallet address
            address=config.address,  # Smart Wallet Address - Optional, will create new if not provided
            network_id=config.network_id,  # Network ID - Optional, will default to 'base-sepolia'
            paymaster_url=config.paymaster_url,  # Optional paymaster URL to sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
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
            ],
        )
    )

    # Get tools for the agent
    tools = get_openai_agents_sdk_tools(agentkit)

    # Create Agent using the OpenAI Agents SDK
    return Agent(
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
        ),
        tools=tools,
    ), wallet_provider


def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        Agent: The initialized agent

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

    # Get required CDP credentials
    api_key_id = os.getenv("CDP_API_KEY_ID")
    api_key_secret = os.getenv("CDP_API_KEY_SECRET")
    wallet_secret = os.getenv("CDP_WALLET_SECRET")

    if not all([api_key_id, api_key_secret, wallet_secret]):
        raise ValueError("CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET are required")

    # Check for environment variables first
    owner_private_key = os.getenv("OWNER_PRIVATE_KEY")
    owner_server_address = os.getenv("OWNER_SERVER_WALLET_ADDRESS")
    smart_wallet_address_env = os.getenv("SMART_WALLET_ADDRESS")

    # Determine where to get wallet configuration from (env vars or saved file)
    use_env_vars = (owner_private_key or owner_server_address) and smart_wallet_address_env
    use_wallet_file = (
        wallet_data.get("owner_value")
        and wallet_data.get("owner_type")
        and wallet_data.get("smart_wallet_address")
    )

    owner_value = None
    owner_type = None
    smart_wallet_address = None

    # Prioritize environment variables over saved wallet file
    if use_env_vars:
        # Use environment variables
        print("Using wallet configuration from environment variables")
        if owner_private_key:
            owner_value = owner_private_key
            owner_type = "private_key"
        else:
            owner_value = owner_server_address
            owner_type = "server_address"
        smart_wallet_address = smart_wallet_address_env
    elif use_wallet_file:
        # Use saved wallet file
        print("Using wallet configuration from saved wallet file")
        owner_value = wallet_data.get("owner_value")
        owner_type = wallet_data.get("owner_type")
        smart_wallet_address = wallet_data.get("smart_wallet_address")
    else:
        # If using just one part from env and missing the other, print a warning
        if owner_private_key or owner_server_address:
            print("Warning: Owner specified in environment, but no SMART_WALLET_ADDRESS found")
            if owner_private_key:
                owner_value = owner_private_key
                owner_type = "private_key"
            else:
                owner_value = owner_server_address
                owner_type = "server_address"
        elif smart_wallet_address_env:
            print("Warning: SMART_WALLET_ADDRESS specified in environment, but no owner found")
            smart_wallet_address = smart_wallet_address_env

        # Fall back to partial info from wallet file if available
        if not owner_value and wallet_data.get("owner_value"):
            print("Using owner from saved wallet file")
            owner_value = wallet_data.get("owner_value")
            owner_type = wallet_data.get("owner_type")

        if not smart_wallet_address and wallet_data.get("smart_wallet_address"):
            print("Using smart wallet address from saved wallet file")
            smart_wallet_address = wallet_data.get("smart_wallet_address")

    # If no owner is provided, create a new server wallet to be used as the owner
    if not owner_value:
        print("No owner provided, creating new server wallet...")
        idempotency_key = os.getenv("OWNER_IDEMPOTENCY_KEY")

        # Create a new server wallet using CDP
        client = CdpClient(
            api_key_id=api_key_id,
            api_key_secret=api_key_secret,
            wallet_secret=wallet_secret,
        )

        async def create_wallet():
            async with client as cdp:
                account = await cdp.evm.create_account(idempotency_key=idempotency_key)
                return account.address

        owner_value = asyncio.run(create_wallet())
        owner_type = "server_address"
        print(f"Created new server wallet: {owner_value}")

    # Create the wallet provider config
    config = CdpEvmSmartWalletProviderConfig(
        api_key_id=api_key_id,
        api_key_secret=api_key_secret,
        wallet_secret=wallet_secret,
        network_id=network_id,
        address=smart_wallet_address,
        owner=owner_value,
        paymaster_url=os.getenv(
            "PAYMASTER_URL"
        ),  # Optional paymaster URL to sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    )

    # Initialize the agent and get the wallet provider
    agent, wallet_provider = initialize_agent(config)

    # Save the wallet data after successful initialization
    new_wallet_data = {
        "smart_wallet_address": wallet_provider.get_address(),
        "owner_value": owner_value,
        "owner_type": owner_type,
        "network_id": network_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        if not wallet_data
        else wallet_data.get("created_at"),
    }

    with open(wallet_file, "w") as f:
        json.dump(new_wallet_data, f, indent=2)
        print(f"Wallet data saved to {wallet_file}")

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
    agent = setup()

    # Run the agent in the selected mode
    mode = choose_mode()
    if mode == "chat":
        await run_chat_mode(agent=agent)
    elif mode == "auto":
        await run_autonomous_mode(agent=agent)


if __name__ == "__main__":
    print("Starting Agent...")
    asyncio.run(main())
