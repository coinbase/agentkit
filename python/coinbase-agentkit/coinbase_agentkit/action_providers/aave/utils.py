"""Utility functions for Aave action provider."""

from decimal import Decimal

from web3 import Web3

from ...wallet_providers import EvmWalletProvider
from ..erc20.constants import ERC20_ABI
from .constants import (
    POOL_ABI,
    POOL_ADDRESSES,
    PRICE_ORACLE_ABI,
    PRICE_ORACLE_ADDRESSES,
)


def get_token_decimals(wallet: EvmWalletProvider, token_address: str) -> int:
    """Get the number of decimals for a token.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token.

    Returns:
        int: The number of decimals for the token.

    """
    result = wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="decimals",
        args=[],
    )
    return result


def get_token_symbol(wallet: EvmWalletProvider, token_address: str) -> str:
    """Get a token's symbol from its contract.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token contract.

    Returns:
        str: The token symbol.

    """
    return wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="symbol",
        args=[],
    )


def get_token_balance(wallet: EvmWalletProvider, token_address: str) -> int:
    """Get the balance of a token for the wallet.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token.

    Returns:
        int: The balance in atomic units.

    """
    return wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="balanceOf",
        args=[wallet.get_address()],
    )


def format_amount_with_decimals(amount: str, decimals: int) -> int:
    """Format a human-readable amount with the correct number of decimals.

    Args:
        amount: The amount as a string (e.g. "0.1").
        decimals: The number of decimals for the token.

    Returns:
        int: The amount in atomic units.

    """
    try:
        if amount == "max":
            return 2**256 - 1  # uint256 max for Aave's withdraw/repay all

        # Handle scientific notation
        if "e" in amount.lower():
            amount_decimal = Decimal(amount)
            return int(amount_decimal * (10**decimals))

        # Handle regular decimal notation
        parts = amount.split(".")
        if len(parts) == 1:
            return int(parts[0]) * (10**decimals)

        whole, fraction = parts
        if len(fraction) > decimals:
            fraction = fraction[:decimals]
        else:
            fraction = fraction.ljust(decimals, "0")

        return int(whole) * (10**decimals) + int(fraction)
    except ValueError as e:
        raise ValueError(f"Invalid amount format: {amount}") from e


def format_amount_from_decimals(amount: int, decimals: int) -> str:
    """Format an atomic amount to a human-readable string.

    Args:
        amount: The amount in atomic units.
        decimals: The number of decimals for the token.

    Returns:
        str: The amount as a human-readable string.

    """
    if amount == 0:
        return "0"

    amount_decimal = Decimal(amount) / (10**decimals)
    # Format to remove trailing zeros and decimal point if whole number
    s = str(amount_decimal)
    return s.rstrip("0").rstrip(".") if "." in s else s


def approve_token(
    wallet: EvmWalletProvider, token_address: str, spender_address: str, amount: int
) -> str:
    """Approve a token for spending by Aave Pool contract.

    Args:
        wallet: The wallet provider for sending transactions.
        token_address: The address of the token to approve.
        spender_address: The address of the spender (Pool contract).
        amount: The amount to approve in atomic units.

    Returns:
        str: Transaction hash of the approval transaction.

    """
    token_contract = Web3().eth.contract(
        address=Web3.to_checksum_address(token_address), abi=ERC20_ABI
    )
    encoded_data = token_contract.encode_abi(
        "approve", args=[Web3.to_checksum_address(spender_address), amount]
    )

    params = {
        "to": Web3.to_checksum_address(token_address),
        "data": encoded_data,
    }

    tx_hash = wallet.send_transaction(params)
    wallet.wait_for_transaction_receipt(tx_hash)
    return tx_hash


