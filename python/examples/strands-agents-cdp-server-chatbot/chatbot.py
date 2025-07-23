import json
import os
import sys
import time

import botocore.exceptions
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    allora_action_provider,
    cdp_api_action_provider,
    compound_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
    wow_action_provider,
)
from coinbase_agentkit_strands_agents import get_strands_tools
from dotenv import load_dotenv
from strands import Agent
from strands.models import BedrockModel


def validate_environment():
    """Validate required environment variables are present."""
    required_vars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]

    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)


def initialize_agent(config: CdpEvmWalletProviderConfig):
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the CDP EVM Server Wallet Provider

    Returns:
        tuple[Agent, CdpEvmServerWalletProvider]: The initialized agent and wallet provider

    """
    # Initialize the wallet provider with the config
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
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
                pyth_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
                wow_action_provider(),
                compound_action_provider(),
                allora_action_provider(),
            ],
        )
    )

    # Get tools for the agent
    tools = get_strands_tools(agentkit)

    # Create a BedrockModel
    bedrock_model = BedrockModel(
        model_id="us.amazon.nova-pro-v1:0",
        max_tokens=500,
        region_name=os.getenv("AWS_REGION"),
        temperature=1,  # Greedy Decoding parameters for Amazon Nova Models requires all inference paramters be set to 1
    )

    # Create Agent using the Strands Agents SDK
    agent = Agent(
        model=bedrock_model,
        tools=tools,
        system_prompt=""""You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit.
You are empowered to interact onchain using your tools. If you ever need funds, you can request them from the faucet if you are on network ID 'base-sepolia'.
If not, you can provide your wallet details and request funds from the user. Before executing your first action, get the wallet details to see what network you're on.
If there is a 5XX (internal) HTTP error code, ask the user to try again later.
If someone asks you to do something you can't do with your currently available tools, you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more information.
For evry transaction done, provide the full trasaction hash number with your response.
Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
""",
    )

    return agent, wallet_provider


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


# Autonomous Mode
def run_autonomous_mode(agent, interval=10):
    """Run the agent autonomously with specified intervals."""
    print("Starting autonomous mode...")
    while True:
        try:
            thought = """Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities."""

            # Run agent in autonomous mode
            print(agent(thought))
            print("-------------------")

            # Wait before the next action
            time.sleep(interval)

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


# Chat Mode
def run_chat_mode(agent):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break
            if not user_input.strip():
                continue
            # Run agent with the user's input in chat mode
            print(agent(user_input))
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
    try:
        # Validate environment
        validate_environment()

        # Load environment variables
        load_dotenv()

        # Set up the agent
        agent = setup()

        # Run the agent in the selected mode
        mode = choose_mode()
        if mode == "chat":
            run_chat_mode(agent=agent)
        elif mode == "auto":
            run_autonomous_mode(agent=agent)
    except botocore.exceptions.NoCredentialsError:
        print("\n❌ AWS Credentials Error:")
        print("Unable to locate AWS credentials. Please ensure you have:")
        print("  1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, OR")
        print("  2. Set AWS_BEARER_TOKEN_BEDROCK environment variable, OR")
        print("  3. Configured AWS credentials file (~/.aws/credentials), OR")
        print("  4. Set up an IAM role (if running on AWS infrastructure)")
        print(
            "\nFor more information, visit: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html"
        )
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nShutdown requested...")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


def print_banner():
    """Display a box-style banner for the application."""
    title = "Coinbase AgentKit with Strands Agents"
    width = len(title) + 4

    print("╔" + "═" * width + "╗")
    print("║" + " " * width + "║")
    print("║  " + title + "  ║")
    print("║" + " " * width + "║")
    print("╚" + "═" * width + "╝")


if __name__ == "__main__":
    print_banner()
    print("Starting Agent...")
    main()
