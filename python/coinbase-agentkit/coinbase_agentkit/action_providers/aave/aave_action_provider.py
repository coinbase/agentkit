"""Aave action provider for interacting with Aave V3 protocol."""

from decimal import Decimal
from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import (
    ASSET_ADDRESSES,
    POOL_ABI,
    POOL_ADDRESSES,
    SUPPORTED_NETWORKS,
)
from .schemas import (
    AaveBorrowSchema,
    AavePortfolioSchema,
    AaveRepaySchema,
    AaveSetAsCollateralSchema,
    AaveSupplySchema,
    AaveWithdrawSchema,
)
from .utils import (
    approve_token,
    format_amount_from_decimals,
    format_amount_with_decimals,
    get_asset_price_from_oracle,
    get_health_factor,
    get_portfolio_details_markdown,
    get_token_balance,
    get_token_decimals,
    get_token_symbol,
    get_user_account_data,
    set_user_use_reserve_as_collateral,
)


class AaveActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with Aave V3 protocol."""

    def __init__(self):
        """Initialize the Aave action provider."""
        super().__init__("aave", [])

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Aave actions.

        Args:
            network: The network to check.

        Returns:
            bool: True if the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS

    def _get_pool_address(self, network: Network) -> str:
        """Get the appropriate Aave Pool address based on network.

        Args:
            network: The network to get the address for.

        Returns:
            str: The address of the Aave Pool contract.

        """
        return Web3.to_checksum_address(POOL_ADDRESSES[network.network_id])

    def _get_asset_address(self, network: Network, asset_id: str) -> str:
        """Get the asset address based on network and asset ID.

        Args:
            network: The network to get the asset address for.
            asset_id: The asset ID to get the address of.

        Returns:
            str: The address of the asset.

        """
        try:
            return Web3.to_checksum_address(ASSET_ADDRESSES[network.network_id][asset_id])
        except KeyError as err:
            raise ValueError(f"Asset {asset_id} not supported on {network.network_id}") from err

    @create_action(
        name="supply",
        description="""
This tool allows supplying assets to Aave V3 protocol as collateral for borrowing or earning interest.
It takes:
- asset_id: The asset to supply, one of `weth`, `usdc`, `cbeth`, or `wsteth` (availability depends on network)
- amount: The amount of tokens to supply in human-readable format
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 100 USDC
- on_behalf_of: (Optional) The address to supply on behalf of, defaults to wallet address
- referral_code: (Optional) Referral code, default is 0

