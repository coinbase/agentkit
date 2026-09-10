"""Tests for the OSF action provider."""

import base64
import json
from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.network import Network

MODULE = "coinbase_agentkit.action_providers.osf.osf_action_provider"


def _mock_response(status_code=200, json_body=None, payment=None, content_type="application/json"):
    """Build a fake requests-style response object."""
    response = Mock()
    response.status_code = status_code
    headers = {"content-type": content_type}
    if payment is not None:
        headers["payment-response"] = base64.b64encode(json.dumps(payment).encode()).decode()
    response.headers = headers
    response.json.return_value = json_body if json_body is not None else {}
    response.text = json.dumps(json_body) if json_body is not None else ""
    return response


@pytest.fixture
def mock_session():
    """Patch x402 client construction and the requests session.

    Yields the mocked session so a test can set ``mock_session.request.return_value``.
    No real network call or payment occurs.
    """
    with (
        patch(f"{MODULE}.x402ClientSync"),
        patch(f"{MODULE}.register_exact_evm_client"),
        patch(f"{MODULE}.EthAccountSigner"),
        patch(f"{MODULE}.max_amount"),
        patch(f"{MODULE}.x402_requests") as mock_x402_requests,
    ):
        session = Mock()
        session.request.return_value = _mock_response(json_body={})
        mock_x402_requests.return_value = session
        yield session


def test_provider_name(provider):
    """Provider name is 'osf'."""
    assert provider.name == "osf"


def test_supports_base_mainnet(provider):
    """OSF supports Base mainnet."""
    network = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    assert provider.supports_network(network) is True


def test_does_not_support_other_networks(provider):
    """OSF does not support non-Base networks."""
    network = Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1")
    assert provider.supports_network(network) is False


def test_action_names(provider, mock_wallet_provider):
    """The three actions are exposed with class-prefixed names."""
    names = {action.name for action in provider.get_actions(mock_wallet_provider)}
    assert "OsfActionProvider_lookup_entity" in names
    assert "OsfActionProvider_screen_entity" in names
    assert "OsfActionProvider_check_cve_exploited" in names


def test_lookup_entity_success(provider, mock_wallet_provider, mock_session):
    """A successful entity lookup returns data plus the payment proof."""
    body = {"service": "OSF Identity - Entity Lookup", "result": "FOUND"}
    payment = {"transaction": "0xabc", "network": "eip155:8453", "payer": "0x1"}
    mock_session.request.return_value = _mock_response(json_body=body, payment=payment)

    result = json.loads(provider.lookup_entity(mock_wallet_provider, {"query": "Apple Inc"}))

    assert result["success"] is True
    assert result["status_code"] == 200
    assert result["data"] == body
    assert result["payment"]["transaction"] == "0xabc"
    called_url = mock_session.request.call_args.kwargs["url"]
    assert called_url.endswith("/identity/entity/Apple%20Inc")


def test_screen_entity_builds_encoded_url(provider, mock_wallet_provider, mock_session):
    """Sanctions screening encodes the name into the screen route."""
    mock_session.request.return_value = _mock_response(json_body={"result": "NO_HIT"})
    provider.screen_entity(mock_wallet_provider, {"name": "Jane Doe"})
    called_url = mock_session.request.call_args.kwargs["url"]
    assert called_url.endswith("/screen/sanctions/Jane%20Doe")


def test_check_cve_builds_url(provider, mock_wallet_provider, mock_session):
    """CVE check builds the security route with the CVE id."""
    mock_session.request.return_value = _mock_response(json_body={"exploited": True})
    provider.check_cve_exploited(mock_wallet_provider, {"cve_id": "CVE-2021-44228"})
    called_url = mock_session.request.call_args.kwargs["url"]
    assert called_url.endswith("/security/cve/CVE-2021-44228")


def test_non_200_marks_unsuccessful(provider, mock_wallet_provider, mock_session):
    """A non-200 response is reported as unsuccessful with its status code."""
    mock_session.request.return_value = _mock_response(status_code=402, json_body={})
    result = json.loads(provider.lookup_entity(mock_wallet_provider, {"query": "X"}))
    assert result["success"] is False
    assert result["status_code"] == 402


def test_exception_is_handled(provider, mock_wallet_provider, mock_session):
    """An exception during the call is returned as an error JSON, not raised."""
    mock_session.request.side_effect = RuntimeError("boom")
    result = json.loads(provider.lookup_entity(mock_wallet_provider, {"query": "X"}))
    assert result["success"] is False
    assert "boom" in result["error"]
