# LangChain CDP AgentKit + x402 Tollbooth Auditor

This example demonstrates how to build an autonomous Smart Contract Security Auditor using the **Coinbase Developer Platform (CDP) AgentKit** and the **x402-agent-tollbooth**.

The agent is equipped with a CDP-provisioned crypto wallet and has native support for the `x402` protocol. When you ask it to audit a smart contract on Base, the agent will autonomously pay the 1.00 USDC API toll to the x402 Tollbooth and return a deep AI vulnerability analysis.

## Requirements
- Python 3.10+
- OpenAI API Key
- CDP API Key

## Usage
1. Provide your environment variables in `.env`:
   ```
   CDP_API_KEY_NAME=...
   CDP_API_KEY_PRIVATE_KEY=...
   OPENAI_API_KEY=...
   NETWORK_ID=base-mainnet
   ```
2. Run the chatbot:
   ```bash
   poetry install
   poetry run python chatbot.py
   ```
3. Ask the agent to audit a contract:
   > "Hey, can you audit this smart contract on Base for me? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
4. Watch the agent pay the 1.00 USDC toll and deliver the vulnerability report!
