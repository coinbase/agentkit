"""Compound action provider for interacting with Compound protocol."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import (
    ASSET_ADDRESSES,
    COMET_ABI,
    COMET_ADDRESSES,
    ERC20_ABI,
    SUPPORTED_NETWORKS,
)
from .schemas import (
    CompoundBorrowInput,
    CompoundPortfolioInput,
    CompoundRepayInput,
    CompoundSupplyInput,
    CompoundWithdrawInput,
)
from .utils import (
    format_amount_from_decimals,
    format_amount_with_decimals,
    get_collateral_balance,
    get_health_ratio,
    get_health_ratio_after_borrow,
    get_health_ratio_after_withdraw,
    get_portfolio_details_markdown,
    get_token_balance,
    get_token_decimals,
    get_token_symbol,
)


class CompoundActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with Compound protocol."""

    def __init__(self):
        super().__init__("compound", [])

    def _get_comet_address(self, network: Network) -> str:
        """Get the appropriate Comet address based on network."""
        return COMET_ADDRESSES[network.network_id]

    def _get_asset_address(self, network: Network, asset_id: str) -> str:
        """Get the asset address based on network and asset ID."""
        return ASSET_ADDRESSES[network.network_id][asset_id]

    @create_action(
        name="supply",
        description="""
This tool allows supplying collateral assets to Compound.
It takes:
- asset_id: The asset to supply, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`
- amount: The amount of tokens to supply in human-readable format
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH
Important notes:
- Make sure to use the exact amount provided
- The token must be an approved collateral asset for the Compound market
""",
        schema=CompoundSupplyInput,
    )
    def supply(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Supply collateral assets to Compound."""
        try:
            print(f"Starting supply with args: {args}")
            validated_args = CompoundSupplyInput(**args)
            comet_address = self._get_comet_address(wallet.get_network())
            token_address = self._get_asset_address(wallet.get_network(), validated_args.asset_id)
            print(f"Comet address: {comet_address}")
            print(f"Token address: {token_address}")

            # Get token decimals using wallet.read_contract
            decimals = get_token_decimals(wallet, token_address)
            amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)
            print(f"Token decimals: {decimals}")
            print(f"Amount atomic: {amount_atomic}")

            # Check wallet balance before proceeding
            wallet_balance = get_token_balance(wallet, token_address)
            print(f"Wallet balance: {wallet_balance}")
            if wallet_balance < amount_atomic:
                human_balance = format_amount_from_decimals(wallet_balance, decimals)
                return f"Error: Insufficient balance. You have {human_balance}, but trying to supply {validated_args.amount}"

            # Get current health ratio for reference
            current_health = get_health_ratio(wallet, comet_address)
            print(f"Current health ratio: {current_health}")

            # Approve Compound to spend tokens
            token_contract = Web3().eth.contract(address=token_address, abi=ERC20_ABI)
            encoded_data = token_contract.encode_abi("approve", args=[comet_address, amount_atomic])
            params = {
                "to": token_address,
                "data": encoded_data,
            }
            try:
                tx_hash = wallet.send_transaction(params)
                wallet.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                return f"Error approving token: {e!s}"

            # Supply tokens to Compound
            contract = Web3().eth.contract(address=comet_address, abi=COMET_ABI)
            encoded_data = contract.encode_abi(
                "supply",
                args=[token_address, amount_atomic],
            )

            params = {
                "to": comet_address,
                "data": encoded_data,
            }
            print(f"Transaction params: {params}")

            try:
                print("Sending transaction...")
                tx_hash = wallet.send_transaction(params)
                print(f"Transaction sent with hash: {tx_hash}")
                wallet.wait_for_transaction_receipt(tx_hash)
                print("Transaction confirmed")
            except Exception as e:
                print(f"Transaction failed: {e!s}")
                return f"Error executing transaction: {e!s}"

            # Get new health ratio
            new_health = get_health_ratio(wallet, comet_address)
            token_symbol = get_token_symbol(wallet, token_address)
            print(f"New health ratio: {new_health}")
            print(f"Supply operation completed for {validated_args.amount} {token_symbol}")

            return (
                f"Supplied {validated_args.amount} {token_symbol} to Compound.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Health ratio changed from {current_health:.2f} to {new_health:.2f}"
            )
        except Exception as e:
            print(f"Supply operation failed with error: {e!s}")
            return f"Error supplying to Compound: {e!s}"

    @create_action(
        name="withdraw",
        description="""
This tool allows withdrawing collateral assets from Compound.
It takes:
- asset_id: The asset to withdraw, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`
- amount: The amount of tokens to withdraw in human-readable format
    Examples:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH
Important notes:
- Make sure to use the exact amount provided
- The token must be a collateral asset you have supplied to the Compound market
""",
        schema=CompoundWithdrawInput,
    )
    def withdraw(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Withdraw collateral assets from Compound."""
        try:
            print("Starting withdraw operation...")
            validated_args = CompoundWithdrawInput(**args)
            comet_address = self._get_comet_address(wallet.get_network())
            token_address = self._get_asset_address(wallet.get_network(), validated_args.asset_id)
            print(f"Comet address: {comet_address}")
            print(f"Token address: {token_address}")

            decimals = get_token_decimals(wallet, token_address)
            amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)
            print(f"Amount to withdraw: {validated_args.amount} (atomic: {amount_atomic})")

            # Check that there is enough balance supplied to withdraw amount
            collateral_balance = get_collateral_balance(wallet, comet_address, token_address)
            print(f"Current collateral balance: {collateral_balance}")
            if amount_atomic > collateral_balance:
                human_balance = format_amount_from_decimals(collateral_balance, decimals)
                print(f"Insufficient balance: {validated_args.amount} > {human_balance}")
                return f"Error: Insufficient balance. Trying to withdraw {validated_args.amount}, but only have {human_balance} supplied"

            # Check if position would be healthy after withdrawal
            projected_health_ratio = get_health_ratio_after_withdraw(
                wallet, comet_address, token_address, amount_atomic
            )
            print(f"Projected health ratio after withdrawal: {projected_health_ratio}")

            if projected_health_ratio < 1:
                print(f"Withdrawal would make position unhealthy: {projected_health_ratio}")
                return f"Error: Withdrawing {validated_args.amount} would result in an unhealthy position. Health ratio would be {projected_health_ratio:.2f}"

            # Withdraw from Compound
            print("Preparing withdrawal transaction...")
            print(f"Token address: {token_address}")
            print(f"Amount atomic: {amount_atomic}")
            print(f"Comet address: {comet_address}")
            contract = Web3().eth.contract(address=comet_address, abi=COMET_ABI)
            encoded_data = contract.encode_abi(
                "withdraw",
                args=[token_address, amount_atomic],
            )

            params = {
                "to": comet_address,
                "data": encoded_data,
            }
            print(f"Transaction params: {params}")

            try:
                print("Sending transaction...")
                tx_hash = wallet.send_transaction(params)
                print(f"Transaction sent with hash: {tx_hash}")
                receipt = wallet.wait_for_transaction_receipt(tx_hash)
                print(f"Transaction confirmed in block {receipt['blockNumber']}")
            except Exception as e:
                print(f"Transaction failed: {e!s}")
                return f"Error executing transaction: {e!s}"

            # Get current health ratio for reference
            current_health = get_health_ratio(wallet, comet_address)
            print(f"Current health ratio: {current_health}")

            # Get new health ratio
            new_health = get_health_ratio(wallet, comet_address)
            token_symbol = get_token_symbol(wallet, token_address)
            print(f"New health ratio: {new_health}")
            print(f"Withdrawal operation completed for {validated_args.amount} {token_symbol}")

            return (
                f"Withdrawn {validated_args.amount} {token_symbol} from Compound.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Health ratio changed from {current_health:.2f} to {new_health:.2f}"
            )
        except Exception as e:
            print(f"Withdrawal operation failed with error: {e!s}")
            return f"Error withdrawing from Compound: {e!s}"

    @create_action(
        name="borrow",
        description="""
This tool allows borrowing base assets from Compound.
It takes:
- asset_id: The asset to borrow, either `weth` or `usdc`
- amount: The amount of base tokens to borrow in human-readable format
    Examples:
    - 1000 USDC
    - 0.5 WETH
Important notes:
- Make sure to use the exact amount provided
- You must have sufficient collateral to borrow
""",
        schema=CompoundBorrowInput,
    )
    def borrow(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Borrow base assets from Compound."""
        try:
            validated_args = CompoundBorrowInput(**args)
            comet_address = self._get_comet_address(wallet.get_network())
            self._get_asset_address(wallet.get_network(), validated_args.asset_id)

            # USDC has 6 decimals
            amount_atomic = format_amount_with_decimals(validated_args.amount, 6)

            # Get current health ratio for reference
            # TODO: Make sure this returns float(inf) if health ratio is infinite
            current_health = get_health_ratio(wallet, comet_address)
            current_health_str = (
                "Inf.%" if current_health == float("inf") else f"{current_health:.2f}"
            )

            # Check if position would be healthy after borrow
            projected_health_ratio = get_health_ratio_after_borrow(
                wallet, comet_address, amount_atomic
            )

            if projected_health_ratio < 1:
                return f"Error: Borrowing {validated_args.amount} USDC would result in an unhealthy position. Health ratio would be {projected_health_ratio:.2f}"

            # Get the base token address
            base_token_address = wallet.read_contract(comet_address, COMET_ABI, "baseToken")

            # Use withdraw method to borrow from Compound
            contract = Web3().eth.contract(address=comet_address, abi=COMET_ABI)
            encoded_data = contract.encode_abi("withdraw", args=[base_token_address, amount_atomic])

            params = {
                "to": comet_address,
                "data": encoded_data,
            }

            try:
                tx_hash = wallet.send_transaction(params)
                wallet.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                return f"Error executing transaction: {e!s}"

            # Get new health ratio
            new_health = get_health_ratio(wallet, comet_address)
            new_health_str = "Inf.%" if new_health == float("inf") else f"{new_health:.2f}"

            print(f"Borrowed {validated_args.amount} USDC from Compound.")
            print(f"Transaction hash: {tx_hash}")
            print(f"Health ratio changed from {current_health_str} to {new_health_str}")

            return (
                f"Borrowed {validated_args.amount} USDC from Compound.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Health ratio changed from {current_health_str} to {new_health_str}"
            )
        except Exception as e:
            return f"Error borrowing from Compound: {e!s}"

    @create_action(
        name="repay",
        description="""
This tool allows repaying borrowed assets to Compound.
It takes:
- asset_id: The asset to repay, either `weth` or `usdc`
- amount: The amount of tokens to repay in human-readable format
    Examples:
    - 1000 USDC
    - 0.5 WETH
Important notes:
- Make sure to use the exact amount provided
- You must have sufficient balance of the asset you want to repay
""",
        schema=CompoundRepayInput,
    )
    def repay(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Repay borrowed assets to Compound."""
        try:
            validated_args = CompoundRepayInput(**args)
            comet_address = self._get_comet_address(wallet.get_network())
            token_address = self._get_asset_address(wallet.get_network(), validated_args.asset_id)
            print(f"Token address: {token_address}")
            print(f"Comet address: {comet_address}")
            print(f"Validated args: {validated_args}")

            # Check wallet balance before proceeding
            token_balance = get_token_balance(wallet, token_address)
            print(f"Token balance: {token_balance}")
            token_decimals = get_token_decimals(wallet, token_address)
            print(f"Token decimals: {token_decimals}")
            amount_atomic = format_amount_with_decimals(validated_args.amount, token_decimals)
            print(f"Amount atomic: {amount_atomic}")

            if token_balance < int(amount_atomic):
                human_balance = format_amount_from_decimals(token_balance, token_decimals)
                return f"Error: Insufficient balance. You have {human_balance}, but trying to repay {validated_args.amount}"

            # Get current health ratio for reference
            current_health = get_health_ratio(wallet, comet_address)
            print(f"Current health ratio: {current_health}")

            # Approve Compound to spend tokens
            token_contract = Web3().eth.contract(address=token_address, abi=ERC20_ABI)
            print(f"Token contract: {token_contract}")
            print(f"Token address: {token_address}")
            print(f"Comet address: {comet_address}")
            print(f"Amount atomic: {amount_atomic}")
            encoded_data = token_contract.encode_abi("approve", args=[comet_address, amount_atomic])
            params = {
                "to": token_address,
                "data": encoded_data,
            }
            try:
                tx_hash = wallet.send_transaction(params)
                wallet.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                return f"Error approving token: {e!s}"

            # Supply tokens to Compound (supplying base asset repays debt)
            contract = Web3().eth.contract(address=comet_address, abi=COMET_ABI)
            encoded_data = contract.encode_abi(
                "supply",
                args=[token_address, amount_atomic],
            )

            params = {
                "to": comet_address,
                "data": encoded_data,
            }
            try:
                tx_hash = wallet.send_transaction(params)
                wallet.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                return f"Error executing transaction: {e!s}"

            # Get new health ratio
            new_health = get_health_ratio(wallet, comet_address)
            token_symbol = get_token_symbol(wallet, token_address)

            return (
                f"Repaid {validated_args.amount} {token_symbol} to Compound.\n"
                f"Transaction hash: {tx_hash}\n"
                f"Health ratio improved from {current_health:.2f} to {new_health:.2f}"
            )
        except Exception as e:
            return f"Error repaying to Compound: {e!s}"

    @create_action(
        name="get_portfolio",
        description="""
This tool allows getting portfolio details from Compound.
It takes:
- comet_address: The address of the Compound Comet contract to get details from
- account: The address of the account to get details for

Returns portfolio details including:
- Collateral balances and USD values
- Borrowed amounts and USD values
Formatted in Markdown for readability.
""",
        schema=CompoundPortfolioInput,
    )
    def get_portfolio(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get portfolio details from Compound.

        Args:
            wallet: The wallet to use for getting details.
            args: The input arguments containing comet_address and account.

        Returns:
            str: A markdown formatted string with portfolio details.

        """
        try:
            comet_address = self._get_comet_address(wallet.get_network())
            return get_portfolio_details_markdown(wallet, comet_address)
        except Exception as e:
            return f"Error getting portfolio details: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Compound."""
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def compound_action_provider() -> CompoundActionProvider:
    """Create a new CompoundActionProvider instance."""
    return CompoundActionProvider()
