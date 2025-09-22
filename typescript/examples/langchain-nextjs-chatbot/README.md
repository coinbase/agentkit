# NextJS AgentKit LangChain Chatbot Example

A production-ready example demonstrating how to build an AI agent chatbot using NextJS, LangChain, and CDP AgentKit. The agent can perform complex onchain interactions through natural language conversations.

## 🚀 Features

- Full integration with CDP AgentKit actions and LangChain
- Built with NextJS for optimal performance and SEO
- Real-time chat interface with streaming responses
- Support for complex onchain operations
- Automatic wallet management and network detection

## 💬 Example Interactions

Ask the chatbot to:
- Transfer ETH between wallets
- Check real-time crypto prices
- Deploy and manage NFT collections
- Create ERC-20 tokens
- Learn about Web3 concepts
- Set up DCA (Dollar-Cost Averaging) strategies

## 🔧 Prerequisites

- Node.js 18 or higher
- [CDP API Key](https://portal.cdp.coinbase.com/access/api) - For onchain interactions
- [OpenAI API Key](https://platform.openai.com/docs/quickstart) - For AI capabilities

### Version Check
```bash
node --version  # Must be v18.0.0 or higher
```
Need to upgrade? Use nvm:

```bash
nvm install node
```

🛠 Setup

1. Clone and install dependencies:
```bash
git clone https://github.com/coinbase/agentkit.git
cd agentkit
npm install
npm run build
```

2. Configure environment:
- Copy .env.local to .env
- Set required API keys:


```bash
CDP_API_KEY_NAME=your_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key
OPENAI_API_KEY=your_openai_key
```

3. Start the development server:
```bash
cd typescript/examples/langchain-nextjs-chatbot
npm run dev
```

# 📱 Usage
1. Open your browser to http://localhost:3000
2. Start chatting with your AI agent
3. The agent will automatically:
   - Initialize a CDP wallet
   - Detect the current network
   - Handle gas fees when needed
   - Execute onchain transactions securely


# 🔄 Development
Making changes? Rebuild the packages from root:

```bash
npm run build
```
Your changes will automatically reflect in the chatbot. 🤝

📄 License
Apache-2.0
