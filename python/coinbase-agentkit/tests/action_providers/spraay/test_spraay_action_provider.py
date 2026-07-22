"""Tests for the Spraay action provider."""

import base64
import json
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError
from web3 import Web3

from coinbase_agentkit.action_providers.spraay.constants import (
    SPRAAY_ABI,
    SPRAAY_BPA_VERSION,
    SPRAAY_CONTRACT_ADDRESS,
    SPRAAY_FREE_ESTIMATE_BATCH_PATH,
    SPRAAY_FREE_VALIDATE_BATCH_PATH,
    SPRAAY_GATEWAY_BASE_URL,
    SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
    SPRAAY_GATEWAY_ESCROW_CREATE_PATH,
    ZERO_ADDRESS,
)
from coinbase_agentkit.action_providers.spraay.schemas import (
    SpraayConfig,
    SpraayCreateEscrowInput,
    SpraayEstimateBatchInput,
    SpraayValidateBatchInput,
    SprayEthInput,
    SprayTokenInput,
)
from coinbase_agentkit.action_providers.spraay.spraay_action_provider import (
    spraay_action_provider,
)
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_RECIPIENT_A,
    MOCK_RECIPIENT_B,
    MOCK_TOKEN_ADDRESS,
    make_read_contract,
)

PROVIDER_MODULE = "coinbase_agentkit.action_providers.spraay.spraay_action_provider"


def make_response(status_code: int, data: dict | None = None, headers: dict | None = None):
    """Create a mock requests.Response."""
    response = Mock()
    response.status_code = status_code
    response.ok = 200 <= status_code < 300
    response.headers = {"content-type": "application/json", **(headers or {})}
    response.json.return_value = data
    response.text = json.dumps(data)
    return response


# =========================================================
# Schema tests
# =========================================================


def test_spray_eth_schema_valid():
    """Accept a valid ETH batch."""
    schema = SprayEthInput(
        recipients=[MOCK_RECIPIENT_A, MOCK_RECIPIENT_B], amount_per_recipient="0.01"
    )
    assert len(schema.recipients) == 2
    assert schema.preflight is False


def test_spray_eth_schema_rejects_empty_recipients():
    """Reject an empty recipient list."""
    with pytest.raises(ValidationError):
        SprayEthInput(recipients=[], amount_per_recipient="0.01")


def test_spray_eth_schema_rejects_over_200_recipients():
    """Reject more than 200 recipients."""
    recipients = [f"0x{i:040x}" for i in range(201)]
    with pytest.raises(ValidationError):
        SprayEthInput(recipients=recipients, amount_per_recipient="0.01")


def test_spray_eth_schema_rejects_malformed_addresses():
    """Reject malformed addresses."""
    with pytest.raises(ValidationError):
        SprayEthInput(recipients=["0xnotanaddress"], amount_per_recipient="0.01")


def test_spray_eth_schema_rejects_case_normalized_duplicates():
    """Reject duplicate recipients that differ only in case."""
    with pytest.raises(ValidationError):
        SprayEthInput(
            recipients=[MOCK_RECIPIENT_A, MOCK_RECIPIENT_A.lower()],
            amount_per_recipient="0.01",
        )


def test_spray_eth_schema_rejects_bad_amounts():
    """Reject non-positive and malformed amounts."""
    for bad in ["0", "-1", "abc"]:
        with pytest.raises(ValidationError):
            SprayEthInput(recipients=[MOCK_RECIPIENT_A], amount_per_recipient=bad)


def test_spray_token_schema_rejects_bad_token_address():
    """Reject a malformed token address."""
    with pytest.raises(ValidationError):
        SprayTokenInput(
            token_address="nope", recipients=[MOCK_RECIPIENT_A], amount_per_recipient="1"
        )


def test_validate_batch_schema_rejects_duplicates_and_defaults_chain():
    """Reject duplicate gateway batch recipients; default chain to base."""
    with pytest.raises(ValidationError):
        SpraayValidateBatchInput(
            token="USDC",
            recipients=[
                {"recipient": MOCK_RECIPIENT_A, "amount": "1.00"},
                {"recipient": MOCK_RECIPIENT_A.lower(), "amount": "2.00"},
            ],
        )

    schema = SpraayValidateBatchInput(
        token="USDC", recipients=[{"recipient": MOCK_RECIPIENT_A, "amount": "1.00"}]
    )
    assert schema.chain == "base"


