"""Utility functions for swap operations."""

import asyncio
from typing import Any

from web3 import Web3

from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..erc20.constants import ERC20_ABI

# Permit2 contract address is the same across all networks
PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"


def is_native_eth(token: str) -> bool:
    """Check if a token is native ETH.

    Args:
        token: The token address to check.

    Returns:
        True if the token is native ETH, false otherwise.

    """
    return token.lower() == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"


def get_token_details(
    wallet_provider: EvmWalletProvider,
    from_token: str,
    to_token: str,
) -> dict[str, Any]:
    """Get the details (decimals and name) for both fromToken and toToken.

    Args:
        wallet_provider: The EVM wallet provider to read contracts
        from_token: The contract address of the from token
        to_token: The contract address of the to token

    Returns:
        Dictionary containing token details

    """
    # Initialize default values for native ETH
    from_token_decimals = 18
    from_token_name = "ETH"
    to_token_decimals = 18
    to_token_name = "ETH"

    web3 = wallet_provider._web3

    try:
        # Get from token details if not native ETH
        if not is_native_eth(from_token):
            from_contract = web3.eth.contract(
                address=Web3.to_checksum_address(from_token), abi=ERC20_ABI
            )
            from_token_decimals = from_contract.functions.decimals().call()
            from_token_name = from_contract.functions.name().call()

        # Get to token details if not native ETH
        if not is_native_eth(to_token):
            to_contract = web3.eth.contract(
                address=Web3.to_checksum_address(to_token), abi=ERC20_ABI
            )
            to_token_decimals = to_contract.functions.decimals().call()
            to_token_name = to_contract.functions.name().call()

    except Exception as e:
        raise ValueError(f"Failed to read token details: {e}") from e

    return {
        "from_token_decimals": from_token_decimals,
        "to_token_decimals": to_token_decimals,
        "from_token_name": from_token_name,
        "to_token_name": to_token_name,
    }


async def retry_with_exponential_backoff(
    func,
    max_retries: int = 3,
    base_delay: float = 1.0,
) -> Any:
    """Retry function with exponential backoff.

    Args:
        func: The function to retry
        max_retries: Maximum number of retries (default: 3)
        base_delay: Base delay in seconds (default: 1.0)

    Returns:
        The function result or raises the last error

    """
    last_error = None

    for attempt in range(max_retries + 1):
        # Wait before each attempt (except the first)
        if attempt > 0:
            delay = base_delay * (2 ** (attempt - 1))
            await asyncio.sleep(delay)

        try:
            if asyncio.iscoroutinefunction(func):
                return await func()
            else:
                return func()
        except Exception as error:
            last_error = error

            # If this was the last attempt, raise the error
            if attempt == max_retries:
                raise last_error from None

    raise last_error


def parse_units(value: str, decimals: int) -> int:
    """Parse a human-readable amount into token units.

    Args:
        value: The amount as a string (e.g., "1.5")
        decimals: The number of decimals for the token

    Returns:
        The amount in token units as an integer

    """
    return int(float(value) * (10**decimals))


def format_units(value, decimals: int) -> str:
    """Format token units into a human-readable amount.

    Args:
        value: The amount in token units (can be int or string)
        decimals: The number of decimals for the token

    Returns:
        The formatted amount as a string

    """
    # Handle both string and int values
    value_int = int(value) if isinstance(value, str) else int(value)

    return str(value_int / (10**decimals))
