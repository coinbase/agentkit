import asyncio
import sys

from dotenv import load_dotenv
from pydantic_ai import Agent

from setup import setup


# Autonomous Mode
async def run_autonomous_mode(agent: Agent, interval=10):
    """Run the agent autonomously with specified intervals."""
    print("Starting autonomous mode...")
    history = None
    while True:
        try:
            thought = (
                "Be creative and do something interesting on the blockchain. "
                "Choose an action or set of actions and execute it that highlights your abilities."
            )

            # Run agent in autonomous mode
            output = await agent.run(thought, message_history=history)

            history = output.all_messages()
            print(output.output)
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
    history = None
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break

            # Run agent with the user's input in chat mode
            output = await agent.run(user_input, message_history=history)

            history = output.all_messages()
            print(output.output)
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

    # Initialize the agent
    agent = await setup()

    print("\nWelcome to the CDP Agent Chatbot!")
    print("Type 'exit' to quit the chat.\n")

    # Run the agent in the selected mode
    mode = choose_mode()
    if mode == "chat":
        await run_chat_mode(agent=agent)
    elif mode == "auto":
        await run_autonomous_mode(agent=agent)


if __name__ == "__main__":
    print("Starting Agent...")
    asyncio.run(main())
