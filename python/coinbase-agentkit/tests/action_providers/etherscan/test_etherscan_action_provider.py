"""Tests for the Etherscan action provider."""

from unittest.mock import Mock, patch

import pytest
import requests

from coinbase_agentkit.action_providers.etherscan.etherscan_action_provider import (
    EtherscanActionProvider,
    etherscan_action_provider,
)
from coinbase_agentkit.action_providers.etherscan.schemas import (
    GetVerificationStatusSchema,
    VerifySmartContractSchema,
)
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_API_KEY,
    MOCK_API_URL,
    MOCK_CHAIN_ID,
    MOCK_COMPILER_VERSION,
    MOCK_CONTRACT_ADDRESS,
    MOCK_CONTRACT_NAME,
    MOCK_GUID,
    MOCK_NETWORK_ID,
    MOCK_SOURCE_CODE,
)

# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


def test_verify_schema_valid():
    """Test that VerifySmartContractSchema accepts valid minimum inputs."""
    schema = VerifySmartContractSchema(
        contract_address=MOCK_CONTRACT_ADDRESS,
        source_code=MOCK_SOURCE_CODE,
        contract_name=MOCK_CONTRACT_NAME,
        compiler_version=MOCK_COMPILER_VERSION,
    )
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS
    assert schema.source_code == MOCK_SOURCE_CODE
    assert schema.contract_name == MOCK_CONTRACT_NAME
    assert schema.compiler_version == MOCK_COMPILER_VERSION
    # Defaults
    assert schema.optimization_used is False
    assert schema.runs == 200
    assert schema.constructor_arguments == ""
    assert schema.evm_version == ""
    assert schema.license_type == 1
    assert schema.code_format == "solidity-single-file"


def test_verify_schema_invalid():
    """Test that VerifySmartContractSchema raises on missing required fields."""
    with pytest.raises(ValueError):
        VerifySmartContractSchema()


def test_verify_schema_invalid_license_type():
    """Test that VerifySmartContractSchema rejects license_type outside 1-14."""
    with pytest.raises(ValueError):
        VerifySmartContractSchema(
            contract_address=MOCK_CONTRACT_ADDRESS,
            source_code=MOCK_SOURCE_CODE,
            contract_name=MOCK_CONTRACT_NAME,
            compiler_version=MOCK_COMPILER_VERSION,
            license_type=15,
        )


def test_get_verification_status_schema_valid():
    """Test that GetVerificationStatusSchema accepts a GUID."""
    schema = GetVerificationStatusSchema(guid=MOCK_GUID)
    assert schema.guid == MOCK_GUID


def test_get_verification_status_schema_invalid():
    """Test that GetVerificationStatusSchema raises on missing guid."""
    with pytest.raises(ValueError):
        GetVerificationStatusSchema()


# ---------------------------------------------------------------------------
# Provider construction
# ---------------------------------------------------------------------------


def test_provider_init_with_api_key():
    """Test that EtherscanActionProvider initialises correctly when given an API key."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)
    assert provider.api_key == MOCK_API_KEY


def test_provider_init_from_env(monkeypatch):
    """Test that EtherscanActionProvider reads the API key from the environment."""
    monkeypatch.setenv("ETHERSCAN_API_KEY", MOCK_API_KEY)
    provider = EtherscanActionProvider()
    assert provider.api_key == MOCK_API_KEY


def test_provider_init_missing_api_key(monkeypatch):
    """Test that EtherscanActionProvider raises when no API key is available."""
    monkeypatch.delenv("ETHERSCAN_API_KEY", raising=False)
    with pytest.raises(ValueError, match="Etherscan API key is required"):
        EtherscanActionProvider()


def test_factory_function():
    """Test the etherscan_action_provider factory function."""
    provider = etherscan_action_provider(api_key=MOCK_API_KEY)
    assert isinstance(provider, EtherscanActionProvider)
    assert provider.api_key == MOCK_API_KEY


# ---------------------------------------------------------------------------
# supports_network
# ---------------------------------------------------------------------------


def test_supports_evm_network():
    """Test that EVM networks are supported."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)
    network = Network(protocol_family="evm", network_id=MOCK_NETWORK_ID, chain_id=MOCK_CHAIN_ID)
    assert provider.supports_network(network) is True


def test_does_not_support_non_evm_network():
    """Test that non-EVM networks are not supported."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)
    network = Network(protocol_family="svm", network_id="solana-mainnet")
    assert provider.supports_network(network) is False


# ---------------------------------------------------------------------------
# verify_smart_contract
# ---------------------------------------------------------------------------


def test_verify_smart_contract_success(mock_wallet):
    """Test a successful contract verification submission."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    mock_response = Mock()
    mock_response.json.return_value = {"status": "1", "result": MOCK_GUID}
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.post", return_value=mock_response) as mock_post:
        result = provider.verify_smart_contract(
            mock_wallet,
            {
                "contract_address": MOCK_CONTRACT_ADDRESS,
                "source_code": MOCK_SOURCE_CODE,
                "contract_name": MOCK_CONTRACT_NAME,
                "compiler_version": MOCK_COMPILER_VERSION,
            },
        )

    assert MOCK_GUID in result
    assert MOCK_CONTRACT_ADDRESS in result
    assert "successfully" in result.lower()

    # Verify the POST was sent to the correct URL with expected parameters
    call_kwargs = mock_post.call_args
    assert call_kwargs[0][0] == MOCK_API_URL
    payload = call_kwargs[1]["data"]
    assert payload["apikey"] == MOCK_API_KEY
    assert payload["module"] == "contract"
    assert payload["action"] == "verifysourcecode"
    assert payload["contractaddress"] == MOCK_CONTRACT_ADDRESS
    assert payload["compilerversion"] == MOCK_COMPILER_VERSION
    assert payload["optimizationUsed"] == 0


