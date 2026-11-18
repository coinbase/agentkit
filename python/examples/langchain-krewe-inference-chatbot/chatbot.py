"""LangChain chatbot example: AgentKit + krewe x402-paywalled inference.

The agent has a CDP-managed Base wallet and four pay-per-call inference tools
through krewe (https://www.krewe.world), accessed via AgentKit's built-in
x402 action provider. Each call settles per-request in USDC on Base
(EIP-3009 ``transferWithAuthorization``) — no API keys, no provisioning.

Pricing (USDC base units / 6 decimals):
  text.structure  $0.005    text.embed       $0.01
  web.scrape      $0.02     text.complete    $0.05

Every USDC paid here flows back to the miners that answered the job via
krewe's hourly USDC → $KREW buyback recycler. Closes the circular economy.
"""

import os
import sys
import time

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    X402Config,
    cdp_api_action_provider,
    cdp_evm_wallet_action_provider,
    erc20_action_provider,
    wallet_action_provider,
    x402_action_provider,
)
from coinbase_agentkit_langchain import get_langchain_tools
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

load_dotenv()

DEFAULT_KREWE_PREDICT_URL = "https://krewe-orchestrator-production.up.railway.app/v2/predict"
DEFAULT_MAX_PAYMENT_USDC = 0.10


def initialize_agent(config: CdpEvmWalletProviderConfig):
    """Initialize the LangChain agent with AgentKit + krewe x402 inference.

    Args:
        config: Configuration for the CDP EVM Server Wallet Provider.

    Returns:
        tuple[Agent, CdpEvmWalletProvider]: The initialized agent and wallet provider.
    """
    llm = ChatOpenAI(model="gpt-4o-mini")

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

    krewe_url = os.getenv("KREWE_PREDICT_URL", DEFAULT_KREWE_PREDICT_URL)
    max_payment_usdc = float(os.getenv("KREWE_MAX_PAYMENT_USDC", DEFAULT_MAX_PAYMENT_USDC))

    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                cdp_api_action_provider(),
                cdp_evm_wallet_action_provider(),
                erc20_action_provider(),
                wallet_action_provider(),
                x402_action_provider(
                    X402Config(
                        registered_services=[krewe_url],
                        allow_dynamic_service_registration=False,
                        max_payment_usdc=max_payment_usdc,
                        registered_facilitators={},
                    )
                ),
            ],
        )
    )

    tools = get_langchain_tools(agentkit)

    memory = MemorySaver()
    agent_config = {"configurable": {"thread_id": "krewe Inference Chatbot Example"}}

    return (
        create_react_agent(
            llm,
            tools=tools,
            checkpointer=memory,
            state_modifier=(
                f"You are an onchain agent with access to:\n"
                f"  - A CDP EVM wallet on Base.\n"
                f"  - The krewe inference network at {krewe_url}, called via the x402 "
                f"action provider. krewe is a decentralized AI inference network — your "
                f"wallet pays USDC per call (cap: ${max_payment_usdc}). The supported "
                f"job kinds are text.structure (regex/JSON extraction, $0.005), "
                f"text.embed (sentence embeddings, $0.01), web.scrape (clean HTML "
                f"fetch, $0.02), and text.complete (small-LM completion, $0.05).\n\n"
                f"When a user asks for structured extraction, embeddings, a clean "
                f"scrape, or a quick small-model completion, prefer routing through "
                f"krewe via the x402 service — it pays krewe miners and gets a 2-of-3 "
                f"consensus output.\n\n"
                f'Always send the body: {{"kind": "...", "payload": <kind-specific JSON>}}. '
                f"If a call returns 402 'payment-required', the x402 provider handles "
                f"signing and on-chain settlement automatically — just retry once via "
                f"the same tool.\n\n"
                f"Be concise. If you can't do something with your current tools, say so."
            ),
        ),
        wallet_provider,
    ), agent_config


def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration.
    """
    network_id = os.getenv("NETWORK_ID", "base-mainnet")
    wallet_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load existing wallet data if available
    wallet_data: dict = {}
    if os.path.exists(wallet_file):
        try:
            import json

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

    (agent_executor, wallet_provider), agent_config = initialize_agent(config)

    import json

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

    return (agent_executor, agent_config)


def run_autonomous_mode(agent_executor, config, interval=30):
    """Run the agent autonomously — picks a creative krewe inference job each tick."""
    print("Starting autonomous mode...")
    while True:
        try:
            thought = (
                "Pick an interesting short snippet of text or a public URL and route a "
                "krewe job through the x402 service to do something useful with it "
                "(extract structured data, embed, summarize, or scrape). Tell me the "
                "kind you chose, the payment cost, and the resulting output."
            )
            for chunk in agent_executor.stream(
                {"messages": [HumanMessage(content=thought)]}, config
            ):
                if "agent" in chunk:
                    print(chunk["agent"]["messages"][0].content)
                elif "tools" in chunk:
                    print(chunk["tools"]["messages"][0].content)
                print("-------------------")
            time.sleep(interval)
        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


def run_chat_mode(agent_executor, config):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    print(
        'Try: "Extract emails and dates from this text: '
        'Email hi@krewe.world by 2026-05-17"'
    )
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break
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
    load_dotenv()
    agent_executor, agent_config = setup()
    mode = choose_mode()
    if mode == "chat":
        run_chat_mode(agent_executor=agent_executor, config=agent_config)
    elif mode == "auto":
        run_autonomous_mode(agent_executor=agent_executor, config=agent_config)


if __name__ == "__main__":
    print("Starting krewe-inference Agent...")
    main()
