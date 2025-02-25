import os
from datetime import datetime, timedelta, timezone
from coinbase_agentkit import ActionProvider, WalletProvider, create_action
from pydantic import BaseModel
from typing import Any
from agent_wallet_python.client import AgentWalletClient
from lit_python_sdk import connect
from dotenv import load_dotenv
from eth_utils import to_checksum_address
from web3 import Web3

class LitAgentWalletTransferSchema(BaseModel):
    pkp_eth_address: str
    token_address: str
    recipient_address: str
    amount: str
    rpc_url: str
    chain_id: int
    decimals: int = 18

class LitAgentWalletProvider(ActionProvider[WalletProvider]):
    def __init__(self):
        super().__init__("lit-agent-wallet-provider", [])
        self.client = connect()
        load_dotenv()
        private_key = os.getenv("EVM_PRIVATE_KEY")
        if not private_key:
            raise ValueError("EVM_PRIVATE_KEY not found in environment variables")
        self.client.set_auth_token(private_key)
        self.client.new(lit_network="datil-dev", debug=True)
        self.client.connect()
        self.agent_wallet = AgentWalletClient()
        self.tool = self.agent_wallet.get_tool_by_name("ERC20Transfer", network="datil-dev")
        if not self.tool:
            raise ValueError("ERC20Transfer tool not found for network datil-dev")
        tool_names = self.agent_wallet.get_available_tool_names()

    def get_session_signatures(self):
        expiration = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        session_sigs_result = self.client.get_session_sigs(
            chain="ethereum",
            expiration=expiration,
            resource_ability_requests=[{
                "resource": {
                    "resource": "*",
                    "resourcePrefix": "lit-litaction",
                },
                "ability": "lit-action-execution",
            }]
        )
        return session_sigs_result.get("sessionSigs", {})

    def validate_address(self, address: str) -> str:
        try:
            return to_checksum_address(address)
        except Exception as e:
            raise ValueError(f"Invalid Ethereum address: {address}") from e

    def validate_amount(self, amount: str) -> str:
        try:
            float_amount = float(amount)
            if float_amount <= 0:
                raise ValueError
            return amount
        except ValueError:
            raise ValueError(f"Invalid amount: {amount}. Must be a positive number.")

    @create_action(
        name="execute-erc20-transfer",
        description="Execute an ERC20 token transfer using Lit Agent Wallet",
        schema=LitAgentWalletTransferSchema
    )
    def execute_erc20_transfer(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        # Input validation
        pkp_eth_address = self.validate_address(args['pkp_eth_address'])
        token_address = self.validate_address(args['token_address'])
        recipient_address = self.validate_address(args['recipient_address'])
        amount = self.validate_amount(args['amount'])

        # Create policy object
        policy = {
            "type": "ERC20Transfer",
            "version": "1.0.0",
            "erc20Decimals": str(args['decimals']),
            "maxAmount": amount,
            "allowedTokens": [token_address],
            "allowedRecipients": [recipient_address]
        }

        # Prepare parameters
        js_params = {
            "params": {
                "pkpEthAddress": pkp_eth_address,
                "tokenIn": token_address,
                "recipientAddress": recipient_address,
                "amountIn": amount,
                "chainId": str(args['chain_id']),
                "rpcUrl": args['rpc_url']
            }
        }

        try:
            session_sigs = self.get_session_signatures()
            print(f"Executing Lit Action with IPFS ID: {self.tool.ipfs_cid}")
            result = self.client.execute_js(
                ipfs_id=self.tool.ipfs_cid,
                js_params=js_params,
                session_sigs=session_sigs
            )
            return result
        except Exception as e:
            raise Exception(f"Failed to execute transfer: {str(e)}")

    def supports_network(self, network: Any) -> bool:
        return True

def lit_agent_wallet_provider():
    return LitAgentWalletProvider()
