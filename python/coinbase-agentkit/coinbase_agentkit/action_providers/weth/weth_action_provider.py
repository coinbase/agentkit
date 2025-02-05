import re
from typing import Any

from pydantic import BaseModel, Field, validator
from web3 import Web3

from ...wallet_providers import EvmWalletProvider
from ..action_provider import ActionProvider
from ..action_decorator import CreateAction
from ...network import Network
from .constants import WETH_ADDRESS, WETH_ABI

SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"]
MIN_WRAP_AMOUNT = 100_000_000_000_000  # 0.0001 ETH in wei

class WrapEthSchema(BaseModel):
    """Input schema for wrapping ETH to WETH."""
    amount_to_wrap: str = Field(..., description="Amount of ETH to wrap in wei")

    @validator("amount_to_wrap")
    def validate_amount(cls, v: str) -> str:
        """Validate that amount is a valid wei value (whole number as string)."""
        if not re.match(r"^[0-9]+$", v):
            raise ValueError("Amount must be a whole number as a string")
        
        if int(v) < MIN_WRAP_AMOUNT:
            raise ValueError(f"Amount must be at least {MIN_WRAP_AMOUNT} wei (0.0001 WETH)")
        
        return v

class WethActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with WETH."""
    
    def __init__(self):
        super().__init__("weth", [])

    @CreateAction(
        name="wrap_eth",
        description="""
    This tool can only be used to wrap ETH to WETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Amount of ETH to wrap.

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 WETH
- Minimum purchase amount is 100000000000000 wei (0.0001 WETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
""",
        schema=WrapEthSchema
    )
    def wrap_eth(
        self,
        wallet_provider: EvmWalletProvider,
        args: dict[str, Any]
    ) -> str:
        """Wrap ETH to WETH.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider to use for the action.
            args (dict[str, Any]): The input arguments for the action.

        Returns:
            str: A message containing the transaction hash.
        """
        try:
            contract = Web3().eth.contract(address=WETH_ADDRESS, abi=WETH_ABI)
            data = contract.encode_abi("deposit", args=[])

            tx_hash = wallet_provider.send_transaction({
                "to": WETH_ADDRESS,
                "data": data,
                "value": args["amount_to_wrap"]
            })

            wallet_provider.wait_for_transaction_receipt(tx_hash)
            
            return f"Wrapped ETH with transaction hash: {tx_hash}"
        except Exception as e:
            return f"Error wrapping ETH: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by WETH actions."""
        return network.network_id in SUPPORTED_NETWORKS

def weth_action_provider() -> WethActionProvider:
    """Create a new WethActionProvider instance."""
    return WethActionProvider()
