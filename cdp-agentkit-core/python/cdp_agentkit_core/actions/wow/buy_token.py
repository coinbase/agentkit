from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.wow.constants import (
    WOW_ABI,
)
from cdp_agentkit_core.actions.wow.uniswap.index import get_has_graduated
from cdp_agentkit_core.actions.wow.utils import get_buy_quote

WOW_BUY_TOKEN_PROMPT = """
This tool can only be used to buy a Zora Wow ERC20 memecoin with ETH. Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Address to receive the tokens
- Amount of ETH to spend (in wei)

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
"""


class WowBuyTokenInput(BaseModel):
    """Input argument schema for buy token action."""

    contract_address: str = Field(
        ...,
        description="The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )

    amount_eth_in_wei: str = Field(
        ...,
        description="Amount of ETH to spend (in wei), meaning 1 is 1 wei or 0.000000000000000001 of ETH",
    )


def wow_buy_token(wallet: Wallet, contract_address: str, amount_eth_in_wei: str) -> str:
    """Buy a Zora Wow ERC20 memecoin with ETH.

    Args:
        wallet (Wallet): The wallet to create the token from.
        contract_address (str): The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount_eth_in_wei (str): Amount of ETH to spend (in wei), meaning 1 is 1 wei or 0.000000000000000001 of ETH

    Returns:
        str: A message containing the token purchase details.

    """
    token_quote = get_buy_quote(wallet.network_id, contract_address, amount_eth_in_wei)

    # Multiply by 99/100 and floor to get 99% of quote as minimum
    min_tokens = str(int((token_quote * 99) // 100))  # Using integer division to floor the result

    has_graduated = get_has_graduated(wallet.network_id, contract_address)

    try:
        invocation = wallet.invoke_contract(
            contract_address=contract_address,
            method="buy",
            abi=WOW_ABI,
            args={
                "recipient": wallet.default_address.address_id,
                "refundRecipient": wallet.default_address.address_id,
                "orderReferrer": "0x0000000000000000000000000000000000000000",
                "expectedMarketType": (has_graduated and "1") or "0",
                "minOrderSize": min_tokens,
                "sqrtPriceLimitX96": "0",
                "comment": "",
            },
            amount=amount_eth_in_wei,
            asset_id="wei",
        ).wait()
    except Exception as e:
        return f"Error buying Zora Wow ERC20 memecoin {e!s}"

    return f"Purchased WoW ERC20 memecoin with transaction hash: {invocation.transaction.transaction_hash}"


class WowBuyTokenAction(CdpAction):
    """Zora Wow buy token action."""

    name: str = "wow_buy_token"
    description: str = WOW_BUY_TOKEN_PROMPT
    args_schema: type[BaseModel] | None = WowBuyTokenInput
    func: Callable[..., str] = wow_buy_token
