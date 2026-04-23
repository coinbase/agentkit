from decimal import Decimal
from unittest.mock import MagicMock, patch

from coinbase_agentkit.network import Network


def test_transfer_remote_success(hyperlane_wallet, hyperlane_provider, hyperlane_fixtures):
    """transfer_remote dispatches successfully when balance and quote are available."""
    input_args = {
        "warp_route_address": hyperlane_fixtures["warp_route_address"],
        "destination": "optimism",
        "recipient": hyperlane_fixtures["recipient"],
        "amount": "100",
        "token_address": hyperlane_fixtures["token_address"],
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.get_token_decimals"
        ) as mock_get_decimals,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.format_amount_with_decimals"
        ) as mock_format_atomic,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.get_token_balance"
        ) as mock_get_balance,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.approve_token"
        ) as mock_approve,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.get_token_symbol"
        ) as mock_get_symbol,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_get_decimals.return_value = 6
        atomic_amount = int(Decimal("100") * Decimal(10**6))
        mock_format_atomic.return_value = atomic_amount
        mock_get_balance.return_value = atomic_amount * 2
        mock_approve.return_value = "0xapprove_tx"
        mock_get_symbol.return_value = "USDC"

        mock_contract = MagicMock()
        mock_contract.encode_abi.return_value = "encoded_transfer_remote"
        mock_web3.return_value.eth.contract.return_value = mock_contract
        mock_web3.to_checksum_address.side_effect = lambda addr: addr

        hyperlane_wallet.read_contract.return_value = 12345  # interchain gas
        hyperlane_wallet.send_transaction.return_value = "0xtx"

        result = hyperlane_provider.transfer_remote(hyperlane_wallet, input_args)

        assert "Successfully dispatched 100 USDC" in result
        assert "optimism" in result
        assert "domain 10" in result
        assert "0xtx" in result
        assert "12345 wei" in result

        hyperlane_wallet.send_transaction.assert_called_once()
        call_args = hyperlane_wallet.send_transaction.call_args[0][0]
        assert call_args["value"] == 12345


def test_transfer_remote_unsupported_origin(
    hyperlane_wallet, hyperlane_provider, hyperlane_fixtures
):
    """Returns an error message when called from an unsupported origin chain."""
    hyperlane_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="polygon-mainnet",
        chain_id="137",
    )

    result = hyperlane_provider.transfer_remote(
        hyperlane_wallet,
        {
            "warp_route_address": hyperlane_fixtures["warp_route_address"],
            "destination": "ethereum",
            "recipient": hyperlane_fixtures["recipient"],
            "amount": "1",
            "token_address": hyperlane_fixtures["token_address"],
        },
    )

    assert "polygon-mainnet is not a supported" in result


def test_transfer_remote_unknown_destination(
    hyperlane_wallet, hyperlane_provider, hyperlane_fixtures
):
    """Returns an error when the destination chain name is not in the registry."""
    result = hyperlane_provider.transfer_remote(
        hyperlane_wallet,
        {
            "warp_route_address": hyperlane_fixtures["warp_route_address"],
            "destination": "nowhere",
            "recipient": hyperlane_fixtures["recipient"],
            "amount": "1",
            "token_address": hyperlane_fixtures["token_address"],
        },
    )

    assert "Unsupported destination" in result


def test_transfer_remote_insufficient_balance(
    hyperlane_wallet, hyperlane_provider, hyperlane_fixtures
):
    """Returns an error when wallet balance is below the requested amount."""
    with (
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.get_token_decimals"
        ) as mock_get_decimals,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.format_amount_with_decimals"
        ) as mock_format_atomic,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.get_token_balance"
        ) as mock_get_balance,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.format_amount_from_decimals"
        ) as mock_format_human,
        patch(
            "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_get_decimals.return_value = 6
        mock_format_atomic.return_value = 100_000_000
        mock_get_balance.return_value = 1_000_000  # less than 100 USDC
        mock_format_human.return_value = "1"
        mock_web3.to_checksum_address.side_effect = lambda addr: addr

        result = hyperlane_provider.transfer_remote(
            hyperlane_wallet,
            {
                "warp_route_address": hyperlane_fixtures["warp_route_address"],
                "destination": "optimism",
                "recipient": hyperlane_fixtures["recipient"],
                "amount": "100",
                "token_address": hyperlane_fixtures["token_address"],
            },
        )

        assert "Insufficient balance" in result
        hyperlane_wallet.send_transaction.assert_not_called()


def test_quote_transfer_remote_success(hyperlane_wallet, hyperlane_provider, hyperlane_fixtures):
    """quote_transfer_remote returns the wei amount from the Warp Route."""
    with patch(
        "coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider.Web3"
    ) as mock_web3:
        mock_web3.to_checksum_address.side_effect = lambda addr: addr
        hyperlane_wallet.read_contract.return_value = 99999

        result = hyperlane_provider.quote_transfer_remote(
            hyperlane_wallet,
            {
                "warp_route_address": hyperlane_fixtures["warp_route_address"],
                "destination": "ethereum",
            },
        )

        assert "99999 wei" in result
        assert "ethereum" in result
        assert "domain 1" in result
