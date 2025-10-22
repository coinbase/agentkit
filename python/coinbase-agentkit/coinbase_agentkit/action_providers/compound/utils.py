"""Utility functions for Compound action provider."""

from decimal import Decimal
from typing import Any

from ...wallet_providers import EvmWalletProvider
from ..erc20.constants import ERC20_ABI
from .constants import COMET_ABI, PRICE_FEED_ABI


def get_token_decimals(wallet: EvmWalletProvider, token_address: str) -> int:
    """Get the number of decimals for a token using wallet.read_contract.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token.

    Returns:
        int: The number of decimals for the token.

    """
    result = wallet.read_contract(token_address, ERC20_ABI, "decimals")
    return result


def get_token_symbol(wallet: EvmWalletProvider, token_address: str) -> str:
    """Get a token's symbol from its contract using wallet.read_contract.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token contract.

    Returns:
        str: The token symbol.

    """
    return wallet.read_contract(token_address, ERC20_ABI, "symbol")


def get_token_balance(wallet: EvmWalletProvider, token_address: str) -> int:
    """Get the balance of a token for an account using wallet.read_contract.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the token.
        account: The address of the account.

    Returns:
        int: The balance in atomic units.

    """
    return wallet.read_contract(token_address, ERC20_ABI, "balanceOf", args=[wallet.get_address()])


def get_price_feed_data(wallet: EvmWalletProvider, price_feed_address: str) -> tuple[int, int]:
    """Get the latest price data from a Chainlink price feed using wallet.read_contract.

    Args:
        wallet: The wallet provider for reading from contracts.
        price_feed_address: The address of the price feed contract.

    Returns:
        tuple[int, int]: The price and timestamp.

    """
    latest_data = wallet.read_contract(price_feed_address, PRICE_FEED_ABI, "latestRoundData")
    _, answer, _, updated_at, _ = latest_data
    return answer, updated_at


def format_amount_with_decimals(amount: str, decimals: int) -> int:
    """Format a human-readable amount with the correct number of decimals.

    Args:
        amount: The amount as a string (e.g. "0.1").
        decimals: The number of decimals for the token.

    Returns:
        int: The amount in atomic units.

    """
    return int(Decimal(amount) * Decimal(10**decimals))


def format_amount_from_decimals(amount: int, decimals: int) -> str:
    """Format an atomic amount to a human-readable string.

    Args:
        amount: The amount in atomic units.
        decimals: The number of decimals for the token.

    Returns:
        str: The amount as a human-readable string.

    """
    return str(Decimal(amount) / Decimal(10**decimals))


def get_collateral_balance(
    wallet: EvmWalletProvider, compound_address: str, asset_address: str
) -> int:
    """Get the collateral balance of a specific asset for a wallet using wallet.read_contract.

    Args:
        wallet: The wallet to check the balance for.
        compound_address: The address of the Compound market.
        asset_address: The address of the asset to check.

    Returns:
        int: The collateral balance in atomic units.

    """
    return wallet.read_contract(
        compound_address,
        COMET_ABI,
        "collateralBalanceOf",
        args=[wallet.get_address(), asset_address],
    )


def get_borrow_details(wallet: EvmWalletProvider, compound_address: str) -> dict[str, Any]:
    """Get the borrow amount, token symbol, and price for a wallet's position.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.

    Returns:
        dict: Dictionary containing:
            Token Symbol (str): The symbol of the base token.
            Borrow Amount (Decimal): The human-readable amount borrowed.
            Price (Decimal): The price of the base token in USD.

    """
    borrow_amount_raw = wallet.read_contract(
        compound_address, COMET_ABI, "borrowBalanceOf", args=[wallet.get_address()]
    )
    base_token = wallet.read_contract(compound_address, COMET_ABI, "baseToken")
    base_decimals = get_token_decimals(wallet, base_token)
    base_token_symbol = get_token_symbol(wallet, base_token)
    base_price_feed = wallet.read_contract(compound_address, COMET_ABI, "baseTokenPriceFeed")
    base_price_raw, _ = get_price_feed_data(wallet, base_price_feed)

    human_borrow_amount = Decimal(format_amount_from_decimals(borrow_amount_raw, base_decimals))
    price = Decimal(base_price_raw) / Decimal(10**8)

    return {"Token Symbol": base_token_symbol, "Borrow Amount": human_borrow_amount, "Price": price}


