from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

from .constants import WETH_ABI, WETH_ADDRESS

UNWRAP_ETH_PROMPT = """
This tool can only be used to unwrap WETH to ETH.
Do not use this tool for any other purpose.
Inputs:
- Amount of WETH to unwrap
Important notes:
- The amount should be specified in whole amounts of WETH (e.g., 0.01 for 0.01 WETH)
- Minimum amount is 0.0000001 WETH
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
"""

class UnwrapWethInput(BaseModel):
    """Input argument schema for unwrapping WETH back to ETH."""

    amount_to_unwrap: float = Field(
        ...,
        description="Amount of WETH to unwrap as whole amounts (e.g., 1.5 for 1.5 WETH)",
        gt=0,
    )

def unwrap_weth(wallet: Wallet, amount_to_unwrap: float) -> str:
    """Unwrap WETH to ETH.

    Args:
        wallet (Wallet): The wallet holding WETH to unwrap.
        amount_to_unwrap (float): The amount of WETH to unwrap.

    Returns:
        str: A message containing the unwrapped WETH details.

    """
    try:
        # Convert WETH to wei (1 WETH = 10^18 wei)
        amount_in_wei = str(int(amount_to_unwrap * 10**18))

        invocation = wallet.invoke_contract(
            contract_address=WETH_ADDRESS,
            method="withdraw",
            abi=WETH_ABI,
            args={"wad": amount_in_wei},
            amount="0",  # No ETH needed to send for withdrawal
            asset_id="wei",
        )
        result = invocation.wait()
        return f"Unwrapped {amount_to_unwrap} WETH with transaction hash: {result.transaction.transaction_hash}"
    except Exception as e:
        return f"Unexpected error unwrapping WETH: {e!s}"

class UnwrapWethAction(CdpAction):
    """Unwrap WETH to ETH action."""

    name: str = "unwrap_weth"
    description: str = UNWRAP_ETH_PROMPT
    args_schema: type[BaseModel] | None = UnwrapWethInput
    func: Callable[..., str] = unwrap_weth
