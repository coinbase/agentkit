"""Wallet action provider for basic wallet operations."""

from decimal import Decimal
from typing import Any

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    GetBalanceSchema,
    GetWalletDetailsSchema,
    NativeTransferSchema,
    ReturnNativeBalanceSchema,
)

# Protocol-specific terminology for displaying balances and transactions
PROTOCOL_FAMILY_TO_TERMINOLOGY = {
    "evm": {
        "unit": "WEI",
        "display_unit": "ETH",
        "decimals": 18,
        "type": "Transaction hash",
        "verb": "transaction",
    },
    "svm": {
        "unit": "LAMPORTS",
        "display_unit": "SOL",
        "decimals": 9,
        "type": "Signature",
        "verb": "transfer",
    },
}

DEFAULT_TERMINOLOGY = {
    "unit": "",
    "display_unit": "",
    "decimals": 0,
    "type": "Hash",
    "verb": "transfer",
}

# Standard gas units consumed by a simple EVM native transfer (EIP constant).
_EVM_ETH_TRANSFER_GAS = 21000

# Effective gas budget used when estimating how much to deduct for fees.
# We apply a 2x multiplier over the 21000 gas constant to account for:
#   (a) the gas-limit multiplier that wallet providers typically apply (default 1.2x),
#       which determines the gas_limit field in the transaction and therefore how
#       much ETH must be reserved in the EVM pre-execution balance check; and
#   (b) minor fee fluctuations between estimation time and tx submission.
# With this buffer the transaction will succeed even when the provider uses up to a
# 2x gas-limit multiplier, and any unreserved gas is returned as negligible dust.
_EVM_GAS_BUDGET = _EVM_ETH_TRANSFER_GAS * 2  # 42000

# Conservative fallback gas price (100 gwei) used when no estimation method is available.
_FALLBACK_GAS_PRICE_WEI = 100 * 10**9

# Default priority fee (0.1 gwei) used when estimating fees from a web3 block.
_DEFAULT_PRIORITY_FEE_WEI = 100_000_000  # 0.1 gwei in wei

# Standard Solana transaction fee in lamports.
_SOL_TX_FEE_LAMPORTS = Decimal(5000)


def _estimate_evm_gas_cost_wei(wallet_provider: Any) -> Decimal:
    """Estimate the gas cost for a simple EVM native transfer, returned in wei.

    Attempts fee estimation using the following fallback chain:
    1. ``estimate_fees()`` method (e.g. EthAccountWalletProvider)
    2. ``web3`` or ``_web3`` attribute for on-chain fee data (e.g. CdpEvmWalletProvider)
    3. Conservative hardcoded fallback (100 gwei x gas budget)

    Args:
        wallet_provider: The wallet provider to use for estimation.

    Returns:
        Decimal: Estimated gas cost in wei.

    """
    # Approach 1: estimate_fees() provides (max_priority_fee_per_gas, max_fee_per_gas) in wei
    if hasattr(wallet_provider, "estimate_fees"):
        _, max_fee_per_gas = wallet_provider.estimate_fees()
        return Decimal(_EVM_GAS_BUDGET * max_fee_per_gas)

    # Approach 2: use a web3 instance (public 'web3' or private '_web3') to query fees
    web3 = getattr(wallet_provider, "web3", None) or getattr(wallet_provider, "_web3", None)
    if web3 is not None:
        try:
            latest_block = web3.eth.get_block("latest")
            base_fee = latest_block.get("baseFeePerGas")
            if base_fee is not None:
                max_fee_per_gas = base_fee + _DEFAULT_PRIORITY_FEE_WEI
                return Decimal(_EVM_GAS_BUDGET * max_fee_per_gas)
        except Exception:
            pass

    # Approach 3: conservative fallback
    return Decimal(_EVM_GAS_BUDGET * _FALLBACK_GAS_PRICE_WEI)


class WalletActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with wallet functionality."""

    def __init__(self):
        super().__init__("wallet", [])

    @create_action(
        name="get_wallet_details",
        description="""
    This tool will return the details of the connected wallet including:
    - Wallet address
    - Network information (protocol family, network ID, chain ID)
    - Native token balance (ETH for EVM networks, SOL for SVM networks)
    - Wallet provider name
    """,
        schema=GetWalletDetailsSchema,
    )
    def get_wallet_details(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Get details about the connected wallet.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get details from.
            args (dict[str, Any]): The input arguments.

        Returns:
            str: A formatted string containing wallet details and network information.

        """
        try:
            wallet_address = wallet_provider.get_address()
            network = wallet_provider.get_network()
            balance = wallet_provider.get_balance()
            provider_name = wallet_provider.get_name()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )

            # Format balance in whole units
            formatted_balance = str(Decimal(balance) / (10 ** terminology["decimals"]))

            return f"""Wallet Details:
- Provider: {provider_name}
- Address: {wallet_address}
- Network:
  * Protocol Family: {network.protocol_family}
  * Network ID: {network.network_id or "N/A"}
  * Chain ID: {network.chain_id if network.chain_id else "N/A"}
- Native Balance: {balance} {terminology["unit"]}
- Native Balance: {formatted_balance} {terminology["display_unit"]}"""
        except Exception as e:
            return f"Error getting wallet details: {e}"

    @create_action(
        name="get_balance",
        description="This tool will get the native currency balance of the connected wallet.",
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Get the native currency balance for the connected wallet.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get the balance from.
            args (dict[str, Any]): The input arguments.

        Returns:
            str: A message containing the wallet address and balance information.

        """
        try:
            balance = wallet_provider.get_balance()
            wallet_address = wallet_provider.get_address()

            return f"Native balance at address {wallet_address}: {balance}"
        except Exception as e:
            return f"Error getting balance: {e}"

    @create_action(
        name="native_transfer",
        description="""
This tool will transfer native tokens (ETH for EVM networks, SOL for SVM networks) from the wallet to another onchain address.

It takes the following inputs:
- to: The destination address to receive the funds
- value: The amount to transfer in whole units (e.g. '4.2' for 4.2 ETH, '0.1' for 0.1 SOL)

Important notes:
- Ensure sufficient balance of the input asset before transferring
- Ensure there is sufficient balance for the transfer itself AND the gas cost of this transfer
""",
        schema=NativeTransferSchema,
    )
    def native_transfer(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Transfer native tokens from the connected wallet to a destination address.

        Args:
            wallet_provider (WalletProvider): The wallet provider to transfer tokens from.
            args (dict[str, Any]): Arguments containing destination address and transfer amount.

        Returns:
            str: A message containing the transfer details and transaction hash.

        """
        try:
            validated_args = NativeTransferSchema(**args)
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )

            # Convert string to Decimal for wallet provider
            value_decimal = Decimal(validated_args.value)

            tx_hash = wallet_provider.native_transfer(validated_args.to, value_decimal)
            return f"Transferred {validated_args.value} {terminology['display_unit']} to {validated_args.to}\n{terminology['type']}: {tx_hash}"
        except Exception as e:
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )
            return f"Error during {terminology['verb']}: {e}"

    @create_action(
        name="return_native_balance",
        description="""
This tool will transfer the entire native token balance of the wallet to a destination address,
automatically deducting the estimated network/gas fees so the transaction succeeds.

It takes the following inputs:
- to: The destination address to receive the native tokens

Important notes:
- The exact amount transferred will be the wallet balance minus the estimated transaction fees
- A negligible dust amount may remain in the wallet after the transfer due to gas estimation buffers
- The transfer will fail if the wallet balance is too low to cover even the gas fees
""",
        schema=ReturnNativeBalanceSchema,
    )
    def return_native_balance(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Transfer balance minus gas fees to a destination address.

        Args:
            wallet_provider (WalletProvider): The wallet provider to transfer tokens from.
            args (dict[str, Any]): Arguments containing the destination address.

        Returns:
            str: A message containing the transfer details and transaction hash.

        """
        try:
            validated_args = ReturnNativeBalanceSchema(**args)
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )

            # get_balance() returns atomic units: wei for EVM, lamports for SVM
            balance = wallet_provider.get_balance()

            if network.protocol_family == "evm":
                # Estimate gas cost in wei and subtract from balance before converting to ETH.
                # native_transfer() expects whole-unit ETH, not wei.
                gas_cost_wei = _estimate_evm_gas_cost_wei(wallet_provider)
                transfer_wei = Decimal(balance) - gas_cost_wei
                if transfer_wei <= 0:
                    return "Error: Insufficient balance to cover gas fees"
                transfer_amount = transfer_wei / Decimal(10**18)
                formatted_amount = str(transfer_amount)
            elif network.protocol_family == "svm":
                # Subtract the standard 5000-lamport Solana transaction fee.
                # native_transfer() expects whole-unit SOL, not lamports.
                transfer_lamports = Decimal(balance) - _SOL_TX_FEE_LAMPORTS
                if transfer_lamports <= 0:
                    return "Error: Insufficient balance to cover transaction fee"
                transfer_amount = transfer_lamports / Decimal(10**9)
                formatted_amount = str(transfer_amount)
            else:
                # Unknown network: convert to whole units and transfer the full balance.
                decimals = terminology["decimals"]
                transfer_amount = (
                    Decimal(balance) / Decimal(10**decimals) if decimals > 0 else Decimal(balance)
                )
                formatted_amount = str(transfer_amount)

            tx_hash = wallet_provider.native_transfer(validated_args.to, transfer_amount)
            return f"Returned {formatted_amount} {terminology['display_unit']} to {validated_args.to}\n{terminology['type']}: {tx_hash}"
        except Exception as e:
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )
            return f"Error during {terminology['verb']}: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by wallet actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: True if the network is supported.

        """
        return True


def wallet_action_provider() -> WalletActionProvider:
    """Create a new WalletActionProvider instance.

    Returns:
        WalletActionProvider: A new wallet action provider instance.

    """
    return WalletActionProvider()
