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
)
from coinbase_agentkit_pydantic_ai import get_pydantic_ai_tools
from pydantic_ai import Agent


async def initialize_agent(config: CdpEvmWalletProviderConfig):
    """Initialize the agent with the provided configuration.

    Args:
        config: Configuration object for the wallet provider

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration

    """
    # Initialize CDP Server Wallet Provider
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
            api_key_id=config.api_key_id,
            api_key_secret=config.api_key_secret,
            wallet_secret=config.wallet_secret,
            network_id=config.network_id,
            address=config.address,
            idempotency_key=config.idempotency_key,
        )
    )

    # Initialize AgentKit
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

    # Get Pydantic AI tools
    tools = get_pydantic_ai_tools(agentkit)

    # Create Agent using Pydantic AI
    agent = Agent(
        model="openai:gpt-4o-mini",
        name="CDP Agent",
        system_prompt=(
            "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
            "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
            "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
            "details and request funds from the user. Before executing your first action, get the wallet details "
            "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
            "again later. If someone asks you to do something you can't do with your currently available tools, "
            "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
            "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
            "responses. Refrain from restating your tools' descriptions unless it is explicitly requested."
            "AgentKit is a toolkit for building agents with access to a crypto wallet and set of onchain interactions. "
            "Coinbase believes that every AI agent deserves a crypto wallet so they have the ability to pay anyone in "
            "the world using fast & free rails, interact with the decentralized finance ecosystem, and push the "
            "boundaries of what AI agents can do and how they can interact autonomously. If a user asks you a question "
            "about the networks and how to change it, let them know that they can change it by changing the environment "
            "variable and also changing the name of the `wallet_data.txt` file."
        ),
        tools=tools,
    )

    return agent, wallet_provider
