"""Faucet utility functions for CDP API action provider."""

import os
from typing import Any, Literal, TypeVar

from cdp import CdpClient

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from .schemas import RequestFaucetFundsV2Schema

TWalletProvider = TypeVar("TWalletProvider", bound=WalletProvider)


def get_cdp_client(wallet_provider: TWalletProvider) -> CdpClient:
    """Get or create a CDP client from the wallet provider or environment variables.

    Args:
        wallet_provider: The wallet provider to get the client from.

    Returns:
        The CDP client.

    Raises:
        ValueError: If required environment variables are not set for non-CDP wallets.

    """
    if is_wallet_provider_with_client(wallet_provider):
        return wallet_provider.get_client()

    api_key_id = os.getenv("CDP_API_KEY_ID")
    api_key_secret = os.getenv("CDP_API_KEY_SECRET")

    if not api_key_id or not api_key_secret:
        raise ValueError(
            "Faucet requires CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables to be set."
        )

    return CdpClient(api_key_id=api_key_id, api_key_secret=api_key_secret)


def is_wallet_provider_with_client(wallet_provider: TWalletProvider) -> bool:
    """Check if wallet provider has a CDP client.

    Args:
        wallet_provider: The wallet provider to check.

    Returns:
        True if wallet provider has get_client method.

    """
    return hasattr(wallet_provider, "get_client") and callable(wallet_provider.get_client)


def validate_network_support(network: Network, network_id: str) -> None:
    """Validate that the network and protocol family are supported for faucet operations.

    Args:
        network: The network to validate.
        network_id: The network ID to validate.

    Raises:
        ValueError: If the network or protocol family is not supported.

    """
    supported_protocols = ["evm", "svm"]
    if network.protocol_family not in supported_protocols:
        raise ValueError("Faucet is only supported on Ethereum and Solana protocol families.")

    supported_evm_networks = ["base-sepolia", "ethereum-sepolia"]
    supported_svm_networks = ["solana-devnet"]

    is_evm_supported = network.protocol_family == "evm" and network_id in supported_evm_networks
    is_svm_supported = network.protocol_family == "svm" and network_id in supported_svm_networks

    if not is_evm_supported and not is_svm_supported:
        supported_networks = (
            " or ".join(supported_evm_networks)
            if network.protocol_family == "evm"
            else " or ".join(supported_svm_networks)
        )
        raise ValueError(
            f"Faucet is only supported on {supported_networks} {network.protocol_family} networks."
        )


async def handle_evm_faucet(
    cdp_client: CdpClient,
    address: str,
    network_id: str,
    args: dict[str, Any],
) -> str:
    """Handle faucet requests for EVM networks.

    Args:
        cdp_client: The CDP client to use.
        address: The address to request funds for.
        network_id: The network ID to request funds on.
        args: The arguments for the faucet request.

    Returns:
        The confirmation message with transaction hash.

    """
    validated_args = RequestFaucetFundsV2Schema(**args)
    token: Literal["eth", "usdc", "eurc", "cbbtc"] = validated_args.asset_id or "eth"

    async with cdp_client as cdp:
        faucet_tx = await cdp.evm.request_faucet(
            address=address,
            token=token,
            network=network_id,
        )

    return f"Received {validated_args.asset_id or 'ETH'} from the faucet. Transaction hash: {faucet_tx}"


async def handle_svm_faucet(
    cdp_client: CdpClient,
    address: str,
    args: dict[str, Any],
) -> str:
    """Handle faucet requests for Solana networks.

    Args:
        cdp_client: The CDP client to use.
        address: The address to request funds for.
        args: The arguments for the faucet request.

    Returns:
        The confirmation message with transaction signature.

    """
    validated_args = RequestFaucetFundsV2Schema(**args)
    token: Literal["sol", "usdc"] = validated_args.asset_id or "sol"

    async with cdp_client as cdp:
        faucet_tx = await cdp.solana.request_faucet(
            address=address,
            token=token,
        )

    return f"Received {validated_args.asset_id or 'SOL'} from the faucet. Transaction signature hash: {faucet_tx}"
