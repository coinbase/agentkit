import json
from decimal import Decimal
from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import METAMORPHO_ABI
from .schemas import MorphoDepositInput, MorphoWithdrawInput

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
        schema=MorphoDepositInput,
    )
    def deposit(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Deposit assets into a Morpho Vault."""
        assets = Decimal(args["assets"])

        if assets <= Decimal("0.0"):
            return "Error: Assets amount must be greater than 0"

        try:
            # Convert ether amount to wei (atomic units)
            atomic_assets = str(Web3.to_wei(assets, "ether"))

            # Approve spending
            erc20_approve_abi = [
                {
                    "constant": False,
                    "inputs": [
                        {"name": "spender", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                    ],
                    "name": "approve",
                    "outputs": [{"name": "", "type": "bool"}],
                    "type": "function",
                }
            ]

            # Send approve transaction
            approve_tx = {
                "to": args["token_address"],
                "data": wallet.read_contract(
                    contract_address=Web3.to_checksum_address(args["token_address"]),
                    abi=erc20_approve_abi,
                    function_name="approve",
                    args=[args["vault_address"], atomic_assets],
                ),
            }

            approve_tx_hash = wallet.send_transaction(approve_tx)
            approve_receipt = wallet.wait_for_transaction_receipt(approve_tx_hash)

            if not approve_receipt.get("status"):
                return "Error approving Morpho Vault as spender: Transaction failed"

            # Build deposit transaction
            deposit_tx = {
                "to": args["vault_address"],
                "data": wallet.read_contract(
                    contract_address=Web3.to_checksum_address(args["vault_address"]),
                    abi=METAMORPHO_ABI,
                    function_name="deposit",
                    args=[atomic_assets, args["receiver"]],
                ),
            }

            # Send deposit transaction
            tx_hash = wallet.send_transaction(deposit_tx)
            receipt = wallet.wait_for_transaction_receipt(tx_hash)

            return f"Deposited {args['assets']} to Morpho Vault {args['vault_address']} with transaction hash: {tx_hash}\nTransaction receipt: {json.dumps(receipt)}"

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
        schema=MorphoWithdrawInput,
    )
    def withdraw(self, wallet: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Withdraw assets from a Morpho Vault."""
        if int(args["assets"]) <= 0:
            return "Error: Assets amount must be greater than 0"

        try:
            # Build withdraw transaction
            withdraw_tx = {
                "to": args["vault_address"],
                "data": wallet.read_contract(
                    contract_address=Web3.to_checksum_address(args["vault_address"]),
                    abi=METAMORPHO_ABI,
                    function_name="withdraw",
                    args=[int(args["assets"]), args["receiver"], args["receiver"]],
                ),
            }

            # Send withdraw transaction
            tx_hash = wallet.send_transaction(withdraw_tx)
            receipt = wallet.wait_for_transaction_receipt(tx_hash)

            return f"Withdrawn {args['assets']} from Morpho Vault {args['vault_address']} with transaction hash: {tx_hash}\nTransaction receipt: {json.dumps(receipt)}"

        except Exception as e:
            return f"Error withdrawing from Morpho Vault: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Morpho."""
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def morpho_action_provider() -> MorphoActionProvider:
    """Create a new MorphoActionProvider instance."""
    return MorphoActionProvider()
