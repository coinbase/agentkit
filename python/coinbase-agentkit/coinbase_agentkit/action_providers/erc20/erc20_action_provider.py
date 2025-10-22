"""ERC20 action provider."""

from decimal import Decimal
from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import ERC20_ABI, TOKEN_ADDRESSES_BY_SYMBOLS
from .schemas import (
    AllowanceSchema,
    ApproveSchema,
    GetBalanceSchema,
    GetTokenAddressSchema,
    TransferSchema,
)
from .utils import get_token_details


class ERC20ActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for ERC20 tokens."""

    def __init__(self) -> None:
        """Initialize the ERC20 action provider."""
        super().__init__("erc20", [])

    @create_action(
        name="get_balance",
        description="""
        This tool will get the balance of an ERC20 token for a given address.
        It takes the following inputs:
        - contract_address: The contract address of the token to get the balance for
        - address: (Optional) The address to check the balance for. If not provided, uses the wallet's address

        Important notes:
        - Never assume token or address, they have to be provided as inputs. If only token symbol is provided, use the get_erc20_token_address tool to get the token address first
        """,
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get the balance of an ERC20 token for a given address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = GetBalanceSchema(**args)
            address = (
                validated_args.address if validated_args.address else wallet_provider.get_address()
            )

            token_details = get_token_details(
                wallet_provider, validated_args.contract_address, validated_args.address
            )

            if not token_details:
                return f"Error: Could not fetch token details for {validated_args.contract_address}"

            return f"Balance of {token_details.name} ({validated_args.contract_address}) at address {address} is {token_details.formatted_balance}"
        except Exception as e:
            return f"Error getting balance: {e!s}"

    @create_action(
        name="transfer",
        description="""
        This tool will transfer an ERC20 token from the wallet to another onchain address.

        It takes the following inputs:
        - amount: The amount to transfer in whole units (e.g. 10.5 USDC)
        - contract_address: The contract address of the token to transfer
        - destination_address: The address to send the tokens to

        Important notes:
        - Never assume token or destination addresses, they have to be provided as inputs. If only token symbol is provided, use the get_erc20_token_address tool to get the token address first
        - Ensure sufficient balance of the input asset before transferring
        - When sending native assets (e.g. 'eth' on base-mainnet), ensure there is sufficient balance for the transfer itself AND the gas cost of this transfer
        """,
        schema=TransferSchema,
    )
    def transfer(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Transfer ERC20 tokens to a destination address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = TransferSchema(**args)

            w3 = Web3()
            checksum_contract = w3.to_checksum_address(validated_args.contract_address)
            checksum_destination = w3.to_checksum_address(validated_args.destination_address)

            # Get token details
            token_details = get_token_details(wallet_provider, validated_args.contract_address)
            if not token_details:
                return f"Error: Could not fetch token details for {validated_args.contract_address}. Please verify the token address is correct."

            # Convert amount from whole units to atomic units
            amount_in_atomic_units = int(
                Decimal(validated_args.amount) * (10**token_details.decimals)
            )

            # Check token balance
            if token_details.balance < amount_in_atomic_units:
                return f"Error: Insufficient {token_details.name} ({validated_args.contract_address}) token balance. Requested to send {validated_args.amount} of {token_details.name} ({validated_args.contract_address}), but only {token_details.formatted_balance} is available."

            # Guardrails to prevent loss of funds
            if (
                validated_args.contract_address.lower()
                == validated_args.destination_address.lower()
            ):
                return "Error: Transfer destination is the token contract address. Refusing transfer to prevent loss of funds."

            # Check if it's an ERC20 token contract
            # If destination address is a contract, check if its an ERC20 token
            # This assumes if the contract implements name, balance and decimals functions, it is an ERC20 token
            destination_token_details = get_token_details(
                wallet_provider, validated_args.destination_address
            )
            if destination_token_details:
                return "Error: Transfer destination is an ERC20 token contract. Refusing to transfer to prevent loss of funds."
            # If not an ERC20 token (could be a smart wallet or EOA), allow the transfer

            # Encode transfer function
            contract = w3.eth.contract(address=checksum_contract, abi=ERC20_ABI)
            data = contract.encode_abi("transfer", [checksum_destination, amount_in_atomic_units])

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": checksum_contract,
                    "data": data,
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return (
                f"Transferred {validated_args.amount} of {token_details.name} ({validated_args.contract_address}) "
                f"to {validated_args.destination_address}.\n"
                f"Transaction hash for the transfer: {tx_hash}"
            )
        except Exception as e:
            return f"Error transferring the asset: {e!s}"

    @create_action(
        name="approve",
        description="""
        This tool will approve a spender to transfer ERC20 tokens from the wallet.

        It takes the following inputs:
        - amount: The amount to approve in whole units (e.g. 100 for 100 USDC)
        - contract_address: The contract address of the token to approve
        - spender_address: The spender address to approve

        Important notes:
        - This will overwrite any existing allowance
        - To revoke an allowance, set the amount to 0
        - Ensure you trust the spender address before approving
        - Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_erc20_token_address tool to get the token address first
        """,
        schema=ApproveSchema,
    )
    def approve(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Approve a spender to transfer ERC20 tokens.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = ApproveSchema(**args)

            w3 = Web3()
            checksum_contract = w3.to_checksum_address(validated_args.contract_address)
            checksum_spender = w3.to_checksum_address(validated_args.spender_address)

            # Get token details for better error messages and validation
            token_details = get_token_details(wallet_provider, validated_args.contract_address)
            if not token_details:
                return f"Error: Could not fetch token details for {validated_args.contract_address}. Please verify the token address is correct."

            # Convert amount from whole units to atomic units
            amount_in_atomic_units = int(
                Decimal(validated_args.amount) * (10**token_details.decimals)
            )

            # Encode approve function
            contract = w3.eth.contract(address=checksum_contract, abi=ERC20_ABI)
            data = contract.encode_abi("approve", [checksum_spender, amount_in_atomic_units])

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": checksum_contract,
                    "data": data,
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return (
                f"Approved {validated_args.amount} {token_details.name} ({validated_args.contract_address}) "
                f"for spender {validated_args.spender_address}.\n"
                f"Transaction hash: {tx_hash}"
            )
        except Exception as e:
            return f"Error approving tokens: {e!s}"

    @create_action(
        name="get_allowance",
        description="""
        This tool will get the allowance amount for a spender of an ERC20 token.

        It takes the following inputs:
        - contract_address: The contract address of the token to check allowance for
        - spender_address: The address to check allowance for

        Important notes:
        - Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_erc20_token_address tool to get the token address first
        """,
        schema=AllowanceSchema,
    )
    def get_allowance(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get the allowance amount for a spender of an ERC20 token.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the allowance amount or error details.

        """
        try:
            validated_args = AllowanceSchema(**args)

            w3 = Web3()
            checksum_contract = w3.to_checksum_address(validated_args.contract_address)
            checksum_spender = w3.to_checksum_address(validated_args.spender_address)

            # Get token details for proper formatting
            token_details = get_token_details(wallet_provider, validated_args.contract_address)
            if not token_details:
                return f"Error: Could not fetch token details for {validated_args.contract_address}. Please verify the token address is correct."

            # Get owner address (wallet's address)
            owner_address = wallet_provider.get_address()
            checksum_owner = w3.to_checksum_address(owner_address)

            # Read allowance from contract
            allowance = wallet_provider.read_contract(
                contract_address=checksum_contract,
                abi=ERC20_ABI,
                function_name="allowance",
                args=[checksum_owner, checksum_spender],
            )

            # Format the allowance using token decimals
            formatted_allowance = str(allowance / (10**token_details.decimals))

            return f"Allowance for {validated_args.spender_address} to spend {token_details.name} ({validated_args.contract_address}) is {formatted_allowance} tokens"
        except Exception as e:
            return f"Error checking allowance: {e!s}"

    @create_action(
        name="get_erc20_token_address",
        description="""
        This tool will get the contract address for frequently used ERC20 tokens on different networks.
        It takes the following input:
        - symbol: The token symbol (e.g. USDC, EURC, CBBTC)
        """,
        schema=GetTokenAddressSchema,
    )
    def get_token_address(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get the contract address for a token symbol on the current network.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the token address or error details.

        """
        try:
            validated_args = GetTokenAddressSchema(**args)
            network = wallet_provider.get_network()
            network_tokens = TOKEN_ADDRESSES_BY_SYMBOLS.get(network.network_id or "", {})
            token_address = network_tokens.get(validated_args.symbol)

            if token_address:
                return f"Token address for {validated_args.symbol} on {network.network_id}: {token_address}"

            # Get available token symbols for the current network
            available_symbols = list(network_tokens.keys()) if network_tokens else []
            available_symbols_text = (
                f" Available token symbols on {network.network_id}: {', '.join(available_symbols)}"
                if available_symbols
                else f" No token symbols are configured for {network.network_id}"
            )

            return f'Error: Token symbol "{validated_args.symbol}" not found on {network.network_id}.{available_symbols_text}'
        except Exception as e:
            return f"Error getting token address: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm"


def erc20_action_provider() -> ERC20ActionProvider:
    """Create a new instance of the ERC20 action provider.

    Returns:
        A new ERC20 action provider instance.

    """
    return ERC20ActionProvider()
