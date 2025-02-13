"""Uniswap utilities for WOW action provider."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from web3 import Web3
from web3.types import Wei

from ....wallet_providers import EvmWalletProvider
from ..constants import WOW_ABI, addresses
from .constants import UNISWAP_QUOTER_ABI, UNISWAP_V3_ABI


@dataclass
class PriceInfo:
    """Price info for a given token."""

    eth: Wei
    usd: Decimal


@dataclass
class Balance:
    """Balance for a given token."""

    erc20z: Wei
    weth: Wei


@dataclass
class Price:
    """Price info for a given token."""

    per_token: PriceInfo
    total: PriceInfo


@dataclass
class Quote:
    """Quote for a given uniswap v3 swap."""

    amount_in: int
    amount_out: int
    balance: Balance | None
    fee: float | None
    error: str | None


@dataclass
class PoolInfo:
    """Pool info for a given uniswap v3 pool."""

    token0: str
    balance0: int
    token1: str
    balance1: int
    fee: int
    liquidity: int
    sqrt_price_x96: int


def create_price_info(wei_amount: Wei, eth_price_in_usd: float) -> PriceInfo:
    """Create a PriceInfo object from wei amount and ETH price.

    Args:
        wei_amount: Amount in wei
        eth_price_in_usd: Current ETH price in USD

    Returns:
        PriceInfo: A PriceInfo object containing the amount in ETH and USD

    """
    amount_in_eth = Web3.from_wei(wei_amount, "ether")
    usd = float(amount_in_eth) * eth_price_in_usd
    return PriceInfo(eth=wei_amount, usd=Decimal(str(usd)))


def get_has_graduated(wallet_provider: EvmWalletProvider, token_address: str) -> bool:
    """Check if a token has graduated from the Zora Wow protocol.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address: Token address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

    Returns:
        bool: True if the token has graduated, False otherwise

    """
    market_type = wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="marketType",
        args=[],
    )
    return market_type == 1


def get_pool_info(wallet_provider: EvmWalletProvider, pool_address: str) -> PoolInfo:
    """Get pool info for a given uniswap v3 pool address.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        pool_address: Uniswap v3 pool address

    Returns:
        PoolInfo: A PoolInfo object containing the token0, balance0, token1, balance1, fee, liquidity, and sqrt_price_x96.

    """
    try:
        token0 = wallet_provider.read_contract(
            contract_address=pool_address,
            abi=UNISWAP_V3_ABI,
            function_name="token0",
            args=[],
        )
        token1 = wallet_provider.read_contract(
            contract_address=pool_address,
            abi=UNISWAP_V3_ABI,
            function_name="token1",
            args=[],
        )
        fee = wallet_provider.read_contract(
            contract_address=pool_address,
            abi=UNISWAP_V3_ABI,
            function_name="fee",
            args=[],
        )
        liquidity = wallet_provider.read_contract(
            contract_address=pool_address,
            abi=UNISWAP_V3_ABI,
            function_name="liquidity",
            args=[],
        )
        slot0 = wallet_provider.read_contract(
            contract_address=pool_address,
            abi=UNISWAP_V3_ABI,
            function_name="slot0",
            args=[],
        )

        balance0 = wallet_provider.read_contract(
            contract_address=token0,
            abi=WOW_ABI,
            function_name="balanceOf",
            args=[pool_address],
        )

        balance1 = wallet_provider.read_contract(
            contract_address=token1,
            abi=WOW_ABI,
            function_name="balanceOf",
            args=[pool_address],
        )

        return PoolInfo(
            token0=token0,
            balance0=balance0,
            token1=token1,
            balance1=balance1,
            fee=fee,
            liquidity=liquidity,
            sqrt_price_x96=slot0[0],
        )
    except Exception as error:
        raise Exception(f"Failed to fetch pool information: {error!s}") from error


def exact_input_single(
    wallet_provider: EvmWalletProvider, token_in: str, token_out: str, amount_in: int, fee: str
) -> int:
    """Get exact input quote from Uniswap.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_in: Token address to swap from, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        token_out: Token address to swap to, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount_in: Amount of tokens to swap (in Wei)
        fee: Fee for the swap

    Returns:
        int: Amount of tokens to receive (in Wei)

    """
    try:
        chain_id = wallet_provider.get_network().chain_id
        network = "base-mainnet" if chain_id == 8453 else "base-sepolia"
        if network not in addresses:
            raise ValueError(f"Unsupported network: {network}")

        amount = wallet_provider.read_contract(
            contract_address=addresses[network]["uniswap_quoter"],
            abi=UNISWAP_QUOTER_ABI,
            function_name="quoteExactInputSingle",
            args=[
                {
                    "tokenIn": str(Web3.to_checksum_address(token_in)),
                    "tokenOut": str(Web3.to_checksum_address(token_out)),
                    "fee": fee,
                    "amountIn": amount_in,
                    "sqrtPriceLimitX96": 0,
                }
            ],
        )
        return amount
    except Exception as e:
        print(f"Quoter error: {e!s}")
        return 0


def get_uniswap_quote(
    wallet_provider: EvmWalletProvider,
    token_address: str,
    amount: int,
    quote_type: Literal["buy", "sell"],
) -> Quote:
    """Get Uniswap quote for buying or selling tokens.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address: Token address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
        amount: Amount of tokens (in Wei)
        quote_type: 'buy' or 'sell'

    Returns:
        Quote: A Quote object containing the amount in, amount out, balance, fee, and any error messages.

    """
    pool = None
    tokens = None
    balances = None
    eth_price_in_usd = None
    quote_result = None
    utilization = Wei(0)
    insufficient_liquidity = False

    chain_id = wallet_provider.get_network().chain_id
    network = "base-mainnet" if chain_id == 8453 else "base-sepolia"
    if network not in addresses:
        raise ValueError(f"Unsupported network: {network}")

    pool_address = wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="poolAddress",
        args=[],
    )
    invalid_pool_error = "Invalid pool address" if not pool_address else None

    try:
        pool_info = get_pool_info(wallet_provider, pool_address)
        token0, token1 = pool_info.token0, pool_info.token1
        balance0, balance1 = pool_info.balance0, pool_info.balance1
        fee = pool_info.fee

        pool = pool_info
        tokens = (token0, token1)
        balances = (balance0, balance1)

        is_token0_weth = token0.lower() == addresses[network]["weth"].lower()
        token_in = (
            token0
            if (quote_type == "buy" and is_token0_weth)
            or (quote_type == "sell" and not is_token0_weth)
            else token1
        )

        token_out, balance_out = (token1, balance1) if token_in == token0 else (token0, balance0)

        if isinstance(balance_out, list | tuple):
            balance_out = balance_out[0] if balance_out else 0
        balance_out = int(balance_out)

        insufficient_liquidity = quote_type == "buy" and amount > balance_out
        utilization = (
            Wei(int(amount / balance_out)) if quote_type == "buy" and balance_out > 0 else Wei(0)
        )

        quote_result = exact_input_single(wallet_provider, token_in, token_out, amount, fee)

    except Exception as e:
        print(f"Error fetching quote: {e!s}")

    insufficient_liquidity = (
        quote_type == "sell" and pool and not quote_result
    ) or insufficient_liquidity

    error_msg = None
    if not pool or not eth_price_in_usd:
        error_msg = "Failed fetching pool"
    elif insufficient_liquidity:
        error_msg = "Insufficient liquidity"
    elif not quote_result and utilization >= Wei(int(0.9 * 1e18)):
        error_msg = "Price impact too high"
    elif not quote_result:
        error_msg = "Failed fetching quote"

    balance_result = None
    if tokens and balances:
        is_weth_token0 = tokens[0].lower() == addresses[network]["weth"].lower()
        balance_result = Balance(
            erc20z=Wei(balances[1][0] if isinstance(balances[1], list | tuple) else balances[1])
            if is_weth_token0
            else Wei(balances[0][0] if isinstance(balances[0], list | tuple) else balances[0]),
            weth=Wei(balances[0][0] if isinstance(balances[0], list | tuple) else balances[0])
            if is_weth_token0
            else Wei(balances[1][0] if isinstance(balances[1], list | tuple) else balances[1]),
        )

    return Quote(
        amount_in=amount,
        amount_out=quote_result if quote_result else Wei(0),
        balance=balance_result,
        fee=pool.fee / 1000000 if pool else None,
        error=invalid_pool_error or error_msg,
    )


def get_pool_address(wallet_provider: EvmWalletProvider, token_address: str) -> str:
    """Fetch the uniswap v3 pool address for a given token.

    Args:
        wallet_provider: The wallet provider to use for contract calls
        token_address (str): The address of the token contract, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

    Returns:
        str: The uniswap v3 pool address associated with the token.

    """
    pool_address = wallet_provider.read_contract(
        contract_address=token_address,
        abi=WOW_ABI,
        function_name="poolAddress",
        args=[],
    )
    return str(pool_address)