def get_supply_details(wallet: EvmWalletProvider, compound_address: str) -> list[dict[str, Any]]:
    """Get supply details for all assets supplied by the wallet.

    For each asset supplied the raw collateral balance (atomic units) is converted to a human-readable
    value using token decimals. Additionally, the price (in 8-decimals) is converted to USD and the
    collateral factor is converted from a raw 1e18 value to a fraction.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.

    Returns:
        List[dict]: List of dictionaries containing:
            Token Symbol (str): Symbol of the supplied token.
            Supply Amount (Decimal): Human-readable supplied amount.
            Price (Decimal): Price in USD.
            Collateral Factor (Decimal): Borrow collateral factor as a fraction.
            Decimals (int): Number of decimals for the token.

    """
    num_assets = wallet.read_contract(compound_address, COMET_ABI, "numAssets")
    supply_details = []

    for i in range(num_assets):
        asset_info = wallet.read_contract(compound_address, COMET_ABI, "getAssetInfo", args=[i])
        asset_address = asset_info[1]
        collateral_balance = get_collateral_balance(wallet, compound_address, asset_address)

        if collateral_balance > 0:
            token_symbol = get_token_symbol(wallet, asset_address)
            decimals = get_token_decimals(wallet, asset_address)
            price_raw, _ = get_price_feed_data(wallet, asset_info[2])

            human_supply_amount = Decimal(format_amount_from_decimals(collateral_balance, decimals))
            price = Decimal(price_raw) / Decimal(10**8)
            collateral_factor = Decimal(asset_info[4]) / Decimal(10**18)

            supply_details.append(
                {
                    "Token Symbol": token_symbol,
                    "Supply Amount": human_supply_amount,
                    "Price": price,
                    "Collateral Factor": collateral_factor,
                    "Decimals": decimals,
                }
            )

    return supply_details


def get_health_ratio(wallet: EvmWalletProvider, compound_address: str) -> Decimal:
    """Calculate the current health ratio of a wallet's Compound position.

    Health ratio is calculated using human-readable values:
        - Borrow value = (human borrow amount) * (price)
        - Collateral value = Σ (human supply amount * price * collateral factor)
    A ratio >= 1 indicates a healthy position.
    Returns infinity if there are no borrows.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.

    Returns:
        Decimal: The current health ratio.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    borrow_value = Decimal(borrow_details["Borrow Amount"]) * Decimal(borrow_details["Price"])

    total_adjusted_collateral = Decimal(0)
    for supply in supply_details:
        collateral_value = Decimal(supply["Supply Amount"]) * Decimal(supply["Price"])
        adjusted_value = collateral_value * Decimal(supply["Collateral Factor"])
        total_adjusted_collateral += adjusted_value

    return Decimal("Infinity") if borrow_value == 0 else total_adjusted_collateral / borrow_value


def get_health_ratio_after_borrow(
    wallet: EvmWalletProvider, compound_address: str, borrow_amount: str
) -> Decimal:
    """Calculate what the health ratio would be after a proposed borrow.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.
        borrow_amount: The additional amount to borrow in atomic units.

    Returns:
        Decimal: The projected health ratio after the borrow.
               Returns infinity if there would be no borrows.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    base_token = wallet.read_contract(compound_address, COMET_ABI, "baseToken")
    base_decimals = get_token_decimals(wallet, base_token)
    additional_borrow = Decimal(format_amount_from_decimals(int(borrow_amount), base_decimals))

    current_borrow = Decimal(borrow_details["Borrow Amount"])
    new_borrow = current_borrow + additional_borrow
    new_borrow_value = new_borrow * Decimal(borrow_details["Price"])

    total_adjusted_collateral = Decimal(0)
    for supply in supply_details:
        collateral_value = Decimal(supply["Supply Amount"]) * Decimal(supply["Price"])
        total_adjusted_collateral += collateral_value * Decimal(supply["Collateral Factor"])

    return (
        Decimal("Infinity")
        if new_borrow_value == 0
        else total_adjusted_collateral / new_borrow_value
    )


