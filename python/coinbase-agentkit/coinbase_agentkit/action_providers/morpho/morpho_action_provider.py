"""Morpho action provider."""

from decimal import Decimal
from typing import Any

from web3 import Web3

from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.action_providers.action_provider import ActionProvider
from coinbase_agentkit.action_providers.morpho.constants import METAMORPHO_ABI
from coinbase_agentkit.action_providers.morpho.schemas import (
    MorphoDepositSchema,
    MorphoWithdrawSchema,
)
from coinbase_agentkit.action_providers.morpho.utils import approve
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider

SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"]


class MorphoActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with Morpho Vaults."""

    def __init__(self):
        super().__init__("morpho", [])

    @create_action(
        name="deposit",
        description="""
This tool allows depositing assets into a Morpho Vault.
It takes:
- vault_address: The address of the Morpho Vault to deposit to
- assets: The amount of assets to deposit in whole units
    Examples for WETH:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH
- receiver: The address to receive the shares
- token_address: The address of the token to approve
Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- Please use a token address (example 0x4200000000000000000000000000000000000006) for the token_address field. If you are unsure of the token address, please clarify what the requested token address is before continuing.""",
        schema=MorphoDepositSchema,
    )
    def deposit(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Deposit assets into a Morpho Vault."""
        assets = Decimal(args["assets"])

        if assets <= Decimal("0.0"):
            return "Error: Assets amount must be greater than 0"

        try:
            atomic_assets = Web3.to_wei(assets, "ether")

            try:
                approve(wallet, args["token_address"], args["vault_address"], atomic_assets)
            except Exception as e:
                return f"Error approving Morpho Vault as spender: {e!s}"

            morpho_contract = Web3().eth.contract(address=args["vault_address"], abi=METAMORPHO_ABI)

            encoded_data = morpho_contract.encode_abi(
                "deposit", args=[atomic_assets, args["receiver"]]
            )

            params = {
                "to": args["vault_address"],
                "data": encoded_data,
            }

            tx_hash = wallet.send_transaction(params)
            wallet.wait_for_transaction_receipt(tx_hash)

            return f"Deposited {args['assets']} to Morpho Vault {args['vault_address']} with transaction hash: {tx_hash}"

        except Exception as e:
            return f"Error depositing to Morpho Vault: {e!s}"

    @create_action(
        name="withdraw",
        description="""
This tool allows withdrawing assets from a Morpho Vault. It takes:
- vault_address: The address of the Morpho Vault to withdraw from
- assets: The amount of assets to withdraw in atomic units
- receiver: The address to receive the shares
""",
        schema=MorphoWithdrawSchema,
    )
    def withdraw(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Withdraw assets from a Morpho Vault."""
        assets = Decimal(args["assets"])

        if assets <= Decimal("0.0"):
            return "Error: Assets amount must be greater than 0"

        atomic_assets = Web3.to_wei(assets, "ether")

        contract = Web3().eth.contract(address=args["vault_address"], abi=METAMORPHO_ABI)
        encoded_data = contract.encode_abi(
            "withdraw", args=[atomic_assets, args["receiver"], args["receiver"]]
        )

        try:
            params = {
                "to": args["vault_address"],
                "data": encoded_data,
            }

            tx_hash = wallet.send_transaction(params)
            wallet.wait_for_transaction_receipt(tx_hash)

            return f"Withdrawn {args['assets']} from Morpho Vault {args['vault_address']} with transaction hash: {tx_hash}"

        except Exception as e:
            return f"Error withdrawing from Morpho Vault: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Morpho."""
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def morpho_action_provider() -> MorphoActionProvider:
    """Create a new MorphoActionProvider instance."""
    return MorphoActionProvider()