def test_verify_smart_contract_with_optimization(mock_wallet):
    """Test verification submission with optimization enabled."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    mock_response = Mock()
    mock_response.json.return_value = {"status": "1", "result": MOCK_GUID}
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.post", return_value=mock_response) as mock_post:
        provider.verify_smart_contract(
            mock_wallet,
            {
                "contract_address": MOCK_CONTRACT_ADDRESS,
                "source_code": MOCK_SOURCE_CODE,
                "contract_name": MOCK_CONTRACT_NAME,
                "compiler_version": MOCK_COMPILER_VERSION,
                "optimization_used": True,
                "runs": 1000,
                "evm_version": "london",
            },
        )

    payload = mock_post.call_args[1]["data"]
    assert payload["optimizationUsed"] == 1
    assert payload["runs"] == 1000
    assert payload["evmversion"] == "london"


def test_verify_smart_contract_etherscan_error(mock_wallet):
    """Test that Etherscan API errors are surfaced correctly."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    mock_response = Mock()
    mock_response.json.return_value = {
        "status": "0",
        "result": "Contract source code already verified",
    }
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.post", return_value=mock_response):
        result = provider.verify_smart_contract(
            mock_wallet,
            {
                "contract_address": MOCK_CONTRACT_ADDRESS,
                "source_code": MOCK_SOURCE_CODE,
                "contract_name": MOCK_CONTRACT_NAME,
                "compiler_version": MOCK_COMPILER_VERSION,
            },
        )

    assert "already verified" in result.lower()
    assert MOCK_CONTRACT_ADDRESS in result


def test_verify_smart_contract_request_exception(mock_wallet):
    """Test that network errors during verification are handled gracefully."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    with patch(
        "coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.post",
        side_effect=requests.RequestException("connection refused"),
    ):
        result = provider.verify_smart_contract(
            mock_wallet,
            {
                "contract_address": MOCK_CONTRACT_ADDRESS,
                "source_code": MOCK_SOURCE_CODE,
                "contract_name": MOCK_CONTRACT_NAME,
                "compiler_version": MOCK_COMPILER_VERSION,
            },
        )

    assert "Error" in result
    assert "connection refused" in result


def test_verify_smart_contract_unsupported_network():
    """Test verify_smart_contract with an unknown network ID."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    wallet = Mock()
    network = Network(protocol_family="evm", network_id="unknown-chain", chain_id="99999")
    wallet.get_network.return_value = network

    result = provider.verify_smart_contract(
        wallet,
        {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "source_code": MOCK_SOURCE_CODE,
            "contract_name": MOCK_CONTRACT_NAME,
            "compiler_version": MOCK_COMPILER_VERSION,
        },
    )

    assert "Error" in result


# ---------------------------------------------------------------------------
# get_verification_status
# ---------------------------------------------------------------------------


def test_get_verification_status_pending(mock_wallet):
    """Test that a pending verification status is reported correctly."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    mock_response = Mock()
    mock_response.json.return_value = {"status": "0", "result": "Pending in queue"}
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.get", return_value=mock_response) as mock_get:
        result = provider.get_verification_status(mock_wallet, {"guid": MOCK_GUID})

    assert MOCK_GUID in result
    assert "Pending in queue" in result

    call_kwargs = mock_get.call_args
    assert call_kwargs[0][0] == MOCK_API_URL
    params = call_kwargs[1]["params"]
    assert params["guid"] == MOCK_GUID
    assert params["apikey"] == MOCK_API_KEY
    assert params["module"] == "contract"
    assert params["action"] == "checkverifystatus"


def test_get_verification_status_verified(mock_wallet):
    """Test that a successful verification status is reported correctly."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    mock_response = Mock()
    mock_response.json.return_value = {"status": "1", "result": "Pass - Verified"}
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.get", return_value=mock_response):
        result = provider.get_verification_status(mock_wallet, {"guid": MOCK_GUID})

    assert "Pass - Verified" in result
    assert MOCK_GUID in result


def test_get_verification_status_request_exception(mock_wallet):
    """Test that network errors during status checks are handled gracefully."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    with patch(
        "coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.get",
        side_effect=requests.RequestException("timeout"),
    ):
        result = provider.get_verification_status(mock_wallet, {"guid": MOCK_GUID})

    assert "Error" in result
    assert "timeout" in result


def test_get_verification_status_via_chain_id(mock_wallet):
    """Test that the correct API URL is resolved when only chain_id is available."""
    provider = EtherscanActionProvider(api_key=MOCK_API_KEY)

    # Override the wallet to return a network without network_id but with chain_id
    chain_only_network = Network(protocol_family="evm", chain_id=MOCK_CHAIN_ID)
    mock_wallet.get_network.return_value = chain_only_network

    mock_response = Mock()
    mock_response.json.return_value = {"status": "1", "result": "Pass - Verified"}
    mock_response.raise_for_status.return_value = None

    with patch("coinbase_agentkit.action_providers.etherscan.etherscan_action_provider.requests.get", return_value=mock_response) as mock_get:
        provider.get_verification_status(mock_wallet, {"guid": MOCK_GUID})

    # Should still resolve to the Ethereum mainnet API URL via chain_id
    assert mock_get.call_args[0][0] == MOCK_API_URL
