"""Tests for Nano Wallet Provider transfers, receive and signing.

These tests verify the provider builds *valid* Nano ``state`` blocks (the shape
the network accepts) and signs them, without touching a real network: the RPC
helper is mocked, so no funds move.
"""

from decimal import Decimal

import pytest

from coinbase_agentkit.wallet_providers.nano_wallet_provider import NanoWalletProvider

from .conftest import (
    FAKE_RESULT_BALANCE_RAW,
    MOCK_ADDRESS,
    MOCK_TO,
    MOCK_TX_HASH,
)


def test_native_transfer_builds_valid_state_block(wallet_provider):
    """Test native_transfer builds a valid signed state send block."""
    amount = Decimal("1.5")
    amount_raw = int(amount * NanoWalletProvider.RAW_PER_XNO)
    wallet_provider._account_info.return_value = {
        "frontier": MOCK_TX_HASH,
        "representative": MOCK_ADDRESS,
        "balance": str(FAKE_RESULT_BALANCE_RAW),
    }
    wallet_provider._rpc.return_value = {"hash": MOCK_TX_HASH}

    result = wallet_provider.native_transfer(MOCK_TO, amount)
    assert result == MOCK_TX_HASH

    # The process call must be a real Nano state block with the required fields.
    call_args = wallet_provider._rpc.call_args
    assert call_args.args[0] == "process"
    assert call_args.kwargs.get("subtype") == "send"
    block = call_args.kwargs.get("block")
    assert block["type"] == "state"
    for field in ("account", "previous", "representative", "balance", "link", "signature"):
        assert field in block
    assert block["account"] == MOCK_ADDRESS
    assert block["previous"] == MOCK_TX_HASH
    # balance after debit == before - amount
    assert int(block["balance"]) == FAKE_RESULT_BALANCE_RAW - amount_raw
    # link is the destination public key (64 hex), not a bare address
    assert len(block["link"]) == 64
    # signature is 128 hex
    assert len(block["signature"]) == 128


def test_native_transfer_insufficient_balance(wallet_provider):
    """Test that a send exceeding the balance is rejected."""
    wallet_provider._account_info.return_value = {
        "frontier": MOCK_TX_HASH,
        "representative": MOCK_ADDRESS,
        "balance": "1000",  # tiny available balance (in raw)
    }
    with pytest.raises(RuntimeError, match="insufficient balance"):
        wallet_provider.native_transfer(MOCK_TO, 1.0)
    # No block should be submitted.
    wallet_provider._rpc.assert_not_called()


def test_requires_seed_to_transfer():
    """Test that a read-only provider (no seed) cannot send."""
    from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
        NanoWalletProviderConfig,
    )

    from .conftest import MOCK_RPC_URL

    provider = NanoWalletProvider(
        NanoWalletProviderConfig(address=MOCK_ADDRESS, rpc_url=MOCK_RPC_URL)
    )
    with pytest.raises(RuntimeError, match="read-only"):
        provider.native_transfer(MOCK_TO, 1.0)


def test_receivable_lists_pending(wallet_provider):
    """Test receivable() returns pending incoming blocks."""
    wallet_provider._rpc.return_value = {
        "blocks": {
            MOCK_TX_HASH: {"amount": "1000000000000000000000000000000", "source": "nano_1abc"}
        }
    }
    pending = wallet_provider.receivable()
    assert len(pending) == 1
    assert pending[0]["hash"] == MOCK_TX_HASH
    assert pending[0]["amount"] == 1000000000000000000000000000000
    assert pending[0]["source"] == "nano_1abc"
    wallet_provider._rpc.assert_called_once_with("receivable", account=MOCK_ADDRESS)


def test_receive_builds_valid_receive_block(wallet_provider):
    """Test receive() publishes a valid signed state receive block for an opened account."""
    wallet_provider._account_info.return_value = {
        "frontier": MOCK_TX_HASH,
        "representative": MOCK_ADDRESS,
        "balance": "1000",
    }
    # block_info returns the incoming amount
    wallet_provider._rpc.side_effect = [
        {"amount": "500"},  # the block_info call for the incoming send
        {"hash": "RCPTHASH"},  # the process call
    ]
    result = wallet_provider.receive(MOCK_TX_HASH)
    assert result == "RCPTHASH"

    calls = wallet_provider._rpc.call_args_list
    # First call: block_info for the send hash
    assert calls[0].args[0] == "block_info"
    assert calls[0].kwargs.get("hash") == MOCK_TX_HASH
    # Second call: process the receive block
    assert calls[1].args[0] == "process"
    assert calls[1].kwargs.get("subtype") == "receive"
    block = calls[1].kwargs.get("block")
    assert block["type"] == "state"
    assert block["previous"] == MOCK_TX_HASH
    # link is the send block hash (64 hex)
    assert block["link"] == MOCK_TX_HASH
    # balance after receive == before + incoming amount
    assert int(block["balance"]) == 1000 + 500
    assert len(block["signature"]) == 128


def test_receive_opened_state_error_falls_back_to_open(wallet_provider):
    """Test that receiving on an unopened account uses the open-block shape."""
    # _account_info raises (account unopened), block_info returns amount, process returns hash
    wallet_provider._account_info.side_effect = RuntimeError("account not found")
    wallet_provider._rpc.side_effect = [
        {"amount": "500"},
        {"hash": "OPENHASH"},
    ]
    result = wallet_provider.receive(MOCK_TX_HASH)
    assert result == "OPENHASH"
    process_call = wallet_provider._rpc.call_args_list[1]
    block = process_call.kwargs.get("block")
    assert block["type"] == "state"
    # open block: previous is the zero hash
    assert block["previous"] == "0000000000000000000000000000000000000000000000000000000000000000"


def test_sign_message_real_signature(wallet_provider):
    """Test sign_message produces a real 128-hex Ed25519 signature."""
    sig = wallet_provider.sign_message("test-payload")
    assert isinstance(sig, str)
    assert len(sig) == 128
    assert all(c in "0123456789ABCDEF" for c in sig)


def test_sign_message_read_only_raises():
    """Test that a read-only provider cannot sign messages."""
    from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
        NanoWalletProviderConfig,
    )

    from .conftest import MOCK_RPC_URL

    provider = NanoWalletProvider(
        NanoWalletProviderConfig(address=MOCK_ADDRESS, rpc_url=MOCK_RPC_URL)
    )
    with pytest.raises(RuntimeError, match="read-only"):
        provider.sign_message("x")
