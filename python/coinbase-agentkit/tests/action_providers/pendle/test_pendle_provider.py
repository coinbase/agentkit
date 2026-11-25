import pytest

from coinbase_agentkit.action_providers.pendle.constants import NETWORK_TO_CHAIN_ID
from coinbase_agentkit.action_providers.pendle.utils import get_chain_id_for_network
from coinbase_agentkit.network import Network


def test_supports_network(pendle_provider):
    """The provider supports Pendle V2 origin chains."""
    supported = [
        Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453"),
        Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1"),
        Network(protocol_family="evm", network_id="arbitrum-mainnet", chain_id="42161"),
    ]
    unsupported = [
        Network(protocol_family="evm", network_id="optimism-mainnet", chain_id="10"),
        Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532"),
        Network(protocol_family="svm", network_id="solana-mainnet", chain_id="101"),
    ]
    for network in supported:
        assert pendle_provider.supports_network(network)
    for network in unsupported:
        assert not pendle_provider.supports_network(network)


def test_get_chain_id_for_supported_network():
    """Translates supported AgentKit network IDs to Pendle's expected chain ID."""
    assert (
        get_chain_id_for_network(
            Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
        )
        == 8453
    )
    assert (
        get_chain_id_for_network(
            Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1")
        )
        == 1
    )


def test_get_chain_id_for_unsupported_network():
    """Raises ValueError on unsupported networks."""
    with pytest.raises(ValueError) as exc:
        get_chain_id_for_network(
            Network(protocol_family="evm", network_id="optimism-mainnet", chain_id="10")
        )
    assert "not supported by Pendle" in str(exc.value)


def test_network_to_chain_id_table():
    """Sanity check the static table matches canonical EVM chain IDs."""
    assert NETWORK_TO_CHAIN_ID["base-mainnet"] == 8453
    assert NETWORK_TO_CHAIN_ID["ethereum-mainnet"] == 1
    assert NETWORK_TO_CHAIN_ID["arbitrum-mainnet"] == 42161
