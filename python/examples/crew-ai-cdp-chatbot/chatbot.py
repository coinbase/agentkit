import asyncio
import json
import os
import sys
import time

from crewai import Agent, Crew, Task
from dotenv import load_dotenv

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    X402Config,
    cdp_api_action_provider,
    cdp_evm_wallet_action_provider,
    erc20_action_provider,
    pyth_action_provider,
    wallet_action_provider,
    weth_action_provider,
    x402_action_provider,
)
from coinbase_agentkit_crewai import get_crewai_tools


def initialize_agent(config: CdpEvmWalletProviderConfig) -> tuple[Agent, CdpEvmWalletProvider]:
    """Initialize a CrewAI agent with CDP AgentKit tools."""
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
            api_key_id=config.api_key_id,
            api_key_secret=config.api_key_secret,
            wallet_secret=config.wallet_secret,
            network_id=config.network_id,
            address=config.address,
            idempotency_key=config.idempotency_key,
            rpc_url=config.rpc_url,
        )
    )

    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                cdp_api_action_provider(),
                cdp_evm_wallet_action_provider(),
                erc20_action_provider(),
                pyth_action_provider(),
                wallet_action_provider(),
                weth_action_provider(),
                x402_action_provider(
                    X402Config(
                        registered_services=["https://www.x402.org/protected"]
                        if config.network_id == "base-sepolia"
                        else [],
                        allow_dynamic_service_registration=False,
                        max_payment_usdc=1.0,
                        registered_facilitators={
                            "my-custom-facilitator": "https://my-custom-facilitator.example.com",
                        },
                    )
                ),
            ],
        )
    )

    tools = get_crewai_tools(agentkit)

    agent = Agent(
        role="CDP Agent",
        goal="Help users interact onchain with Coinbase Developer Platform AgentKit tools.",
        backstory=(
            "You are a concise and careful onchain assistant. Before executing your first "
            "action, check wallet details so you know which network you are using. If the "
            "wallet needs funds on base-sepolia, use the faucet. If a request cannot be "
            "completed with the available tools, say so and point the user to "
            "docs.cdp.coinbase.com."
        ),
        llm=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        tools=tools,
        verbose=True,
        allow_delegation=False,
    )

    return agent, wallet_provider


def setup() -> Agent:
    """Set up the CrewAI agent with persistent wallet storage."""
    network_id = os.getenv("NETWORK_ID", "base-sepolia")
    wallet_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    wallet_data = {}
    if os.path.exists(wallet_file):
        try:
            with open(wallet_file) as f:
                wallet_data = json.load(f)
                print(f"Loading existing wallet from {wallet_file}")
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data for {network_id}")
            wallet_data = {}

    wallet_address = wallet_data.get("address") or os.getenv("ADDRESS") or None

    config = CdpEvmWalletProviderConfig(
        api_key_id=os.getenv("CDP_API_KEY_ID"),
        api_key_secret=os.getenv("CDP_API_KEY_SECRET"),
        wallet_secret=os.getenv("CDP_WALLET_SECRET"),
        network_id=network_id,
        address=wallet_address,
        idempotency_key=(os.getenv("IDEMPOTENCY_KEY") if not wallet_address else None),
        rpc_url=os.getenv("RPC_URL"),
    )

    agent, wallet_provider = initialize_agent(config)

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


def run_prompt(agent: Agent, prompt: str) -> str:
    """Run a single user prompt through a one-task CrewAI crew."""
    task = Task(
        description=f"Handle this user request with the available AgentKit tools:\n\n{prompt}",
        expected_output="A concise response with any relevant transaction hashes, links, or wallet details.",
        agent=agent,
    )
    crew = Crew(agents=[agent], tasks=[task], verbose=True)
    return str(crew.kickoff())


async def run_autonomous_mode(agent: Agent, interval: int = 10) -> None:
    """Run the agent autonomously with a delay between tasks."""
    print("Starting autonomous mode...")
    while True:
        try:
            output = run_prompt(
                agent,
                "Choose one useful onchain action that highlights your abilities.",
            )
            print(output)
            print("-------------------")
            await asyncio.sleep(interval)
        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


async def run_chat_mode(agent: Agent) -> None:
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break

            print(run_prompt(agent, user_input))
            print("-------------------")
        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


def choose_mode() -> str:
    """Choose whether to run in autonomous or chat mode based on user input."""
    while True:
        print("\nAvailable modes:")
        print("1. chat    - Interactive chat mode")
        print("2. auto    - Autonomous action mode")

        choice = input("\nChoose a mode (enter number or name): ").lower().strip()
        if choice in ["1", "chat"]:
            return "chat"
        if choice in ["2", "auto"]:
            return "auto"
        print("Invalid choice. Please try again.")


async def main() -> None:
    """Start the chatbot agent."""
    load_dotenv()

    agent = setup()

    print("\nWelcome to the CDP AgentKit CrewAI Chatbot!")
    print("Type 'exit' to quit the chat.\n")

    mode = choose_mode()
    if mode == "chat":
        await run_chat_mode(agent=agent)
    elif mode == "auto":
        await run_autonomous_mode(agent=agent)


if __name__ == "__main__":
    print("Starting Agent...")
    asyncio.run(main())
