from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    compound_action_provider,
)
from coinbase_agentkit.network import Network

MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_ADDRESS = "0x0987654321098765432109876543210987654321"
MOCK_RECEIVER = "0x5555555555555555555555555555555555555555"
MOCK_TX_HASH = "0xabcdef1234567890"


# Network Support Tests
def test_supports_network():
    """Test network support checking."""
    provider = compound_action_provider()

    # Test supported network
    supported_network = Network(protocol_family="evm", network_id="base-mainnet")
    assert provider.supports_network(supported_network) is True

    # Test unsupported network
    unsupported_network = Network(protocol_family="evm", network_id="ethereum-mainnet")
    assert provider.supports_network(unsupported_network) is False

    # Test unsupported protocol family
    wrong_family_network = Network(protocol_family="solana", network_id="base-mainnet")
    assert provider.supports_network(wrong_family_network) is False


def test_compound_invalid_network():
    """Test compound with invalid network."""
    provider = compound_action_provider()

    # Create a valid Network object but with unsupported values
    invalid_network = Network(protocol_family="invalid", network_id=None)
    assert provider.supports_network(invalid_network) is False
