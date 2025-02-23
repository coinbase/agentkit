from pydantic import BaseModel

from .chain_definitions import (
    arbitrum,
    arbitrum_sepolia,
    base,
    base_sepolia,
    mainnet,
    optimism,
    optimism_sepolia,
    polygon,
    polygon_mumbai,
    sepolia,
)


class Network(BaseModel):
    """Represents a blockchain network."""

    protocol_family: str
    network_id: str | None = None
    chain_id: str | None = None


# Maps EVM chain IDs to Coinbase network IDs
CHAIN_ID_TO_NETWORK_ID: dict[str, str] = {
    "1": "ethereum-mainnet",
    "11155111": "ethereum-sepolia",
    "137": "polygon-mainnet",
    "80001": "polygon-mumbai",
    "8453": "base-mainnet",
    "84532": "base-sepolia",
    "42161": "arbitrum-mainnet",
    "421614": "arbitrum-sepolia",
    "10": "optimism-mainnet",
    "11155420": "optimism-sepolia",
}

# Maps Coinbase network IDs to EVM chain IDs
NETWORK_ID_TO_CHAIN_ID: dict[str, str] = {
    network_id: chain_id for chain_id, network_id in CHAIN_ID_TO_NETWORK_ID.items()
}

# Maps Coinbase network IDs to chain objects
NETWORK_ID_TO_CHAIN: dict[str, dict] = {
    "ethereum-mainnet": mainnet,
    "ethereum-sepolia": sepolia,
    "polygon-mainnet": polygon,
    "polygon-mumbai": polygon_mumbai,
    "base-mainnet": base,
    "base-sepolia": base_sepolia,
    "arbitrum-mainnet": arbitrum,
    "arbitrum-sepolia": arbitrum_sepolia,
    "optimism-mainnet": optimism,
    "optimism-sepolia": optimism_sepolia,
}
