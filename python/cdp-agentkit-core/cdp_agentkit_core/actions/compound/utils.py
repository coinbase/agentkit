from decimal import Decimal

from cdp import Asset, Wallet
from cdp.smart_contract import SmartContract

from cdp_agentkit_core.actions.compound.constants import CUSDCV3_ABI


def get_token_decimals(wallet: Wallet, token_address: str) -> int:
    """Get the token's decimals by reading directly from the token contract.

    Args:
        wallet: The wallet to use for the contract call
        token_address: The address of the token contract

    Returns:
        int: The token's decimals

    """
    return SmartContract.read(
        wallet.network_id,
        token_address,
        "decimals",
        abi=[{
            "inputs": [],
            "name": "decimals",
            "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
            "stateMutability": "view",
            "type": "function"
        }],
    )

def get_token_symbol(wallet: Wallet, token_address: str) -> str:
    """Get a token's symbol from its contract.

    Args:
        wallet: The wallet to use for the contract call
        token_address: The address of the token contract

    Returns:
        str: The token symbol

    """
    return SmartContract.read(
        wallet.network_id,
        token_address,
        "symbol",
        abi=[{
            "inputs": [],
            "name": "symbol",
            "outputs": [
                {"internalType": "string", "name": "", "type": "string"}
            ],
            "stateMutability": "view",
            "type": "function"
        }],
    )

def get_collateral_balance(
    wallet: Wallet,
    compound_address: str,
    asset_address: str,
) -> int:
    """Get the collateral balance of a specific asset for a wallet.

    Args:
        wallet: The wallet to check the balance for.
        compound_address: The address of the Compound market.
        asset_address: The address of the asset to check.

    Returns:
        int: The collateral balance in atomic units.

    """
    return SmartContract.read(
        wallet.network_id,
        compound_address,
        "collateralBalanceOf",
        args={
            "account": wallet.default_address.address_id,
            "asset": asset_address,
        },
        abi=CUSDCV3_ABI,
    )

def get_borrow_details(
    wallet: Wallet,
    compound_address: str,
) -> dict:
    """Get the borrow amount, token symbol, and price for a wallet's position.

    The raw borrow amount (atomic units) is converted to a human-readable whole number using the asset's
    conversion helper. The price returned from the base token price feed is in 8-decimal precision and
    is converted to a $1.00-precision value.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.

    Returns:
        dict: Dictionary containing:
            Token Symbol (str): The symbol of the base token.
            Borrow Amount (float): The human-readable amount borrowed.
            Price (float): The price of the base token in USD.

    """
    borrow_amount_raw = SmartContract.read(
        wallet.network_id,
        compound_address,
        "borrowBalanceOf",
        args={"account": wallet.default_address.address_id},
        abi=CUSDCV3_ABI,
    )

    base_token_address = SmartContract.read(
        wallet.network_id,
        compound_address,
        "baseToken",
        abi=CUSDCV3_ABI,
    )

    # Fetch the asset to use its conversion helpers.
    base_asset = Asset.fetch(wallet.network_id, base_token_address)
    base_token_id = base_asset.asset_id
    human_borrow_amount = float(base_asset.from_atomic_amount(Decimal(borrow_amount_raw)))

    base_price_feed = SmartContract.read(
        wallet.network_id,
        compound_address,
        "baseTokenPriceFeed",
        abi=CUSDCV3_ABI,
    )

    base_price_raw = SmartContract.read(
        wallet.network_id,
        compound_address,
        "getPrice",
        args={"priceFeed": base_price_feed},
        abi=CUSDCV3_ABI,
    )

    # Convert price: raw price is in 8-decimal precision.
    price = float(Decimal(base_price_raw) / Decimal(1e8))

    return {
        "Token Symbol": base_token_id,
        "Borrow Amount": human_borrow_amount,
        "Price": price
    }

