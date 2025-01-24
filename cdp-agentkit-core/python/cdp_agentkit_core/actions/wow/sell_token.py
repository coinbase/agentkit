from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.wow.constants import (
    WOW_ABI,
)
from cdp_agentkit_core.actions.wow.uniswap.index import get_has_graduated
from cdp_agentkit_core.actions.wow.utils import get_sell_quote

WOW_SELL_TOKEN_PROMPT = """
This tool can only be used to sell a Zora Wow ERC20 memecoin for ETH. Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Amount of tokens to sell (in wei)

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
"""


class WowSellTokenInput(BaseModel):
    """Input argument schema for sell token action."""

    contract_address: str = Field(
        ...,
        description="The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )

    amount_tokens_in_wei: str = Field(
        ...,
        description="Amount of tokens to sell (in wei), meaning 1 is 1 wei or 0.000000000000000001 of the token",
    )


def wow_sell_token(wallet: Wallet, contract_address: str, amount_tokens_in_wei: str):
    """Sell WOW tokens for ETH.

    Args:
        wallet (Wallet): The wallet to sell the tokens from.
        contract_address (str): The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount_tokens_in_wei (str): Amount of tokens to sell (in wei), meaning 1 is 1 wei or 0.000000000000000001 of the token

    Returns:
        str: A message confirming the sale with the transaction hash

    """
    eth_quote = get_sell_quote(wallet.network_id, contract_address, amount_tokens_in_wei)
    has_graduated = get_has_graduated(wallet.network_id, contract_address)

    # Multiply by 98/100 and floor to get 98% of quote as minimum (slippage protection)
    min_eth = str(int((eth_quote * 98) // 100))

    try:
        invocation = wallet.invoke_contract(
            contract_address=contract_address,
            method="sell",
            abi=WOW_ABI,
            args={
                "tokensToSell": str(amount_tokens_in_wei),
                "recipient": wallet.default_address.address_id,
                "orderReferrer": "0x0000000000000000000000000000000000000000",
                "comment": "",
                "expectedMarketType": "1" if has_graduated else "0",
                "minPayoutSize": min_eth,
                "sqrtPriceLimitX96": "0",
            },
        ).wait()
    except Exception as e:
        return f"Error selling Zora Wow ERC20 memecoin {e!s}"

    return (
        f"Sold WoW ERC20 memecoin with transaction hash: {invocation.transaction.transaction_hash}"
    )


class WowSellTokenAction(CdpAction):
    """Zora Wow sell token action."""

    name: str = "wow_sell_token"
    description: str = WOW_SELL_TOKEN_PROMPT
    args_schema: type[BaseModel] | None = WowSellTokenInput
    func: Callable[..., str] = wow_sell_token
