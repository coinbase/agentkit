from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

WETH_ADDRESS = "0x4200000000000000000000000000000000000006"

WETH_ABI = [
    {
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {
                "name": "account",
                "type": "address",
            },
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "type": "uint256",
            },
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

WRAP_ETH_PROMPT = """
This tool can only be used to wrap ETH to WETH.
Do not use this tool for any other purpose, or trading other assets.
Inputs:
- Amount of ETH to wrap.
Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 WETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 WETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
"""


class WrapEthInput(BaseModel):
    """Input argument schema for wrapping ETH to WETH."""

    amount_to_wrap: str = Field(
        ...,
        description="Amount of ETH to wrap in wei",
    )


def wrap_eth(wallet: Wallet, amount_to_wrap: str) -> str:
    """Wrap ETH to WETH.

    Args:
        wallet (Wallet): The wallet to wrap ETH from.
        amount_to_wrap (str): The amount of ETH to wrap in wei.

    Returns:
        str: A message containing the wrapped ETH details.

    """
    try:
        invocation = wallet.invoke_contract(
            contract_address=WETH_ADDRESS,
            method="deposit",
            abi=WETH_ABI,
            args={},
            amount=amount_to_wrap,
            asset_id="wei",
        )
        result = invocation.wait()
        return f"Wrapped ETH with transaction hash: {result.transaction.transaction_hash}"
    except Exception as e:
        return f"Unexpected error wrapping ETH: {e!s}"


class WrapEthAction(CdpAction):
    """Wrap ETH to WETH action."""

    name: str = "wrap_eth"
    description: str = WRAP_ETH_PROMPT
    args_schema: type[BaseModel] | None = WrapEthInput
    func: Callable[..., str] = wrap_eth
