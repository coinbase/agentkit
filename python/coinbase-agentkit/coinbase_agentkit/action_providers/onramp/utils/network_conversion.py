"""Network conversion utilities for the Onramp action provider."""



def convert_network_id_to_onramp_network_id(network_id: str) -> str | None:
    """Convert internal network IDs to Coinbase Onramp network IDs.

    Args:
        network_id: The internal network ID to convert

    Returns:
        The corresponding Onramp network ID, or None if not supported

    """
    network_mapping = {"base-mainnet": "base", "base-sepolia": "base-sepolia"}
    return network_mapping.get(network_id)