def test_estimate_batch_schema_bounds():
    """Bound the estimate recipient count."""
    for bad in [0, 201]:
        with pytest.raises(ValidationError):
            SpraayEstimateBatchInput(recipients=bad, token="USDC")
    assert SpraayEstimateBatchInput(recipients=50, token="USDC").recipients == 50


def test_create_escrow_schema():
    """Validate escrow input."""
    schema = SpraayCreateEscrowInput(token="USDC", amount="250.00", beneficiary=MOCK_RECIPIENT_A)
    assert schema.chain == "base"
    with pytest.raises(ValidationError):
        SpraayCreateEscrowInput(token="USDC", amount="0", beneficiary=MOCK_RECIPIENT_A)
    with pytest.raises(ValidationError):
        SpraayCreateEscrowInput(token="USDC", amount="1", beneficiary="0xbad")


# =========================================================
# Network support
# =========================================================


def test_supports_network():
    """Support Base mainnet only."""
    provider = spraay_action_provider()
    assert provider.supports_network(Network(protocol_family="evm", network_id="base-mainnet"))
    assert not provider.supports_network(Network(protocol_family="evm", network_id="base-sepolia"))
    assert not provider.supports_network(
        Network(protocol_family="svm", network_id="solana-mainnet")
    )


# =========================================================
# Direct on-chain batch execution
# =========================================================


def test_spraay_eth_uses_spray_equal_with_zero_address(mock_wallet):
    """Spray ETH via sprayEqual with the zero address and fee-inclusive value."""
    provider = spraay_action_provider()
    result = provider.spraay_eth(
        mock_wallet,
        {"recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_B], "amount_per_recipient": "0.01"},
    )

    assert mock_wallet.send_transaction.call_count == 1
    tx = mock_wallet.send_transaction.call_args[0][0]
    assert tx["to"] == Web3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS)

    w3 = Web3()
    contract = w3.eth.contract(
        address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
    )
    expected_data = contract.encode_abi(
        "sprayEqual",
        [
            w3.to_checksum_address(ZERO_ADDRESS),
            [
                w3.to_checksum_address(MOCK_RECIPIENT_A),
                w3.to_checksum_address(MOCK_RECIPIENT_B),
            ],
            10**16,
        ],
    )
    assert tx["data"] == expected_data

    # 0.02 ETH subtotal + 0.3% fee
    subtotal = 2 * 10**16
    assert tx["value"] == subtotal + (subtotal * 30) // 10000

    assert "Successfully sprayed" in result
    assert "2 recipients" in result
    assert "basescan.org" in result


def test_spraay_eth_fee_fallback_on_read_error(mock_wallet):
    """Fall back to the default fee when the feeBps read fails."""
    mock_wallet.read_contract.side_effect = make_read_contract({"feeBps": RuntimeError("no rpc")})
    provider = spraay_action_provider()
    result = provider.spraay_eth(
        mock_wallet, {"recipients": [MOCK_RECIPIENT_A], "amount_per_recipient": "1"}
    )

    tx = mock_wallet.send_transaction.call_args[0][0]
    assert tx["value"] == 10**18 + (10**18 * 30) // 10000
    assert "Successfully sprayed" in result


def test_spraay_eth_error_result(mock_wallet):
    """Return an error message when the transaction fails."""
    mock_wallet.send_transaction.side_effect = RuntimeError("Insufficient funds")
    provider = spraay_action_provider()
    result = provider.spraay_eth(
        mock_wallet, {"recipients": [MOCK_RECIPIENT_A], "amount_per_recipient": "1"}
    )
    assert "Error spraying ETH" in result
    assert "Insufficient funds" in result


def test_spraay_eth_rejects_duplicates_via_schema(mock_wallet):
    """Reject duplicate recipients before signing."""
    provider = spraay_action_provider()
    result = provider.spraay_eth(
        mock_wallet,
        {
            "recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_A.lower()],
            "amount_per_recipient": "1",
        },
    )
    assert "Error" in result
    assert "Duplicate recipient" in result
    mock_wallet.send_transaction.assert_not_called()


