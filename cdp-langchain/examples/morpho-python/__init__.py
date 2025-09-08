import os
from langchain_core.messages import HumanMessage
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# Configure wallet persistence
wallet_data_file = "morpho_wallet_data.txt"


def initialize_agent():
    """Initialize the agent with CDP Agentkit and persistent wallet."""
    # Initialize LLM
    llm = ChatOpenAI(model="gpt-4o-mini")

    # Load existing wallet data if available
    wallet_data = None
    if os.path.exists(wallet_data_file):
        with open(wallet_data_file) as f:
            wallet_data = f.read()

    # Initialize CDP wrapper with existing wallet if available
    values = {}
    if wallet_data is not None:
        values = {"cdp_wallet_data": wallet_data}

    cdp = CdpAgentkitWrapper(**values)

    # Persist the wallet data
    wallet_data = cdp.export_wallet()
    with open(wallet_data_file, "w") as f:
        f.write(wallet_data)

    # Create toolkit and get tools
    toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)
    tools = toolkit.get_tools()

    # Add debug logging to see available tools
    print("Available tools:", [tool.name for tool in tools])

    # Add memory for conversation history
    memory = MemorySaver()
    config = {"configurable": {"thread_id": "CDP Morpho Integration Example"}}

    return create_react_agent(
        llm,
        tools=tools,
        checkpointer=memory,
        state_modifier="""You are a helpful agent specialized in interacting with Morpho Protocol using CDP Agentkit. 
        For wrapping ETH to WETH, you must ONLY use the wrap_native action.
        The WETH contract already exists at 0x4200000000000000000000000000000000000006 on Base Mainnet.
        
        You can help users deposit and interact with Morpho vaults. If you need funds, you can request them from the faucet since we're on base-Mainnet network.""",
    ), config


def main():
    """Main execution function"""
    agent_executor, config = initialize_agent()

    # First, request funds from faucet
    faucet_prompt = """
    I need to deposit some WETH into Morpho, but first I need some funds. 
    Please request funds from the faucet since we're on base-mainnet network.
    """

    print("Requesting funds from faucet...")
    try:
        for chunk in agent_executor.stream(
            {"messages": [HumanMessage(content=faucet_prompt)]}, config, stream_mode="values"
        ):
            if "messages" in chunk:
                chunk["messages"][-1].pretty_print()
            else:
                print("\nRAW CHUNK:", chunk)
            print("-------------------")
    except Exception as e:
        print(f"Error during faucet request: {e}")

    # Add wrapping ETH to WETH step
    wrap_prompt = """
    SYSTEM: You must use the wrap_native action available in the toolkit to wrap ETH to WETH.
    
    ACTION REQUIRED: wrap_native
    Parameters:
    - weth_address: "0x4200000000000000000000000000000000000006"
    - amount: 0.01 ETH

    if we have enough funds, bypass this step.
    """

    print("\nWrapping ETH to WETH...")
    try:
        for chunk in agent_executor.stream(
            {"messages": [HumanMessage(content=wrap_prompt)]}, config, stream_mode="values"
        ):
            if "messages" in chunk:
                chunk["messages"][-1].pretty_print()
            else:
                print("\nRAW CHUNK:", chunk)
            print("-------------------")
    except Exception as e:
        print(f"Error during ETH wrapping: {e}")

    # Update Morpho deposit interaction to use 0.01 WETH
    morpho_prompt = """
    Now that we have WETH, please deposit WETH into the Morpho Vault:
    - Vault address: 0xb754c2a7FF8493CE1404E5ecFDE562e8f023DEF6
    - WETH token address: 0x4200000000000000000000000000000000000006
    - Amount: 0.01 WETH 
    - Use my wallet main address as the receiver address
    """

    print("\nExecuting Morpho interaction...")
    try:
        for chunk in agent_executor.stream(
            {"messages": [HumanMessage(content=morpho_prompt)]}, config, stream_mode="values"
        ):
            # Pretty print the messages for better readability
            if "messages" in chunk:
                chunk["messages"][-1].pretty_print()
            else:
                print("\nRAW CHUNK:", chunk)
            print("-------------------")
    except Exception as e:
        print(f"Error during execution: {e}")


if __name__ == "__main__":
    print("Starting Morpho Integration...")
    main()