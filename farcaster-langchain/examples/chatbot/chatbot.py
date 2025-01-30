import sys
import time
import os

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

# Import CDP Agentkit Farcaster Langchain Extension
from farcaster_langchain import (
    FarcasterApiWrapper,
    FarcasterToolkit,
)

def initialize_agent():
    """Initialize the agent with CDP Agentkit Farcaster Langchain."""
    print("Initializing agent...")

    # Initialize LLM
    print("Initializing LLM...")
    llm = ChatOpenAI(model="gpt-4o-mini")

    # Configure CDP Agentkit Farcaster Langchain Extension
    values = {
        "api_key": os.getenv("NEYNAR_API_KEY"),
        "signer_uuid": os.getenv("NEYNAR_SIGNER_UUID")
    }

    # Initialize CDP Agentkit Farcaster Langchain
    print("Setting up Farcaster wrapper...")
    print(f"Debug - values being passed: {values}")
    wrapper = FarcasterApiWrapper(**values)
    toolkit = FarcasterToolkit.from_farcaster_api_wrapper(wrapper)
    tools = toolkit.get_tools()
    print(f"Available tools: {[tool.name for tool in tools]}")

    # Store buffered conversation history in memory
    memory = MemorySaver()
    config = {"configurable": {"thread_id": "CDP Agentkit Chatbot Example!"}}

    # Create ReAct Agent using the LLM and CDP Agentkit tools
    return create_react_agent(
        llm,
        tools=tools,
        checkpointer=memory,
        state_modifier="You are a helpful agent that can interact with Farcaster using the Neynar API. You can post casts, reply to casts, and interact with the Farcaster protocol. You can post in specific channels using the channel_id parameter and include embedded URLs using the embeds parameter. If someone asks you to do something you can't do with your currently available tools, you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.",
    ), config


# Autonomous Mode
def run_autonomous_mode(agent_executor, config, interval=10):
    """Run the agent autonomously with specified intervals."""
    print("Starting autonomous mode...")
    while True:
        try:
            # Provide instructions autonomously
            thought = (
                "Be creative and do something interesting on Farcaster. "
                "Choose an action or set of actions and execute it that highlights your abilities. "
                "Consider using channels or embeds to make your casts more engaging."
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
    print("\nTip: You can specify channels with 'post in python channel: <message>'")
    print("     or include links with 'post with link: <message> | <url>'")
    
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                print("Goodbye Agent!")
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
    print("\n=== CDP Agentkit Farcaster Chatbot ===\n")
    
    try:
        agent_executor, config = initialize_agent()
        print("\nAgent initialized successfully!")
        
        mode = choose_mode()
        if mode == "chat":
            run_chat_mode(agent_executor=agent_executor, config=config)
        elif mode == "auto":
            run_autonomous_mode(agent_executor=agent_executor, config=config)
            
    except Exception as e:
        print(f"\nError initializing agent: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    print("Starting Agent...")
    main() 