# CDP AgentKit Extension - CrewAI Toolkit

CDP integration with CrewAI to enable agentic workflows using the core primitives defined in `cdp-agentkit-core`.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Python 3.10 or higher

### Installation

```bash
pip install cdp-crewai
```


### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_NAME="your_api_key_name"
export CDP_API_KEY_PRIVATE_KEY="your_api_key_private_key"
export MNEMONIC_PHRASE="your_mnemonic_phrase"
export NETWORK_ID="your_network_id"
```


## Usage

### Basic Setup

```python
from cdp_crewai.agent_toolkits import CdpToolkit
from cdp_crewai.utils import CdpAgentkitWrapper

# Initialize the wrapper
wrapper = CdpAgentkitWrapper()

# Create toolkit from wrapper
toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)

# Get available tools
tools = toolkit.get_tools()
for tool in tools:
    print(tool.name)
```

The toolkit provides the following tools:
[List of tools from CDP AgentKit Core]

### Using with CrewAI

```python
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI

# Initialize LLM
llm = ChatOpenAI(model="gpt-4")

# Create an agent with CDP tools
crypto_agent = Agent(
    role='Crypto Expert',
    goal='Execute crypto transactions efficiently',
    backstory='Expert in blockchain and cryptocurrency operations',
    tools=toolkit.get_tools(),
    llm=llm
)

# Create a task
task = Task(
    description='Transfer 0.01 ETH to the address 0x1234567890123456789012345678901234567890',
    agent=crypto_agent
)

# Create and run the crew
crew = Crew(
    agents=[crypto_agent],
    tasks=[task]
)
result = crew.kickoff()
```


## CDP Toolkit Specific Features

### Wallet Management

The toolkit maintains an MPC wallet that persists between sessions:

```python
# Export wallet data
wallet_data = cdp.export_wallet()

# Import wallet data
values = {"cdp_wallet_data": wallet_data}
cdp = CdpAgentkitWrapper(**values)
```


### Network Support

The toolkit supports [multiple networks](https://docs.cdp.coinbase.com/cdp-apis/docs/networks).

### Gasless Transactions

The following operations support gasless transactions on Base Mainnet:
- USDC transfers
- EURC transfers
- cbBTC transfers

## Examples

Check out [../examples](../examples) for inspiration and help getting started!
- [Chatbot Python](../examples/cdp-crewai-chatbot/README.md): Simple example of a Python Chatbot that can perform complex onchain interactions using CrewAI.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.