def get_user_account_data(
    wallet: EvmWalletProvider, pool_address: str, account: str | None = None
) -> dict[str, Decimal | str | int]:
    """Get user account data from Aave pool.

    Args:
        wallet: The wallet provider for reading from contracts.
        pool_address: The address of the Aave Pool contract.
        account: Optional account address. Defaults to wallet address.

    Returns:
        Dict[str, Union[Decimal, str, int]]: Dictionary containing account data.

    """
    if not account:
        account = wallet.get_address()

    # Get account data
    result = wallet.read_contract(
        contract_address=Web3.to_checksum_address(pool_address),
        abi=POOL_ABI,
        function_name="getUserAccountData",
        args=[account],
    )

    (
        total_collateral_base,
        total_debt_base,
        available_borrows_base,
        current_liquidation_threshold,
        ltv,
        health_factor,
    ) = result

    return {
        # Convert base units (scaled by 10^8) to USD values
        "totalCollateralUSD": Decimal(total_collateral_base) / Decimal(10**8),
        "totalDebtUSD": Decimal(total_debt_base) / Decimal(10**8),
        "availableBorrowsUSD": Decimal(available_borrows_base) / Decimal(10**8),
        "currentLiquidationThreshold": Decimal(current_liquidation_threshold) / Decimal(10**4),
        "ltv": Decimal(ltv) / Decimal(10**4),
        "healthFactor": Decimal(health_factor) / Decimal(10**18)
        if health_factor > 0
        else Decimal("inf"),
        # Add raw values in base units
        "totalCollateralBaseUnits": total_collateral_base,
        "totalDebtBaseUnits": total_debt_base,
        "availableBorrowsBaseUnits": available_borrows_base,
    }


def get_health_factor(
    wallet: EvmWalletProvider, pool_address: str, account: str | None = None
) -> Decimal:
    """Get the current health factor for a user.

    Args:
        wallet: The wallet provider for reading from contracts.
        pool_address: The address of the Aave Pool contract.
        account: Optional account address. Defaults to wallet address.

    Returns:
        Decimal: The current health factor.

    """
    account_data = get_user_account_data(wallet, Web3.to_checksum_address(pool_address), account)
    return account_data["healthFactor"]


def get_portfolio_details_markdown(
    wallet: EvmWalletProvider, network_id: str, account: str | None = None
) -> str:
    """Get portfolio details for an Aave user in markdown format.

    Args:
        wallet: The wallet provider for reading from contracts.
        network_id: The network ID (e.g. "base-mainnet").
        account: Optional account address. Defaults to wallet address.

    Returns:
        str: Markdown formatted portfolio details.

    """
    if not account:
        account = wallet.get_address()

    try:
        # Get the Pool contract address
        pool_address = Web3.to_checksum_address(POOL_ADDRESSES[network_id])

        # Get user account data from Pool contract
        account_data = get_user_account_data(wallet, pool_address, account)

        # Format the account data into markdown
        markdown = f"# Aave Portfolio for {account[:6]}...{account[-4:]}\n\n"

        # Format ETH values with scientific notation for small amounts
        def format_eth(value):
            if abs(value) < 1e-4:
                return f"{value:.2e}"
            return f"{value:.18f}"

        # Summary section
        markdown += "## Summary\n\n"
        markdown += f"**Total Collateral (USD):** {account_data['totalCollateralUSD']:.3f}\n"
        markdown += (
            f"**Total Collateral (Base Units):** {account_data['totalCollateralBaseUnits']}\n"
        )
        markdown += f"**Total Debt (USD):** {account_data['totalDebtUSD']:.3f}\n"
        markdown += f"**Total Debt (Base Units):** {account_data['totalDebtBaseUnits']}\n"
        markdown += f"**Available to Borrow (USD):** {account_data['availableBorrowsUSD']:.3f}\n"
        markdown += (
            f"**Available to Borrow (Base Units):** {account_data['availableBorrowsBaseUnits']}\n"
        )
        markdown += (
            f"**Liquidation Threshold:** {account_data['currentLiquidationThreshold']:.3%}\n"
        )
        markdown += f"**Loan to Value:** {account_data['ltv']:.3%}\n"

        # Health factor with color indicators
        health_factor = account_data["healthFactor"]
        if health_factor == Decimal("inf"):
            markdown += "**Health Factor:** ∞ (No borrows)\n"
        elif health_factor >= 2:
            markdown += f"**Health Factor:** {health_factor:.3f} (Healthy)\n"
        elif health_factor >= 1.1:
            markdown += f"**Health Factor:** {health_factor:.3f} (Caution)\n"
        else:
            markdown += f"**Health Factor:** {health_factor:.3f} (Danger - Risk of Liquidation)\n"

        # Add recommendations section
        markdown += "\n## Recommendations\n\n"

        # Check if there's actually debt or collateral
        has_collateral = account_data["totalCollateralBaseUnits"] > 0
        has_debt = account_data["totalDebtBaseUnits"] > 0
        low_health = account_data["healthFactor"] < 1.5 and account_data["healthFactor"] != Decimal(
            "inf"
        )

        if has_collateral and has_debt:
            markdown += f"- You have borrowed {account_data['totalDebtUSD']:.2f} USD ({account_data['totalDebtBaseUnits']}) against your collateral. "
            if low_health:
                markdown += "Your health factor is low, consider repaying some debt or adding more collateral to avoid liquidation.\n"
            else:
                markdown += "Your position is healthy. You can borrow more or repay your existing debt as needed.\n"
        elif has_collateral and not has_debt:
            markdown += f"- You have supplied {account_data['totalCollateralUSD']:.2f} USD ({account_data['totalCollateralBaseUnits']}) as collateral but have no borrows. "
            markdown += "You can borrow against your collateral or withdraw if needed.\n"
        elif not has_collateral and not has_debt and low_health:
            # Special case: No collateral, no debt, but low health factor
            markdown += (
                "- Your account shows no collateral and no debt, but has a low health factor. "
            )
            markdown += "This could be due to dust amounts or rounding. Consider adding more collateral to improve your position.\n"
        elif not has_collateral and not has_debt:
            markdown += "- You have no collateral supplied and no borrows in this Aave market.\n"
        else:
            # Fallback case
            markdown += "- Review your account status and consider adjusting your position based on market conditions.\n"

        return markdown
    except Exception as e:
        # If there was an error fetching data, return an error message
        return f"Error fetching Aave portfolio: {e!s}"


