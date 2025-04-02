"""Network conversion utilities for the Onramp action provider."""

import json
from urllib.parse import urlencode

from .constants import ONRAMP_BUY_URL, VERSION


def convert_network_id_to_onramp_network_id(network_id: str) -> str | None:
    """Convert internal network IDs to Coinbase Onramp network IDs.

    Args:
        network_id: The internal network ID to convert

    Returns:
        The corresponding Onramp network ID, or None if not supported

    """
    network_mapping = {
        "base-mainnet": "base",
        "ethereum-mainnet": "ethereum",
        "polygon-mainnet": "polygon",
        "optimism-mainnet": "optimism",
        "arbitrum-mainnet": "arbitrum",
    }
    return network_mapping.get(network_id)


def get_onramp_buy_url(project_id: str, address: str, network: str) -> str:
    """Build the Coinbase Onramp buy URL with the given parameters.

    Args:
        project_id: The Coinbase project ID
        address: The wallet address
        network: The network identifier

    Returns:
        The complete URL for purchasing cryptocurrency

    """
    # Build URL parameters
    params = {
        "appId": project_id,
        "addresses": json.dumps({address: [network]}),
        "defaultNetwork": network,
        "sdkVersion": f"onchainkit@{VERSION}",
    }

    # Remove None values and convert all values to strings
    cleaned_params = {k: str(v) for k, v in params.items() if v is not None}

    # Build and return URL
    query = urlencode(sorted(cleaned_params.items()))
    return f"{ONRAMP_BUY_URL}?{query}"
