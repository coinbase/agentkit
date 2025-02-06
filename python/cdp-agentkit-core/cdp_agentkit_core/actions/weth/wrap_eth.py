from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

from .constants import WETH_ABI, WETH_ADDRESS

WRAP_ETH_PROMPT = """
This tool can only be used to wrap ETH to WETH.
Do not use this tool for any other purpose, or trading other assets.
Inputs:
- Amount of ETH to wrap.
Important notes:
- The amount should be specified in whole amounts of ETH (e.g., 0.01 for 0.01 ETH)
- Minimum amount is 0.0000001 ETH
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
"""


class WrapEthInput(BaseModel):
    """Input argument schema for wrapping ETH to WETH."""

    amount_to_wrap: float = Field(
        ...,
        description="Amount of ETH to wrap as whole amounts (e.g., 1.5 for 1.5 ETH)",
        gt=0,
    )


def wrap_eth(wallet: Wallet, amount_to_wrap: float) -> str:
    """Wrap ETH to WETH.

    Args:
        wallet (Wallet): The wallet to wrap ETH from.
        amount_to_wrap (float): The amount of ETH to wrap.

    Returns:
        str: A message containing the wrapped ETH details.

    """
    try:
        # Convert ETH to wei (1 ETH = 10^18 wei)
        amount_in_wei = str(int(amount_to_wrap * 10**18))

        invocation = wallet.invoke_contract(
            contract_address=WETH_ADDRESS,
            method="deposit",
            abi=WETH_ABI,
            args={},
            amount=amount_in_wei,
            asset_id="wei",
        )
        result = invocation.wait()
        return f"Wrapped {amount_to_wrap} ETH with transaction hash: {result.transaction.transaction_hash}"
    except Exception as e:
        return f"Unexpected error wrapping ETH: {e!s}"


class WrapEthAction(CdpAction):
    """Wrap ETH to WETH action."""

    name: str = "wrap_eth"
    description: str = WRAP_ETH_PROMPT
    args_schema: type[BaseModel] | None = WrapEthInput
    func: Callable[..., str] = wrap_eth
