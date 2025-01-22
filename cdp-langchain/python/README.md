# CDP Agentkit Extension - Langchain Toolkit

CDP integration with Langchain to enable agentic workflows using the core primitives defined in `cdp-agentkit-core`.

This toolkit contains tools that enable an LLM agent to interact with the [Coinbase Developer Platform](https://docs.cdp.coinbase.com/). The toolkit provides a wrapper around the CDP SDK, allowing agents to perform onchain operations like transfers, trades, and smart contract interactions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Python 3.10 or higher

### Installation

```bash
pip install cdp-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_NAME=<your-api-key-name>
export CDP_API_KEY_PRIVATE_KEY=$'<your-private-key>'
export OPENAI_API_KEY=<your-openai-api-key>
export NETWORK_ID=base-sepolia  # Optional: Defaults to base-sepolia
```

## Usage

### Basic Setup

```python
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper

# Initialize CDP wrapper
cdp = CdpAgentkitWrapper()

# Create toolkit from wrapper
toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)

# Get available tools
tools = toolkit.get_tools()
for tool in tools:
    print(tool.name)
```

The toolkit provides the following tools:

1. **get_wallet_details** - Get details about the MPC Wallet
2. **get_balance** - Get balance for specific assets
3. **request_faucet_funds** - Request test tokens from faucet
4. **transfer** - Transfer assets between addresses
5. **trade** - Trade assets (Mainnet only)
6. **deploy_token** - Deploy ERC-20 token contracts
7. **mint_nft** - Mint NFTs from existing contracts
8. **deploy_nft** - Deploy new NFT contracts
9. **register_basename** - Register a basename for the wallet
10. **wow_create_token** - Deploy a token using Zora's Wow Launcher (Bonding Curve)
11. **wow_buy_token** - Buy Zora Wow ERC20 memecoin with ETH
12. **wow_sell_token** - Sell Zora Wow ERC20 memecoin for ETH
13. **wrap_eth** - Wrap ETH to WETH
14. **pyth_fetch_price_feed_id** Fetch the price feed ID for a given token symbol from Pyth Network
15. **pyth_fetch_price** fetch the price of a given price feed from Pyth Network
16. **get_balance_nft** Get balance for specific NFTs (ERC-721)
17. **transfer_nft** Transfer an NFT (ERC-721)

### Using with an Agent

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini")

# Get tools and create agent
tools = toolkit.get_tools()
agent_executor = create_react_agent(llm, tools)

# Example usage
events = agent_executor.stream(
    {"messages": [("user", "Send 0.005 ETH to john2879.base.eth")]},
    stream_mode="values"
)

for event in events:
    event["messages"][-1].pretty_print()
```
Expected output:
```
Transferred 0.005 of eth to john2879.base.eth.
Transaction hash for the transfer: 0x78c7c2878659a0de216d0764fc87eff0d38b47f3315fa02ba493a83d8e782d1e
Transaction link for the transfer: https://sepolia.basescan.org/tx/0x78c7c2878659a0de216d0764fc87eff0d38b47f3315fa02ba493a83d8e782d1
```

## CDP Tookit Specific Features

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

The toolkit supports [multiple networks](https://docs.cdp.coinbase.com/cdp-sdk/docs/networks).

### Gasless Transactions

The following operations support gasless transactions on Base Mainnet:
- USDC transfers
- EURC transfers
- cbBTC transfers

## Examples

Check out [cdp-langchain/examples](../examples) for inspiration and help getting started!
- [Chatbot Python](../examples/chatbot-python/README.md): Simple example of a Python Chatbot that can perform complex onchain interactions, using OpenAI.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