Important notes:
- Make sure to use the exact amount provided
- The token must be an approved asset for the Aave market
- Supplying assets will enable them as collateral by default
""",
        schema=AaveSupplySchema,
    )
    def supply(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Supply assets to Aave.

        Args:
            wallet_provider: The wallet to use for the supply operation.
            args: The input arguments for the supply operation.

        Returns:
            str: A message containing the result of the supply operation.

        """
        try:
            validated_args = AaveSupplySchema(**args)
            network = wallet_provider.get_network()

            # Check if the network is supported
            if not self.supports_network(network):
                return f"Error: Network {network.network_id} is not supported by Aave"

            try:
                pool_address = self._get_pool_address(network)
            except Exception as e:
                return f"Error: Could not get Aave Pool address for {network.network_id}: {e!s}"

            try:
                asset_address = self._get_asset_address(network, validated_args.asset_id)
            except ValueError as e:
                return f"Error: {e!s}"
            except Exception as e:
                return f"Error: Could not get asset address for {validated_args.asset_id} on {network.network_id}: {e!s}"

            try:
                decimals = get_token_decimals(wallet_provider, asset_address)
                amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)
            except Exception as e:
                return f"Error: Could not get token information for {validated_args.asset_id} on {network.network_id}. The token contract may not be properly deployed or accessible: {e!s}"

            # Check wallet balance before proceeding
            try:
                wallet_balance = get_token_balance(wallet_provider, asset_address)
                if wallet_balance < amount_atomic:
                    human_balance = format_amount_from_decimals(wallet_balance, decimals)
                    return f"Error: Insufficient balance. You have {human_balance} {validated_args.asset_id}, but trying to supply {validated_args.amount}"
            except Exception as e:
                return f"Error: Could not check balance for {validated_args.asset_id} on {network.network_id}. The token contract may not be properly deployed or accessible: {e!s}"

            # Get current health factor for reference
            try:
                current_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                current_health = Decimal("Infinity")  # No previous borrows

            # Approve Aave to spend tokens
            try:
                _ = approve_token(
                    wallet_provider, asset_address, pool_address, amount_atomic
                )
            except Exception as e:
                return f"Error approving token for Aave: {e!s}"

            # Supply tokens to Aave
            on_behalf_of = validated_args.on_behalf_of or wallet_provider.get_address()
            pool_contract = Web3().eth.contract(
                address=Web3.to_checksum_address(pool_address), abi=POOL_ABI
            )
            encoded_data = pool_contract.encode_abi(
                "supply",
                args=[
                    Web3.to_checksum_address(asset_address),
                    amount_atomic,
                    on_behalf_of,
                    validated_args.referral_code,
                ],
            )

            params = {
                "to": Web3.to_checksum_address(pool_address),
                "data": encoded_data,
            }

            try:
                tx_hash = wallet_provider.send_transaction(params)
                wallet_provider.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                error_msg = str(e)
                if (
                    "not deployed" in error_msg.lower()
                    or "call contract function" in error_msg.lower()
                ):
                    return f"Error: Could not supply {validated_args.asset_id} to Aave on {network.network_id}. This token may not be properly supported by Aave on this network."
                return f"Error executing supply transaction: {e!s}"

            # Get new health factor
            try:
                new_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                new_health = current_health  # Fallback

            token_symbol = get_token_symbol(wallet_provider, asset_address)

            # Format health factor strings and compose the final message
            if current_health == Decimal("Infinity") and new_health == Decimal("Infinity"):
                health_message = ""
            else:
                health_message = (
                    f"\nHealth factor changed from {current_health:.2f} to {new_health:.2f}"
                )

            return (
                f"Successfully supplied {validated_args.amount} {token_symbol} to Aave.\n"
                f"Transaction hash: {tx_hash}"
                f"{health_message}"
            )
        except Exception as e:
            return f"Error supplying to Aave: {e!s}"

    @create_action(
        name="withdraw",
        description="""
This tool allows withdrawing assets from Aave V3 protocol.
It takes:
- asset_id: The asset to withdraw, one of `weth`, `usdc`, `cbeth`, or `wsteth` (availability depends on network)
- amount: The amount of tokens to withdraw in human-readable format or 'max' to withdraw all
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 100 USDC
    - max
- to: (Optional) The address to withdraw to, defaults to wallet address

Important notes:
- Make sure the withdrawal won't put your health factor at risk
- The token must be an asset you have supplied to the Aave market
- If you have active borrows, you may not be able to withdraw all collateral
""",
        schema=AaveWithdrawSchema,
    )
    def withdraw(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Withdraw assets from Aave.

        Args:
            wallet_provider: The wallet to use for the withdraw operation.
            args: The input arguments for the withdraw operation.

        Returns:
            str: A message containing the result of the withdraw operation.

        """
        try:
            validated_args = AaveWithdrawSchema(**args)
            network = wallet_provider.get_network()
            pool_address = self._get_pool_address(network)
            asset_address = self._get_asset_address(network, validated_args.asset_id)

            decimals = get_token_decimals(wallet_provider, asset_address)
            amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)

            # Get current health factor for reference
            try:
                current_health = get_health_factor(wallet_provider, pool_address)

                # Check if the user has active borrows and the health factor could be affected
                account_data = get_user_account_data(wallet_provider, pool_address)
                has_borrows = account_data["totalDebtBaseUnits"] > 0

                if has_borrows and validated_args.amount == "max":
                    return "Error: You have active borrows. You cannot withdraw all your collateral. Specify an exact amount instead."
            except Exception as e:
                return f"Error checking account data: {e!s}"

            # Execute withdraw from Aave
            to_address = validated_args.to or wallet_provider.get_address()
            pool_contract = Web3().eth.contract(
                address=Web3.to_checksum_address(pool_address), abi=POOL_ABI
            )
            encoded_data = pool_contract.encode_abi(
                "withdraw",
                args=[
                    Web3.to_checksum_address(asset_address),
                    amount_atomic,
                    to_address,
                ],
            )

            params = {
                "to": Web3.to_checksum_address(pool_address),
                "data": encoded_data,
            }

            try:
                tx_hash = wallet_provider.send_transaction(params)
                receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

                # Check if the transaction was successful
                if receipt.status != 1:
                    return "Error: Transaction failed. Your health factor may be at risk if you withdraw this amount."
            except Exception as e:
                return f"Error executing withdraw transaction: {e!s}"

            # Get new health factor
            try:
                new_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                new_health = Decimal("Infinity")  # Fallback

            token_symbol = get_token_symbol(wallet_provider, asset_address)
            amount_display = (
                validated_args.amount if validated_args.amount != "max" else "all available"
            )

            # Format health factor strings and compose the final message
            if current_health == Decimal("Infinity") and new_health == Decimal("Infinity"):
                health_message = ""
            else:
                health_message = (
                    f"\nHealth factor changed from {current_health:.2f} to {new_health:.2f}"
                )

            return (
                f"Successfully withdrew {amount_display} {token_symbol} from Aave.\n"
                f"Transaction hash: {tx_hash}"
                f"{health_message}"
            )
        except Exception as e:
            return f"Error withdrawing from Aave: {e!s}"

    @create_action(
        name="borrow",
        description="""
This tool allows borrowing assets from Aave V3 protocol against your supplied collateral.
It takes:
- asset_id: The asset to borrow, one of `weth`, `usdc`, `cbeth`, or `wsteth` (availability depends on network)
- amount: The amount of tokens to borrow in human-readable format
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 100 USDC
- interest_rate_mode: (Optional) Interest rate mode: 1 for stable, 2 for variable. Default is variable (2).
- on_behalf_of: (Optional) The address to borrow on behalf of, defaults to wallet address
- referral_code: (Optional) Referral code, default is 0

Important notes:
- Make sure you have enough collateral supplied
- Borrowing will reduce your health factor - maintain it above 1 to avoid liquidation
- Variable rate is recommended for most users (lower upfront cost but can change)
- Some assets may only support variable rate
""",
        schema=AaveBorrowSchema,
    )
    def borrow(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Borrow assets from Aave.

        Args:
            wallet_provider: The wallet to use for the borrow operation.
            args: The input arguments for the borrow operation.

        Returns:
            str: A message containing the result of the borrow operation.

        """
        try:
            validated_args = AaveBorrowSchema(**args)
            network = wallet_provider.get_network()
            pool_address = self._get_pool_address(network)
            asset_address = self._get_asset_address(network, validated_args.asset_id)

            decimals = get_token_decimals(wallet_provider, asset_address)
            amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)

            # Check collateral and borrowing capacity
            try:
                account_data = get_user_account_data(wallet_provider, pool_address)
                if account_data["totalCollateralBaseUnits"] == 0:
                    return "Error: You have no collateral supplied. Supply assets as collateral before borrowing."

                # Get asset price from oracle for accurate USD conversion
                network = wallet_provider.get_network()
                network_id = network.network_id

                try:
                    # Get asset price from Aave Oracle
                    asset_price = get_asset_price_from_oracle(
                        wallet_provider, network_id, asset_address
                    )

                    # Calculate USD value of borrow amount
                    amount_decimal = Decimal(validated_args.amount)
                    # Asset price is already in USD base units (scaled by 10^8)
                    estimated_borrow_base_units = (
                        amount_decimal * asset_price * Decimal(10 ** (8 - decimals))
                    )

                    # Compare with available borrows (also in USD base units)
                    if estimated_borrow_base_units > account_data["availableBorrowsBaseUnits"]:
                        # Convert to human-readable USD for error message
                        max_borrow_usd = account_data["availableBorrowsUSD"]
                        token_symbol = get_token_symbol(wallet_provider, asset_address)
                        return f"Error: Insufficient borrowing capacity. You can borrow up to ${max_borrow_usd:.4f} worth of assets."
                except Exception as e:
                    # Fallback to simpler check if oracle fails
                    if account_data["availableBorrowsBaseUnits"] == 0:
                        return "Error: You have no borrowing capacity available."
                    return f"Error getting asset price: {e}. Please try again."
            except Exception as e:
                return f"Error checking account data: {e!s}"

            # Get current health factor for reference
            current_health = account_data["healthFactor"]

            # Execute borrow from Aave
            on_behalf_of = validated_args.on_behalf_of or wallet_provider.get_address()
            pool_contract = Web3().eth.contract(
                address=Web3.to_checksum_address(pool_address), abi=POOL_ABI
            )
            encoded_data = pool_contract.encode_abi(
                "borrow",
                args=[
                    Web3.to_checksum_address(asset_address),
                    amount_atomic,
                    validated_args.interest_rate_mode,
                    validated_args.referral_code,
                    on_behalf_of,
                ],
            )

            params = {
                "to": Web3.to_checksum_address(pool_address),
                "data": encoded_data,
            }

            try:
                tx_hash = wallet_provider.send_transaction(params)
                receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

                # Check if the transaction was successful
                if receipt.status != 1:
                    return "Error: Transaction failed. The borrow may exceed your available borrowing capacity."
            except Exception as e:
                return f"Error executing borrow transaction: {e!s}"

            # Get new health factor
            try:
                new_account_data = get_user_account_data(wallet_provider, pool_address)
                new_health = new_account_data["healthFactor"]
            except Exception:
                new_health = Decimal("0")  # Default to show warning

            token_symbol = get_token_symbol(wallet_provider, asset_address)
            interest_mode = "variable" if validated_args.interest_rate_mode == 2 else "stable"

            # Warning message if health factor is low
            warning_message = ""
            if new_health < 1.1 and new_health != Decimal("Infinity"):
                warning_message = f"\n⚠️ WARNING: Your health factor is now {new_health:.2f}, which is dangerously low. Consider repaying some debt or adding more collateral to avoid liquidation."

            return (
                f"Successfully borrowed {validated_args.amount} {token_symbol} from Aave with {interest_mode} interest rate.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Health factor changed from {current_health:.2f} to {new_health:.2f}"
                f"{warning_message}"
            )
        except Exception as e:
            return f"Error borrowing from Aave: {e!s}"

    @create_action(
        name="repay",
        description="""
This tool allows repaying borrowed assets to Aave V3 protocol.
It takes:
- asset_id: The asset to repay, one of `weth`, `usdc`, `cbeth`, or `wsteth` (availability depends on network)
- amount: The amount of tokens to repay in human-readable format or 'max' to repay all
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 100 USDC
    - max
- interest_rate_mode: (Optional) Interest rate mode: 1 for stable, 2 for variable. Default is variable (2).
- on_behalf_of: (Optional) The address to repay debt for, defaults to wallet address

Important notes:
- Make sure to have the required tokens in your wallet
- Repaying will increase your health factor, reducing liquidation risk
- You must specify the correct interest rate mode for the debt you're repaying
""",
        schema=AaveRepaySchema,
    )
    def repay(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Repay borrowed assets to Aave.

        Args:
            wallet_provider: The wallet to use for the repay operation.
            args: The input arguments for the repay operation.

        Returns:
            str: A message containing the result of the repay operation.

        """
        try:
            validated_args = AaveRepaySchema(**args)
            network = wallet_provider.get_network()
            pool_address = self._get_pool_address(network)
            asset_address = self._get_asset_address(network, validated_args.asset_id)

            decimals = get_token_decimals(wallet_provider, asset_address)
            amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)

            # Check wallet balance if not using max (which will use available balance)
            if validated_args.amount != "max":
                wallet_balance = get_token_balance(wallet_provider, asset_address)
                if wallet_balance < amount_atomic:
                    human_balance = format_amount_from_decimals(wallet_balance, decimals)
                    return f"Error: Insufficient balance. You have {human_balance} {validated_args.asset_id}, but trying to repay {validated_args.amount}"

            # Get current health factor for reference
            try:
                current_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                current_health = Decimal("Infinity")  # No borrows (unlikely if repaying)

            # Approve Aave to spend tokens (not needed for max amount, but safer to approve anyway)
            try:
                _ = approve_token(
                    wallet_provider, asset_address, pool_address, amount_atomic
                )
            except Exception as e:
                return f"Error approving token: {e!s}"

            # Execute repay to Aave
            on_behalf_of = validated_args.on_behalf_of or wallet_provider.get_address()
            pool_contract = Web3().eth.contract(
                address=Web3.to_checksum_address(pool_address), abi=POOL_ABI
            )
            encoded_data = pool_contract.encode_abi(
                "repay",
                args=[
                    Web3.to_checksum_address(asset_address),
                    amount_atomic,
                    validated_args.interest_rate_mode,
                    on_behalf_of,
                ],
            )

            params = {
                "to": Web3.to_checksum_address(pool_address),
                "data": encoded_data,
            }

            try:
                tx_hash = wallet_provider.send_transaction(params)
                receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

                # Check if the transaction was successful
                if receipt.status != 1:
                    return "Error: Transaction failed. You may not have borrowed this asset with the specified interest rate mode."
            except Exception as e:
                return f"Error executing repay transaction: {e!s}"

            # Get new health factor
            try:
                new_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                new_health = current_health  # Fallback

            token_symbol = get_token_symbol(wallet_provider, asset_address)
            amount_display = (
                validated_args.amount if validated_args.amount != "max" else "all outstanding"
            )
            interest_mode = "variable" if validated_args.interest_rate_mode == 2 else "stable"

            # Format health factor strings and compose the final message
            if new_health == Decimal("Infinity"):
                health_message = "\nYou have repaid all your debt and have no active borrows."
            else:
                health_message = (
                    f"\nHealth factor changed from {current_health:.2f} to {new_health:.2f}"
                )

            return (
                f"Successfully repaid {amount_display} {token_symbol} to Aave with {interest_mode} interest rate.\n"
                f"Transaction hash: {tx_hash}"
                f"{health_message}"
            )
        except Exception as e:
            return f"Error repaying to Aave: {e!s}"

    @create_action(
        name="get_portfolio",
        description="""
This tool retrieves your Aave V3 portfolio details, showing your supplied collateral, borrowed assets, and health factor.
It takes:
- account: (Optional) The address to get portfolio details for, defaults to wallet address

Information provided includes:
- Total supplied collateral value
- Total borrowed value
- Available borrowing capacity
- Health factor (indicating liquidation risk)
- Individual asset positions

A health factor above 1 means your position is safe from liquidation.
A higher health factor indicates lower liquidation risk.
""",
        schema=AavePortfolioSchema,
    )
    def get_portfolio(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get portfolio details from Aave.

        Args:
            wallet_provider: The wallet to use for getting portfolio details.
            args: The input arguments for getting portfolio details.

        Returns:
            str: A message containing the portfolio details.

        """
        try:
            validated_args = AavePortfolioSchema(**args)
            network = wallet_provider.get_network()
            account = validated_args.account or wallet_provider.get_address()

            return get_portfolio_details_markdown(wallet_provider, network.network_id, account)
        except Exception as e:
            return f"Error getting portfolio details from Aave: {e!s}"

    @create_action(
        name="set_collateral",
        description="""
This tool allows setting whether an asset is used as collateral in Aave V3 protocol.
It takes:
- asset_id: The asset to set as collateral, one of `weth`, `usdc`, `cbeth`, or `wsteth` (availability depends on network)
- use_as_collateral: Whether to use the asset as collateral (True) or not (False), defaults to True

Important notes:
- The asset must already be supplied to Aave
- Setting an asset as collateral affects your borrowing capacity and liquidation risk
- This is required to have supplied assets count toward your total collateral value
""",
        schema=AaveSetAsCollateralSchema,
    )
    def set_collateral(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Set whether an asset is used as collateral.

        Args:
            wallet_provider: The wallet to use for the operation.
            args: The input arguments for the operation.

        Returns:
            str: A message containing the result of the operation.

        """
        try:
            validated_args = AaveSetAsCollateralSchema(**args)
            network = wallet_provider.get_network()
            pool_address = self._get_pool_address(network)
            asset_address = self._get_asset_address(network, validated_args.asset_id)

            # Get current health factor for reference
            try:
                current_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                current_health = Decimal("Infinity")  # No previous borrows

            # Execute setUserUseReserveAsCollateral
            try:
                tx_hash = set_user_use_reserve_as_collateral(
                    wallet_provider, pool_address, asset_address, validated_args.use_as_collateral
                )
            except Exception as e:
                return f"Error setting asset as collateral: {e!s}"

            # Get new health factor
            try:
                new_health = get_health_factor(wallet_provider, pool_address)
            except Exception:
                new_health = current_health  # Fallback

            token_symbol = get_token_symbol(wallet_provider, asset_address)

            # Get account data to see the changes in collateral
            try:
                account_data = get_user_account_data(wallet_provider, pool_address)
                collateral_eth = account_data["totalCollateralBase"]
                collateral_wei = account_data["totalCollateralWei"]
            except Exception:
                collateral_eth = Decimal("0")
                collateral_wei = 0

            # Format health factor strings and compose the final message
            if current_health == Decimal("Infinity") and new_health == Decimal("Infinity"):
                health_message = ""
            else:
                health_message = (
                    f"\nHealth factor changed from {current_health:.2f} to {new_health:.2f}"
                )

            action = "enabled" if validated_args.use_as_collateral else "disabled"
            return (
                f"Successfully {action} {token_symbol} as collateral.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Total collateral now: {collateral_eth} ETH ({collateral_wei} Wei)"
                f"{health_message}"
            )
        except Exception as e:
            return f"Error setting collateral in Aave: {e!s}"


def aave_action_provider() -> AaveActionProvider:
    """Create a new AaveActionProvider instance.

    Returns:
        AaveActionProvider: A new instance of the Aave action provider.

    """
    return AaveActionProvider()
