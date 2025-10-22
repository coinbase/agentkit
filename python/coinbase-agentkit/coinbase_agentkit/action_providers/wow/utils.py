"""Utilities for WOW action provider."""

from ...wallet_providers import EvmWalletProvider
from .constants import WOW_ABI, WOW_FACTORY_CONTRACT_ADDRESSES
from .uniswap.utils import get_has_graduated, get_uniswap_quote


def get_factory_address(chain_id: str) -> str:
    """Get the Zora Wow ERC20 Factory contract address for the specified network.

    Args:
        chain_id (str): The chain ID to get the contract address for.
            Valid networks are: base-sepolia, base-mainnet.

    Returns:
        str: The contract address for the specified network.

    Raises:
        ValueError: If the specified network is not supported.

    """
    network = "base-mainnet" if chain_id == 8453 else "base-sepolia"
    if network not in WOW_FACTORY_CONTRACT_ADDRESSES:
        raise ValueError(
            f"Invalid network: {network}. Valid networks are: {', '.join(WOW_FACTORY_CONTRACT_ADDRESSES.keys())}"
        )
    return WOW_FACTORY_CONTRACT_ADDRESSES[network]


def get_current_supply(wallet_provider: EvmWalletProvider, token_address: str) -> int:
    """Get the current supply of a token.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address: Address of the token contract, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

    Returns:
        int: The current total supply of the token

    """
    return wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="totalSupply",
        args=[],
    )


def get_buy_quote(
    wallet_provider: EvmWalletProvider, token_address: str, amount_eth_in_wei: str
) -> int:
    """Get quote for buying tokens.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address: Address of the token contract, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount_eth_in_wei: Amount of ETH to buy (in wei), meaning 1 is 1 wei or 0.000000000000000001 of ETH

    Returns:
        int: The amount of tokens that would be received for the given ETH amount

    """
    amount_eth_in_wei_int = int(amount_eth_in_wei)
    has_graduated = get_has_graduated(wallet_provider, token_address)

    token_quote = (
        has_graduated
        and (
            get_uniswap_quote(wallet_provider, token_address, amount_eth_in_wei_int, "buy")
        ).amount_out
    ) or wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="getEthBuyQuote",
        args=[amount_eth_in_wei_int],
    )
    return token_quote


def get_sell_quote(
    wallet_provider: EvmWalletProvider, token_address: str, amount_tokens_in_wei: str
) -> int:
    """Get quote for selling tokens.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address: Address of the token contract, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount_tokens_in_wei: Amount of tokens to sell (in wei), meaning 1 is 1 wei or 0.000000000000000001 of the token

    Returns:
        int: The amount of ETH that would be received for the given token amount

    """
    amount_tokens_in_wei_int = int(amount_tokens_in_wei)
    has_graduated = get_has_graduated(wallet_provider, token_address)

    token_quote = (
        has_graduated
        and (
            get_uniswap_quote(wallet_provider, token_address, amount_tokens_in_wei_int, "sell")
        ).amount_out
    ) or wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="getTokenSellQuote",
        args=[amount_tokens_in_wei_int],
    )
    return token_quote
