<p align="center">
  <img src="../../../../../assets/protocols/compound.svg" width="200" height="200">
</p>

<h1 align="center">Compound Finance Actions for AI Agents to Lend and Borrow on Base</h1>


These actions allow you to supply, borrow, repay, withdraw ETH or USDC to Compound V3 markets through the Base USDC Comet Contract.

> 🧪 **Try it on Base Sepolia First!**  
> These actions work seamlessly on Base Sepolia testnet, allowing you to develop and test your agent's Compound interactions without using real funds. Once you're confident in your implementation, you can switch to Base mainnet for production use. 

## Actions
The actions in this package are intended to support agents that want to interact with Compound V3 markets on Base. It supports the following actions:

- `supply`: Supply ETH or USDC to Compound V3 markets on Base.
- `borrow`: Borrow ETH or USDC from Compound V3 markets on Base.
- `repay`: Repay ETH or USDC to Compound V3 markets on Base.
- `withdraw`: Withdraw ETH or USDC from Compound V3 markets on Base.
- `get_portfolio`: Get the portfolio details for the Compound V3 markets on Base.

## Supported Compound Markets (aka. Comets)

### Base
- USDC Comet 
  - Supply Assets: USDC, WETH, cbBTC, cbETH, wstETH
  - Borrow Asset: USDC

### Base Sepolia
- USDC Comet 
  - Supply Assets: USDC, WETH
  - Borrow Asset: USDC

## Funded by Compound Grants Program
Compound Actions for AgentKit is funded by the Compound Grants Program. Learn more about the Grant on Questbook [here](https://new.questbook.app/dashboard/?role=builder&chainId=10&proposalId=678c218180bdbe26619c3ae8&grantId=66f29bb58868f5130abc054d). For support, please reach out the original author of this action provider: [@mikeghen](https://x.com/mikeghen).
