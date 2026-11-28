"""Tests for the HelmSwap action provider."""

from unittest.mock import MagicMock, patch

import pytest

from coinbase_agentkit.action_providers.helmswap.helmswap_action_provider import (
    HelmswapActionProvider,
    helmswap_action_provider,
)
from coinbase_agentkit.action_providers.helmswap.schemas import (
    ExecuteSwapSchema,
    GetSwapQuoteSchema,
)
from coinbase_agentkit.network import Network

NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
WALLET = "0x000000000000000000000000000000000000a11c"
TICKET = {"quotedOutNet": "1657753", "expiresAt": 123}
QUOTE = {
    "ok": True,
    "quote": {"netOutAmount": "1657753", "minOutNet": "1649465", "fee": {"feeBps": 25}},
    "quoteTicket": TICKET,
    "priceImpact": {"priceImpactPct": 0.01, "buildable": True},
    "warnings": [],
}
BUILT_SWAP = {
    "ok": True,
    "tx": {
        "to": "0xB8da0dc565232632281738Bc0237409673D91487",
        "data": "0x80b5820f",
        "value": "1000000000000000",
    },
    "fee": {"feeBps": 25},
}
APPROVAL = {"to": USDC, "data": "0x095ea7b3", "value": "0"}


def _response(body, ok=True, status=200):
    resp = MagicMock()
    resp.ok = ok
    resp.status_code = status
    resp.json.return_value = body
    return resp


@pytest.fixture
def provider():
    """Create a provider."""
    return HelmswapActionProvider()


@pytest.fixture
def wallet():
    """Create a mock EVM wallet provider."""
    wp = MagicMock()
    wp.get_address.return_value = WALLET
    wp.get_network.return_value = Network(
        protocol_family="evm", network_id="base-mainnet", chain_id="8453"
    )
    wp.read_contract.return_value = 6
    wp.send_transaction.side_effect = ["0xapprove", "0xswap"]
    wp.wait_for_transaction_receipt.return_value = {"status": 1}
    return wp


def test_schema_accepts_valid_input_and_rejects_bad_input():
    """Test schema accepts valid input and rejects bad input."""
    ok = GetSwapQuoteSchema(sell_token=NATIVE, buy_token=USDC, sell_amount="0.001")
    assert ok.slippage_bps is None
    with pytest.raises(ValueError):
        GetSwapQuoteSchema(sell_token="ETH", buy_token=USDC, sell_amount="1")
    with pytest.raises(ValueError):
        GetSwapQuoteSchema(sell_token=NATIVE, buy_token=USDC, sell_amount="0")
    with pytest.raises(ValueError):
        ExecuteSwapSchema(sell_token=NATIVE, buy_token=USDC, sell_amount="1", slippage_bps=5000)


def test_factory_and_name():
    """Test factory and name."""
    assert helmswap_action_provider().name == "helmswap"
    assert helmswap_action_provider(base_url="https://example.test/").name == "helmswap"


def test_supports_network(provider):
    """Test supports network."""
    assert provider.supports_network(
        Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    )
    assert provider.supports_network(
        Network(protocol_family="evm", network_id="elysium", chain_id="99901")
    )
    assert not provider.supports_network(
        Network(protocol_family="evm", network_id="polygon", chain_id="137")
    )
    assert not provider.supports_network(
        Network(protocol_family="svm", network_id="solana-mainnet")
    )


def test_get_swap_quote_converts_units_and_reports_fee(provider, wallet):
    """Test get swap quote converts units and reports fee."""
    wallet.read_contract.side_effect = [6]
    with patch("requests.request", return_value=_response(QUOTE)) as req:
        out = provider.get_swap_quote(
            wallet, {"sell_token": NATIVE, "buy_token": USDC, "sell_amount": "0.001"}
        )
    params = req.call_args.kwargs["params"]
    assert params["chainId"] == "8453"
    assert params["amountIn"] == "1000000000000000"  # 0.001 ETH, native is 18 decimals
    assert params["slippageBps"] == "50"
    assert "1.657753" in out and "1.649465" in out
    assert "feeBps" in out and "Nothing was executed" in out


