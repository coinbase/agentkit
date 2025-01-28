import os
import sys

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper

# agent modifier
AGENT_MODIFIER = """
You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit.
You are empowered to interact onchain using your tools.

If you ever need funds, you can request them from the faucet if you are on network ID 'base-sepolia'.
If not, you can provide your wallet details and request funds from the user.

Before executing your first action, get the wallet details to see what network you're on.
If there is a 5XX (internal) HTTP error code, ask the user to try again later.

If someone asks you to do something you can't do with your currently available tools, you must say so.
Encourage them to implement it themselves using the CDP SDK + Agentkit.
Recommend they go to docs.cdp.coinbase.com for more information.

Be concise and helpful with your responses.
Refrain from restating your tools' descriptions unless it is explicitly requested.
"""

# persisted cdp mpc wallet data
WALLET_DATA_FILE = "wallet_data.txt"


def initialize_agent():
    """Initialize the CDP Agentkit.

    Returns:
        tuple: Agentkit and its config.

    """
    # llm
    llm = ChatOpenAI(model="gpt-4o-mini")

    # load wallet file if exists
    wallet_data = None
    if os.path.exists(WALLET_DATA_FILE):
        with open(WALLET_DATA_FILE, 'r') as f:
            wallet_data = f.read()

    # agentkit
    agentkit_config = {
        "cdp_wallet_data": wallet_data
    }

    agentkit = CdpAgentkitWrapper(**agentkit_config)

    # toolkit
    cdp_toolkit = CdpToolkit.from_cdp_agentkit_wrapper(agentkit)
    tools = cdp_toolkit.get_tools()

    # store conversation history in memory
    memory = MemorySaver()

    # agent
    agent_config = {
        "configurable": {
            "thread_id": "CDP AgentKit Wallet Import Example!"
        }
    }

    agent = create_react_agent(
        llm,
        tools=tools,
        checkpointer=memory,
        state_modifier=AGENT_MODIFIER
    )

    # persist wallet
    wallet_data = agentkit.export_wallet()
    with open(WALLET_DATA_FILE, 'w') as f:
        f.write(wallet_data)

    return agent, agent_config


def main():
    """Start the agent"""
    print("initializing agent...")
    agent, config = initialize_agent()

    messages = [
        HumanMessage(content="what are my wallet details?"),
        HumanMessage(content="can you please fund my wallet with 0.01 ETH?"),
        HumanMessage(content="can you please show my updated wallet balance from the fund action?")
    ]

    stream = agent.stream({"messages": messages}, config)

    for chunk in stream:
        if "agent" in chunk:
            print(chunk["agent"]["messages"][0].content)
        elif "tools" in chunk:
            print(chunk["tools"]["messages"][0].content)
        print("-------------------")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Fatal error:", str(error))
        sys.exit(1)