def get_supply_details(
    wallet: Wallet,
    compound_address: str,
) -> list[dict]:
    """Get supply details for all assets supplied by the wallet.

    For each asset supplied the raw collateral balance (atomic) is converted to a human-readable value
    using the asset's conversion helper. Additionally, the price (in 8-decimals) is converted to USD price
    and the collateral factor is converted from a raw 1e18 value to a fraction.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.

    Returns:
        List[dict]: List of dictionaries containing:
            Token Symbol (str): Symbol of the supplied token.
            Supply Amount (float): Human-readable supplied amount.
            Price (float): Price in USD.
            Collateral Factor (float): Borrow collateral factor as a fraction.

    """
    num_assets = SmartContract.read(
        wallet.network_id,
        compound_address,
        "numAssets",
        abi=CUSDCV3_ABI,
    )

    supply_details = []

    for i in range(num_assets):
        asset_info = SmartContract.read(
            wallet.network_id,
            compound_address,
            "getAssetInfo",
            args={"i": str(i)},
            abi=CUSDCV3_ABI,
        )

        collateral_balance_raw = get_collateral_balance(wallet, compound_address, asset_info["asset"])

        # Use the get_token_symbol helper to obtain the token symbol from the contract.
        token_symbol = get_token_symbol(wallet, asset_info["asset"])

        # Fetch the asset solely for its conversion helper (not for the token id).
        asset = Asset.fetch(wallet.network_id, asset_info["asset"])
        human_supply_amount = float(asset.from_atomic_amount(Decimal(collateral_balance_raw)))

        price_raw = SmartContract.read(
            wallet.network_id,
            compound_address,
            "getPrice",
            args={"priceFeed": asset_info["priceFeed"]},
            abi=CUSDCV3_ABI,
        )
        price = float(Decimal(price_raw) / Decimal(1e8))
        collateral_factor = float(Decimal(asset_info["borrowCollateralFactor"]) / Decimal(1e18))

        supply_details.append({
            "Token Symbol": token_symbol,
            "Supply Amount": human_supply_amount,
            "Price": price,
            "Collateral Factor": collateral_factor
        })

    return supply_details

def get_health_ratio(
    wallet: Wallet,
    compound_address: str,
) -> float:
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
        float: The current health ratio.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    borrow_value = Decimal(borrow_details["Borrow Amount"]) * Decimal(borrow_details["Price"])

    total_adjusted_collateral = Decimal(0)
    for supply in supply_details:
        collateral_value = Decimal(supply["Supply Amount"]) * Decimal(supply["Price"])
        total_adjusted_collateral += collateral_value * Decimal(supply["Collateral Factor"])

    return float('inf') if borrow_value == 0 else float(total_adjusted_collateral / borrow_value)

def get_health_ratio_after_borrow(
    wallet: Wallet,
    compound_address: str,
    borrow_amount: str,
) -> float:
    """Calculate what the health ratio would be after a proposed borrow.

    The additional borrow amount (provided in atomic units) is converted to a human-readable whole amount
    using the base asset's conversion helper before calculation.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.
        borrow_amount: The additional amount to borrow in atomic units.

    Returns:
        float: The projected health ratio after the borrow.
               Returns infinity if there would be no borrows.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    base_token_address = SmartContract.read(
        wallet.network_id,
        compound_address,
        "baseToken",
        abi=CUSDCV3_ABI,
    )
    base_asset = Asset.fetch(wallet.network_id, base_token_address)
    additional_borrow = base_asset.from_atomic_amount(Decimal(borrow_amount))
    current_borrow = Decimal(borrow_details["Borrow Amount"])
    new_borrow = current_borrow + additional_borrow

    new_borrow_value = new_borrow * Decimal(borrow_details["Price"])

    total_adjusted_collateral = Decimal(0)
    for supply in supply_details:
        collateral_value = Decimal(supply["Supply Amount"]) * Decimal(supply["Price"])
        total_adjusted_collateral += collateral_value * Decimal(supply["Collateral Factor"])

    return float('inf') if new_borrow_value == 0 else float(total_adjusted_collateral / new_borrow_value)

def get_health_ratio_after_withdraw(
    wallet: Wallet,
    compound_address: str,
    asset_address: str,
    withdraw_amount: str,
) -> float:
    """Calculate what the health ratio would be after a proposed withdrawal.

    The withdraw_amount (provided in atomic units) is converted to a human-readable whole amount using the
    asset's conversion helper. Returns infinity if there are no borrows.

    Args:
        wallet: The wallet to check the position for.
        compound_address: The address of the Compound market.
        asset_address: The address of the asset being withdrawn.
        withdraw_amount: The amount to withdraw in atomic units.

    Returns:
        float: The projected health ratio after the withdrawal.

    """
    borrow_details = get_borrow_details(wallet, compound_address)
    supply_details = get_supply_details(wallet, compound_address)

    borrow_value = Decimal(borrow_details["Borrow Amount"]) * Decimal(borrow_details["Price"])
    total_adjusted_collateral = Decimal(0)

    # Use the asset's conversion helper via Asset.fetch.
    target_asset = Asset.fetch(wallet.network_id, asset_address)
    for supply in supply_details:
        if supply["Token Symbol"] == target_asset.asset_id:
            withdraw_human = target_asset.from_atomic_amount(Decimal(withdraw_amount))
            new_supply_amount = Decimal(str(supply["Supply Amount"])) - withdraw_human
            if new_supply_amount < 0:
                new_supply_amount = Decimal(0)
        else:
            new_supply_amount = Decimal(str(supply["Supply Amount"]))
        collateral_value = new_supply_amount * Decimal(supply["Price"])
        total_adjusted_collateral += collateral_value * Decimal(supply["Collateral Factor"])

    return float('inf') if borrow_value == 0 else float(total_adjusted_collateral / borrow_value)