def test_spraay_token_uses_permit_when_supported(mock_wallet):
    """Use an EIP-2612 permit when the token supports it."""
    provider = spraay_action_provider()
    result = provider.spraay_token(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_B],
            "amount_per_recipient": "100",
        },
    )

    # permit tx + spray tx
    assert mock_wallet.send_transaction.call_count == 2
    assert mock_wallet.sign_typed_data.call_count == 1
    typed_data = mock_wallet.sign_typed_data.call_args[0][0]
    assert typed_data["primaryType"] == "Permit"
    assert typed_data["domain"]["name"] == "USD Coin"
    assert typed_data["domain"]["version"] == "2"
    assert typed_data["domain"]["chainId"] == 8453
    assert typed_data["message"]["spender"] == SPRAAY_CONTRACT_ADDRESS
    assert "EIP-2612 permit" in result
    assert "Successfully sprayed" in result
    assert "USDC" in result


def test_spraay_token_falls_back_to_approve_for_non_permit_tokens(mock_wallet):
    """Fall back to approve when the token has no nonces()."""
    mock_wallet.read_contract.side_effect = make_read_contract(
        {"nonces": RuntimeError("execution reverted"), "symbol": "DAI", "decimals": 18}
    )
    provider = spraay_action_provider()
    result = provider.spraay_token(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A],
            "amount_per_recipient": "100",
        },
    )

    # approve tx + spray tx
    assert mock_wallet.send_transaction.call_count == 2
    mock_wallet.sign_typed_data.assert_not_called()
    assert "Token approval granted" in result
    assert "does not support EIP-2612 permit" in result
    assert "Successfully sprayed" in result


def test_spraay_token_falls_back_to_approve_when_permit_ineffective(mock_wallet):
    """Fall back to approve when the permit does not take effect on-chain."""
    # Allowance stays 0 even after the permit tx (e.g. an ERC-1271 smart-wallet
    # signature that permit's ecrecover does not accept).
    mock_wallet.read_contract.side_effect = make_read_contract({"allowance": 0})
    provider = spraay_action_provider()
    result = provider.spraay_token(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A],
            "amount_per_recipient": "100",
        },
    )

    # permit tx + approve tx + spray tx
    assert mock_wallet.send_transaction.call_count == 3
    assert "Token approval granted" in result
    assert "Successfully sprayed" in result


def test_spraay_token_falls_back_to_approve_when_signing_fails(mock_wallet):
    """Fall back to approve when typed-data signing fails."""
    mock_wallet.sign_typed_data.side_effect = RuntimeError("signing not supported")
    provider = spraay_action_provider()
    result = provider.spraay_token(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A],
            "amount_per_recipient": "100",
        },
    )

    assert mock_wallet.send_transaction.call_count == 2
    assert "Token approval granted" in result
    assert "Successfully sprayed" in result


def test_spraay_token_skips_allowance_when_sufficient(mock_wallet):
    """Skip allowance handling when the allowance is already sufficient."""
    mock_wallet.read_contract.side_effect = make_read_contract({"allowance": 10**18})
    provider = spraay_action_provider()
    result = provider.spraay_token(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A],
            "amount_per_recipient": "10",
        },
    )

    assert mock_wallet.send_transaction.call_count == 1
    mock_wallet.sign_typed_data.assert_not_called()
    assert "permit" not in result
    assert "approval" not in result


