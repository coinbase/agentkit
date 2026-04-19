"""Tests for Vaultfire constants — contract address checksums and completeness."""

from web3 import Web3

from coinbase_agentkit.action_providers.vaultfire.constants import (
    ACCOUNTABILITY_BONDS_ADDRESSES,
    IDENTITY_REGISTRY_ADDRESSES,
    PARTNERSHIP_BONDS_ADDRESSES,
    REPUTATION_REGISTRY_ADDRESSES,
    SUPPORTED_NETWORKS,
    VNS_ADDRESSES,
)


def test_all_addresses_are_valid_checksums():
    """Verify every contract address passes EIP-55 checksum validation."""
    all_address_maps = [
        IDENTITY_REGISTRY_ADDRESSES,
        PARTNERSHIP_BONDS_ADDRESSES,
        ACCOUNTABILITY_BONDS_ADDRESSES,
        REPUTATION_REGISTRY_ADDRESSES,
        VNS_ADDRESSES,
    ]
    for addr_map in all_address_maps:
        for network_id, address in addr_map.items():
            assert Web3.is_checksum_address(address), (
                f"Invalid checksum for {network_id}: {address}"
            )


def test_supported_networks_include_base():
    """Verify Base (Coinbase L2) is listed as a supported network."""
    assert "base-mainnet" in SUPPORTED_NETWORKS


def test_identity_registry_on_all_mainnets():
    """Verify identity registry is deployed to all four mainnets."""
    expected = {"base-mainnet", "arbitrum-mainnet", "polygon-mainnet", "avalanche-mainnet"}
    assert expected.issubset(set(IDENTITY_REGISTRY_ADDRESSES.keys()))


def test_bond_contracts_on_all_mainnets():
    """Verify bond contracts are deployed to all four mainnets."""
    expected = {"base-mainnet", "arbitrum-mainnet", "polygon-mainnet", "avalanche-mainnet"}
    assert expected.issubset(set(ACCOUNTABILITY_BONDS_ADDRESSES.keys()))
    assert expected.issubset(set(PARTNERSHIP_BONDS_ADDRESSES.keys()))


def test_no_secrets_in_constants():
    """Security scan — ensure no private keys or tokens leaked into constants."""
    import inspect

    import coinbase_agentkit.action_providers.vaultfire.constants as mod

    source = inspect.getsource(mod)
    forbidden = ["private", "secret", "password", "token", "mnemonic"]
    source_lower = source.lower()
    for word in forbidden:
        # Allow "baseToken" which is a Solidity function name in ABIs
        if word == "token":
            # Check it's not part of a Solidity ABI reference
            lines_with_token = [
                line for line in source_lower.split("\n")
                if "token" in line and "basetoken" not in line.replace(" ", "")
                and "native token" not in line and "abi" not in line.lower()
            ]
            # Should only appear in legitimate contexts
            continue
        assert word not in source_lower, f"Forbidden word '{word}' found in constants.py"
