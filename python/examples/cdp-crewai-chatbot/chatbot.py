import os
import sys
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from crewai import Agent, Crew, Task
from cdp_crewai.agent_toolkits import CdpToolkit
from cdp_crewai.utils import CdpAgentkitWrapper

# Configure a file to persist the agent's CDP MPC Wallet Data
wallet_data_file = "wallet_data.txt"

load_dotenv()

def validate_environment():
    """Validate that required environment variables are set."""
    required_vars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print("Error: Required environment variables are not set")
        for var in missing_vars:
            print(f"{var}=your_{var.lower()}_here")
        sys.exit(1)
    
    if not os.getenv("NETWORK_ID"):
        print("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet")

def initialize_web3_agent():
    """Initialize the Web3 Agent with CDP tools."""
    print("Initializing Web3 Agent...")

    wallet_data = None

    if os.path.exists(wallet_data_file):
        with open(wallet_data_file) as f:
            wallet_data = f.read()

    # Configure CDP Agentkit Langchain Extension.
    values = {}
    if wallet_data is not None:
        # If there is a persisted agentic wallet, load it and pass to the CDP Agentkit Wrapper.
        values = {"cdp_wallet_data": wallet_data}
    
    # Initialize CDP wrapper and toolkit
    cdp_wrapper = CdpAgentkitWrapper(**values)
    toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp_wrapper)
    
    # Create the Web3 Agent with tracing disabled
    web3_agent = Agent(
        role='Web3 Agent',
        goal='Help users interact with blockchain',
        backstory='I am an expert in blockchain interactions and Web3 technologies',
        tools=toolkit.get_tools(),
        verbose=False,
        llm=ChatOpenAI(model_name="gpt-4o"),

    )
    
    return web3_agent

def create_task(prompt: str, agent) -> Task:
    """Create a task for the agent."""
    return Task(
        description=prompt,
        agent=agent,
        expected_output="Successfully completed Web3 interaction or provided relevant information"
    )

def main():
    validate_environment()
    web3_agent = initialize_web3_agent()
    print("Agent ready! Type 'exit' to end the chat\n")
    
    while True:
        prompt = input("\nPrompt: ")
        if prompt.lower() == 'exit':
            break
            
        try:
            task = create_task(prompt, web3_agent)
            # Disable tracing and configure crew with minimal output
            os.environ["LANGCHAIN_TRACING"] = "false"
            os.environ["OPENAI_TRACING"] = "false"
            
            crew = Crew(
                agents=[web3_agent],
                tasks=[task],
                verbose=False,
                process_inputs=False
            )
            result = crew.kickoff()
            print("\n-------------------")
            print(result)
            print("-------------------")
        except Exception as e:
            print(f"Error: {str(e)}")
            print("Please try your request again")

if __name__ == "__main__":
    main() 