def set_user_use_reserve_as_collateral(
    wallet: EvmWalletProvider, pool_address: str, asset_address: str, use_as_collateral: bool = True
) -> str:
    """Set asset to be used as collateral or not.

    Args:
        wallet: The wallet provider for sending transactions.
        pool_address: The address of the Aave Pool contract.
        asset_address: The address of the asset to enable/disable as collateral.
        use_as_collateral: Whether to use as collateral or not. Default is True.

    Returns:
        str: Transaction hash of the operation.

    """
    pool_contract = Web3().eth.contract(
        address=Web3.to_checksum_address(pool_address), abi=POOL_ABI
    )
    encoded_data = pool_contract.encode_abi(
        "setUserUseReserveAsCollateral",
        args=[Web3.to_checksum_address(asset_address), use_as_collateral],
    )

    params = {
        "to": Web3.to_checksum_address(pool_address),
        "data": encoded_data,
    }

    tx_hash = wallet.send_transaction(params)
    wallet.wait_for_transaction_receipt(tx_hash)
    return tx_hash


def get_asset_price_from_oracle(
    wallet: EvmWalletProvider, network_id: str, asset_address: str
) -> Decimal:
    """Get the price of an asset from the Aave Price Oracle.

    Args:
        wallet: The wallet provider for reading from contracts.
        network_id: The network ID (e.g. "base-mainnet").
        asset_address: The address of the asset to get the price for.

    Returns:
        Decimal: The price of the asset in USD (scaled by 10^8).

    """
    oracle_address = PRICE_ORACLE_ADDRESSES.get(network_id)
    if not oracle_address:
        raise ValueError(f"Price oracle address not found for network {network_id}")

    # Get asset price
    asset_price = wallet.read_contract(
        Web3.to_checksum_address(oracle_address),
        PRICE_ORACLE_ABI,
        "getAssetPrice",
        [Web3.to_checksum_address(asset_address)],
    )

    # Convert to decimal with proper scaling
    return Decimal(asset_price) / Decimal(10**8)