def get_health_ratio_after_withdraw(
    wallet: EvmWalletProvider, compound_address: str, asset_address: str, withdraw_amount: str
) -> Decimal:
    """Calculate what the health ratio would be after a proposed withdrawal.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.
        asset_address: The address of the asset to withdraw.
        withdraw_amount: The amount to withdraw in atomic units.

    Returns:
        Decimal: The projected health ratio after the withdrawal.
               Returns infinity if there would be no borrows.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    borrow_value = Decimal(borrow_details["Borrow Amount"]) * Decimal(borrow_details["Price"])

    total_adjusted_collateral = Decimal(0)
    for supply in supply_details:
        if supply["Token Symbol"] == get_token_symbol(wallet, asset_address):
            # Subtract the withdrawal amount from this asset's supply
            decimals = get_token_decimals(wallet, asset_address)
            withdraw_amount_human = Decimal(
                format_amount_from_decimals(int(withdraw_amount), decimals)
            )
            supply_amount = Decimal(supply["Supply Amount"]) - withdraw_amount_human
            asset_value = supply_amount * Decimal(supply["Price"])
            total_adjusted_collateral += asset_value * Decimal(supply["Collateral Factor"])
        else:
            # Other assets remain unchanged
            collateral_value = Decimal(supply["Supply Amount"]) * Decimal(supply["Price"])
            total_adjusted_collateral += collateral_value * Decimal(supply["Collateral Factor"])

    return Decimal("Infinity") if borrow_value == 0 else total_adjusted_collateral / borrow_value


def get_portfolio_details_markdown(wallet: EvmWalletProvider, comet_address: str) -> str:
    """Get formatted portfolio details in markdown.

    Args:
        wallet: The wallet to use for getting details
        comet_address: The address of the Compound Comet contract

    Returns:
        str: Markdown formatted portfolio details

    """
    markdown_output = "# Portfolio Details\n\n"

    markdown_output += "## Supply Details\n\n"
    total_supply_value = Decimal(0)

    supply_details = get_supply_details(wallet, comet_address)

    if supply_details:
        for supply in supply_details:
            token = supply["Token Symbol"]
            supply_amount = supply["Supply Amount"]
            price = supply["Price"]
            decimals = supply["Decimals"]
            collateral_factor = supply["Collateral Factor"]
            asset_value = supply_amount * price

            markdown_output += f"### {token}\n"
            markdown_output += f"- **Supply Amount:** {format(supply_amount, f'.{decimals}f')}\n"
            markdown_output += f"- **Price:** ${price:.2f}\n"
            markdown_output += f"- **Collateral Factor:** {collateral_factor:.2f}\n"
            markdown_output += f"- **Asset Value:** ${asset_value:.2f}\n\n"
            total_supply_value += asset_value
    else:
        markdown_output += "No supplied assets found in your Compound position.\n\n"

    markdown_output += f"### Total Supply Value: ${total_supply_value:.2f}\n\n"

    markdown_output += "## Borrow Details\n\n"

    borrow_details = get_borrow_details(wallet, comet_address)
    borrow_amount = borrow_details["Borrow Amount"]

    if borrow_amount > 0:
        token = borrow_details["Token Symbol"]
        price = borrow_details["Price"]
        borrow_value = borrow_amount * price

        markdown_output += f"### {token}\n"
        markdown_output += f"- **Borrow Amount:** {borrow_amount:.6f}\n"
        markdown_output += f"- **Price:** ${price:.2f}\n"
        markdown_output += f"- **Borrow Value:** ${borrow_value:.2f}\n\n"
    else:
        markdown_output += "No borrowed assets found in your Compound position.\n\n"

    markdown_output += "## Overall Health\n\n"
    health_ratio = get_health_ratio(wallet, comet_address)
    markdown_output += f"- **Health Ratio:** {health_ratio:.2f}\n"

    return markdown_output


def get_base_token_address(wallet: EvmWalletProvider, comet_address: str) -> str:
    """Get the base token address from the Compound market.

    Args:
        wallet: The wallet provider for reading from contracts.
        comet_address: The address of the Compound Comet contract.

    Returns:
        str: The address of the base token.

    """
    return wallet.read_contract(comet_address, COMET_ABI, "baseToken")