def test_get_swap_quote_reports_api_errors(provider, wallet):
    """Test get swap quote reports api errors."""
    wallet.read_contract.side_effect = [6]
    with patch(
        "requests.request",
        return_value=_response({"ok": False, "error": "bad pair"}, ok=False, status=400),
    ):
        out = provider.get_swap_quote(
            wallet, {"sell_token": NATIVE, "buy_token": USDC, "sell_amount": "1"}
        )
    assert out.startswith("Error fetching HelmSwap quote") and "bad pair" in out


def test_execute_swap_sends_native_swap_with_value(provider, wallet):
    """Test execute swap sends native swap with value."""
    wallet.read_contract.side_effect = [6]
    wallet.send_transaction.side_effect = ["0xswap"]
    with patch("requests.request", side_effect=[_response(QUOTE), _response(BUILT_SWAP)]) as req:
        out = provider.execute_swap(
            wallet, {"sell_token": NATIVE, "buy_token": USDC, "sell_amount": "0.001"}
        )
    body = req.call_args_list[1].kwargs["json"]
    assert req.call_args_list[1].args == ("POST", "https://helmswap.com/api/v1/build-tx")
    assert body["recipient"] == WALLET and body["quoteTicket"] == TICKET and body["chainId"] == 8453
    sent = wallet.send_transaction.call_args.args[0]
    assert sent["value"] == 1000000000000000 and sent["data"] == "0x80b5820f"
    assert "0xswap" in out and "Error" not in out


def test_execute_swap_sends_approval_before_swap(provider, wallet):
    """Test execute swap sends approval before swap."""
    wallet.read_contract.side_effect = [6, 18]
    built = {**BUILT_SWAP, "approvals": [APPROVAL]}
    with patch("requests.request", side_effect=[_response(QUOTE), _response(built)]):
        out = provider.execute_swap(
            wallet, {"sell_token": USDC, "buy_token": NATIVE, "sell_amount": "1"}
        )
    sent = [c.args[0]["data"] for c in wallet.send_transaction.call_args_list]
    assert sent == ["0x095ea7b3", "0x80b5820f"]
    assert "0xapprove" in out and "0xswap" in out


def test_execute_swap_refuses_when_price_impact_blocks_build(provider, wallet):
    """Test execute swap refuses when price impact blocks build."""
    wallet.read_contract.side_effect = [6]
    blocked = {**QUOTE, "priceImpact": {"priceImpactPct": 40, "buildable": False}}
    with patch("requests.request", return_value=_response(blocked)):
        out = provider.execute_swap(
            wallet, {"sell_token": NATIVE, "buy_token": USDC, "sell_amount": "1"}
        )
    assert "price impact is too high" in out
    wallet.send_transaction.assert_not_called()


def test_execute_swap_reports_reverted_receipt(provider, wallet):
    """Test execute swap reports reverted receipt."""
    wallet.read_contract.side_effect = [6]
    wallet.send_transaction.side_effect = ["0xswap"]
    wallet.wait_for_transaction_receipt.return_value = {"status": 0}
    with patch("requests.request", side_effect=[_response(QUOTE), _response(BUILT_SWAP)]):
        out = provider.execute_swap(
            wallet, {"sell_token": NATIVE, "buy_token": USDC, "sell_amount": "1"}
        )
    assert "failed" in out and "0xswap" in out


def test_execute_swap_reports_approvals_already_sent_on_error(provider, wallet):
    """Test execute swap reports approvals already sent on error."""
    wallet.read_contract.side_effect = [6, 18]
    built = {**BUILT_SWAP, "approvals": [APPROVAL]}
    wallet.send_transaction.side_effect = ["0xapprove", RuntimeError("rpc down")]
    with patch("requests.request", side_effect=[_response(QUOTE), _response(built)]):
        out = provider.execute_swap(
            wallet, {"sell_token": USDC, "buy_token": NATIVE, "sell_amount": "1"}
        )
    assert "rpc down" in out and "0xapprove" in out