def test_spraay_eth_variable_uses_struct_encoding(mock_wallet):
    """Encode variable ETH sprays as (recipient, amount) structs."""
    provider = spraay_action_provider()
    result = provider.spraay_eth_variable(
        mock_wallet,
        {"recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_B], "amounts": ["0.01", "0.05"]},
    )

    assert mock_wallet.send_transaction.call_count == 1
    tx = mock_wallet.send_transaction.call_args[0][0]

    w3 = Web3()
    contract = w3.eth.contract(
        address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
    )
    expected_data = contract.encode_abi(
        "sprayETH",
        [
            [
                (w3.to_checksum_address(MOCK_RECIPIENT_A), 10**16),
                (w3.to_checksum_address(MOCK_RECIPIENT_B), 5 * 10**16),
            ]
        ],
    )
    assert tx["data"] == expected_data
    assert "Successfully sprayed variable ETH" in result


def test_spraay_eth_variable_rejects_mismatched_arrays(mock_wallet):
    """Reject mismatched recipients/amounts arrays."""
    provider = spraay_action_provider()
    result = provider.spraay_eth_variable(
        mock_wallet,
        {"recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_B], "amounts": ["0.01"]},
    )
    assert "Error: recipients length" in result
    mock_wallet.send_transaction.assert_not_called()


def test_spraay_token_variable_struct_encoding_with_permit(mock_wallet):
    """Spray variable token amounts with permit and struct encoding."""
    provider = spraay_action_provider()
    result = provider.spraay_token_variable(
        mock_wallet,
        {
            "token_address": MOCK_TOKEN_ADDRESS,
            "recipients": [MOCK_RECIPIENT_A, MOCK_RECIPIENT_B],
            "amounts": ["100", "200"],
        },
    )

    # permit tx + spray tx
    assert mock_wallet.send_transaction.call_count == 2
    spray_tx = mock_wallet.send_transaction.call_args_list[1][0][0]

    w3 = Web3()
    contract = w3.eth.contract(
        address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
    )
    expected_data = contract.encode_abi(
        "sprayToken",
        [
            w3.to_checksum_address(MOCK_TOKEN_ADDRESS),
            [
                (w3.to_checksum_address(MOCK_RECIPIENT_A), 100 * 10**6),
                (w3.to_checksum_address(MOCK_RECIPIENT_B), 200 * 10**6),
            ],
        ],
    )
    assert spray_tx["data"] == expected_data
    assert "Successfully sprayed variable USDC" in result


# =========================================================
# Pre-flight
# =========================================================


def test_preflight_gateway_unreachable_does_not_block(mock_wallet):
    """Proceed on-chain when the pre-flight gateway is unreachable."""
    provider = spraay_action_provider()
    with patch(f"{PROVIDER_MODULE}.requests.post", side_effect=ConnectionError("refused")):
        result = provider.spraay_eth(
            mock_wallet,
            {
                "recipients": [MOCK_RECIPIENT_A],
                "amount_per_recipient": "0.01",
                "preflight": True,
            },
        )

    assert mock_wallet.send_transaction.call_count == 1
    assert "Pre-flight validation skipped" in result
    assert "Successfully sprayed" in result


def test_preflight_invalid_verdict_blocks_signing(mock_wallet):
    """Abort before signing when the gateway reports the batch invalid."""
    provider = spraay_action_provider()
    with patch(
        f"{PROVIDER_MODULE}.requests.post",
        return_value=make_response(200, {"valid": False, "errors": ["bad recipient"]}),
    ):
        result = provider.spraay_eth(
            mock_wallet,
            {
                "recipients": [MOCK_RECIPIENT_A],
                "amount_per_recipient": "0.01",
                "preflight": True,
            },
        )

    mock_wallet.send_transaction.assert_not_called()
    assert "failed Spraay gateway pre-flight validation" in result
    assert "no transaction was signed" in result


# =========================================================
# Free gateway actions
# =========================================================


def test_validate_batch_posts_bpa_body(mock_wallet):
    """Post a BPA 1.0 body with a recipients key and return the verdict."""
    provider = spraay_action_provider()
    with patch(
        f"{PROVIDER_MODULE}.requests.post",
        return_value=make_response(
            200, {"valid": True, "errors": [], "warnings": [], "summary": {"total": "1.00"}}
        ),
    ) as mock_post:
        result = provider.spraay_validate_batch(
            mock_wallet,
            {
                "token": "USDC",
                "recipients": [{"recipient": MOCK_RECIPIENT_A, "amount": "1.00"}],
            },
        )

    call = mock_post.call_args
    assert call[0][0] == f"{SPRAAY_GATEWAY_BASE_URL}{SPRAAY_FREE_VALIDATE_BATCH_PATH}"
    body = call[1]["json"]
    assert body == {
        "bpa_version": SPRAAY_BPA_VERSION,
        "chain": "base",
        "token": "USDC",
        "recipients": [{"recipient": MOCK_RECIPIENT_A, "amount": "1.00"}],
    }
    assert "payments" not in body

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["validation"]["valid"] is True


def test_validate_batch_gateway_unreachable(mock_wallet):
    """Report gateway unreachability without throwing."""
    provider = spraay_action_provider()
    with patch(f"{PROVIDER_MODULE}.requests.post", side_effect=ConnectionError("ENOTFOUND")):
        result = provider.spraay_validate_batch(
            mock_wallet,
            {
                "token": "USDC",
                "recipients": [{"recipient": MOCK_RECIPIENT_A, "amount": "1.00"}],
            },
        )

    parsed = json.loads(result)
    assert parsed["error"] is True
    assert "on-chain batch actions remain available" in parsed["note"]


def test_estimate_batch_uses_query_params(mock_wallet):
    """Call the free estimate endpoint with query parameters."""
    provider = spraay_action_provider()
    with patch(
        f"{PROVIDER_MODULE}.requests.get",
        return_value=make_response(200, {"estimatedCostUsd": "0.42"}),
    ) as mock_get:
        result = provider.spraay_estimate_batch(
            mock_wallet, {"recipients": 150, "token": "USDC", "chain": "base"}
        )

    call = mock_get.call_args
    assert call[0][0] == f"{SPRAAY_GATEWAY_BASE_URL}{SPRAAY_FREE_ESTIMATE_BATCH_PATH}"
    assert call[1]["params"] == {"recipients": 150, "chain": "base", "token": "USDC"}

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["estimate"]["estimatedCostUsd"] == "0.42"


# =========================================================
# x402-metered gateway actions
# =========================================================

BATCH_ARGS = {
    "token": "USDC",
    "recipients": [{"recipient": MOCK_RECIPIENT_A, "amount": "1.00"}],
    "chain": "base",
}

CHALLENGE_402 = {"accepts": [{"network": "base", "asset": "0xusdc", "maxAmountRequired": "10000"}]}


def test_execute_batch_gateway_no_payment_needed(mock_wallet):
    """Return directly when no payment is required."""
    provider = spraay_action_provider()
    with patch(
        f"{PROVIDER_MODULE}.requests.post",
        return_value=make_response(200, {"executed": True, "batchId": "b-1"}),
    ) as mock_post:
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    assert mock_post.call_count == 1
    assert (
        mock_post.call_args[0][0] == f"{SPRAAY_GATEWAY_BASE_URL}{SPRAAY_GATEWAY_BATCH_EXECUTE_PATH}"
    )
    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["data"]["batchId"] == "b-1"


def test_execute_batch_gateway_respects_payment_limit(mock_wallet):
    """Refuse to pay quotes above the configured limit."""
    provider = spraay_action_provider()
    over_limit = {
        "accepts": [{"network": "base", "asset": "0xusdc", "maxAmountRequired": "2000000"}]
    }
    with (
        patch(f"{PROVIDER_MODULE}.requests.post", return_value=make_response(402, over_limit)),
        patch(f"{PROVIDER_MODULE}.x402_requests") as mock_x402,
    ):
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    mock_x402.assert_not_called()
    parsed = json.loads(result)
    assert parsed["error"] is True
    assert parsed["message"] == "Gateway payment exceeds limit"
    assert "No payment was made" in parsed["details"]


def test_execute_batch_gateway_settles_with_wallet(mock_wallet):
    """Settle the 402 challenge by signing with the wallet provider."""
    provider = spraay_action_provider()
    proof = {"transaction": "0xproof", "network": "base"}
    paid_response = make_response(
        200,
        {"executed": True, "batchId": "b-2"},
        headers={"payment-response": base64.b64encode(json.dumps(proof).encode()).decode()},
    )
    session = Mock()
    session.post.return_value = paid_response

    with (
        patch(f"{PROVIDER_MODULE}.requests.post", return_value=make_response(402, CHALLENGE_402)),
        patch(f"{PROVIDER_MODULE}.x402ClientSync"),
        patch(f"{PROVIDER_MODULE}.register_exact_evm_client"),
        patch(f"{PROVIDER_MODULE}.EthAccountSigner"),
        patch(f"{PROVIDER_MODULE}.x402_requests", return_value=session),
    ):
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    session.post.assert_called_once()
    parsed = json.loads(result)
    assert parsed["success"] is True
    assert "x402 payment" in parsed["message"]
    assert parsed["paymentProof"] == proof


def test_execute_batch_gateway_prefunded_header(mock_wallet):
    """Use a pre-funded payment header when configured."""
    provider = spraay_action_provider(SpraayConfig(x402_payment_header="prefunded-header"))
    with (
        patch(
            f"{PROVIDER_MODULE}.requests.post",
            side_effect=[
                make_response(402, CHALLENGE_402),
                make_response(200, {"executed": True}),
            ],
        ) as mock_post,
        patch(f"{PROVIDER_MODULE}.x402_requests") as mock_x402,
    ):
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    mock_x402.assert_not_called()
    assert mock_post.call_count == 2
    retry_headers = mock_post.call_args_list[1][1]["headers"]
    assert retry_headers["X-PAYMENT"] == "prefunded-header"
    parsed = json.loads(result)
    assert parsed["success"] is True


def test_execute_batch_gateway_unreachable(mock_wallet):
    """Report gateway errors without paying."""
    provider = spraay_action_provider()
    with patch(f"{PROVIDER_MODULE}.requests.post", side_effect=ConnectionError("socket hang up")):
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    parsed = json.loads(result)
    assert parsed["error"] is True
    assert "Error calling the Spraay gateway" in parsed["message"]


def test_execute_batch_gateway_unsettled_payment(mock_wallet):
    """Flag unsettled payments when the paid retry fails."""
    provider = spraay_action_provider()
    session = Mock()
    session.post.return_value = make_response(500, {"error": "internal"})

    with (
        patch(f"{PROVIDER_MODULE}.requests.post", return_value=make_response(402, CHALLENGE_402)),
        patch(f"{PROVIDER_MODULE}.x402ClientSync"),
        patch(f"{PROVIDER_MODULE}.register_exact_evm_client"),
        patch(f"{PROVIDER_MODULE}.EthAccountSigner"),
        patch(f"{PROVIDER_MODULE}.x402_requests", return_value=session),
    ):
        result = provider.spraay_execute_batch_gateway(mock_wallet, BATCH_ARGS)

    parsed = json.loads(result)
    assert parsed["error"] is True
    assert "Payment was not settled" in parsed["message"]


def test_create_escrow_happy_path(mock_wallet):
    """Create an escrow through the paid gateway endpoint."""
    provider = spraay_action_provider()
    session = Mock()
    session.post.return_value = make_response(200, {"escrowId": "e-1", "status": "created"})

    with (
        patch(
            f"{PROVIDER_MODULE}.requests.post", return_value=make_response(402, CHALLENGE_402)
        ) as mock_post,
        patch(f"{PROVIDER_MODULE}.x402ClientSync"),
        patch(f"{PROVIDER_MODULE}.register_exact_evm_client"),
        patch(f"{PROVIDER_MODULE}.EthAccountSigner"),
        patch(f"{PROVIDER_MODULE}.x402_requests", return_value=session),
    ):
        result = provider.spraay_create_escrow(
            mock_wallet,
            {
                "token": "USDC",
                "amount": "250.00",
                "beneficiary": MOCK_RECIPIENT_A,
                "deadline": "2026-08-01T00:00:00Z",
                "description": "Milestone 1",
            },
        )

    assert (
        mock_post.call_args[0][0] == f"{SPRAAY_GATEWAY_BASE_URL}{SPRAAY_GATEWAY_ESCROW_CREATE_PATH}"
    )
    body = mock_post.call_args[1]["json"]
    assert body["bpa_version"] == SPRAAY_BPA_VERSION
    assert body["amount"] == "250.00"
    assert body["beneficiary"] == MOCK_RECIPIENT_A
    assert body["deadline"] == "2026-08-01T00:00:00Z"
    assert body["description"] == "Milestone 1"

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["data"]["escrowId"] == "e-1"


def test_create_escrow_respects_payment_limit(mock_wallet):
    """Respect the payment limit for escrow creation."""
    provider = spraay_action_provider()
    over_limit = {
        "accepts": [{"network": "base", "asset": "0xusdc", "maxAmountRequired": "5000000"}]
    }
    with (
        patch(f"{PROVIDER_MODULE}.requests.post", return_value=make_response(402, over_limit)),
        patch(f"{PROVIDER_MODULE}.x402_requests") as mock_x402,
    ):
        result = provider.spraay_create_escrow(
            mock_wallet,
            {"token": "USDC", "amount": "250.00", "beneficiary": MOCK_RECIPIENT_A},
        )

    mock_x402.assert_not_called()
    parsed = json.loads(result)
    assert parsed["error"] is True
    assert parsed["message"] == "Gateway payment exceeds limit"
