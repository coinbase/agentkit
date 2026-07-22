"""Spraay Action Provider — payment coordination for AgentKit agents on Base.

Batch payments are the core capability: send ETH or any ERC-20 token to up to
200 recipients with per-recipient amounts, atomically, in a single transaction
against the deployed Spraay batch contract. Escrow creation via the Spraay
gateway is the complementary second pillar.

Contract: 0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC (Base Mainnet)
Gateway: https://gateway.spraay.app
Website: https://spraay.app
"""

import base64
import contextlib
import json
import os
import time
from typing import Any

import requests
from web3 import Web3
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from ..x402.utils import validate_payment_limit
from .constants import (
    ERC20_ABI,
    PERMIT_DEADLINE_SECONDS,
    SPRAAY_ABI,
    SPRAAY_BPA_VERSION,
    SPRAAY_CONTRACT_ADDRESS,
    SPRAAY_FREE_ESTIMATE_BATCH_PATH,
    SPRAAY_FREE_VALIDATE_BATCH_PATH,
    SPRAAY_GATEWAY_BASE_URL,
    SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH,
    SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
    SPRAAY_GATEWAY_ESCROW_CREATE_PATH,
    SPRAAY_PROTOCOL_FEE_BPS,
    ZERO_ADDRESS,
)
from .schemas import (
    SpraayConfig,
    SpraayCreateEscrowInput,
    SpraayEstimateBatchInput,
    SpraayExecuteBatchGatewayInput,
    SpraayValidateBatchInput,
    SprayEthInput,
    SprayEthVariableInput,
    SprayTokenInput,
    SprayTokenVariableInput,
)
from .utils import format_units, parse_units, split_signature


class SpraayActionProvider(ActionProvider[EvmWalletProvider]):
    """Spraay Action Provider — batch crypto payments and escrow on Base.

    Capabilities:
    - Direct on-chain batch execution (agent signs, agent pays gas): equal or
      variable amounts, ETH or ERC-20, up to 200 recipients atomically
    - EIP-2612 permit-optimized approvals with clean approve fallback
    - Free gateway pre-flight: validate a batch and estimate its cost before
      signing anything
    - x402-metered gateway execution and escrow creation (paid endpoints)
    """

    def __init__(self, config: SpraayConfig | None = None) -> None:
        """Initialize the Spraay action provider.

        Args:
            config: Optional configuration for gateway payment limits and endpoints.

        """
        super().__init__("spraay", [])

        if config is None:
            config = SpraayConfig()

        self._config = SpraayConfig(
            max_gateway_payment_usdc=(
                config.max_gateway_payment_usdc
                if config.max_gateway_payment_usdc != 1.0
                else float(os.getenv("SPRAAY_MAX_GATEWAY_PAYMENT_USDC", "1.0"))
            ),
            x402_payment_header=config.x402_payment_header,
            gateway_base_url=config.gateway_base_url,
        )

    def supports_network(self, network: Network) -> bool:
        """Check network support — the Spraay batch contract is deployed on Base mainnet.

        Args:
            network: The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id == "base-mainnet"

    # ── Batch payments: direct on-chain execution ──────────────────────────

    @create_action(
        name="spraay_eth",
        description=(
            "Send equal amounts of ETH to multiple recipients in a single atomic transaction "
            "via the Spraay batch contract on Base. Ideal for team payments, airdrops, or "
            "rewards. Up to 200 recipients per transaction; the protocol fee (default 0.3%) is "
            "added on top. This is the direct on-chain path: the agent signs the transaction "
            "and pays gas itself. For x402-metered gateway execution instead, use "
            "spraay_execute_batch_gateway. Set preflight=true to validate the batch against "
            "the free Spraay gateway endpoint before signing."
        ),
        schema=SprayEthInput,
    )
    def spraay_eth(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Spray equal amounts of ETH to multiple recipients in one transaction.

        Args:
            wallet_provider: The wallet provider to send the transaction.
            args: The input arguments (recipients, amount_per_recipient, preflight).

        Returns:
            str: A message describing the result of the transaction.

        """
        try:
            validated = SprayEthInput(**args)

            preflight_report = None
            if validated.preflight:
                proceed, preflight_report = self._run_preflight(
                    "ETH",
                    [
                        {"recipient": r, "amount": validated.amount_per_recipient}
                        for r in validated.recipients
                    ],
                )
                if not proceed:
                    return (
                        "Batch failed Spraay gateway pre-flight validation; no transaction "
                        f"was signed.\n{preflight_report}"
                    )

            amount_wei = parse_units(validated.amount_per_recipient, 18)
            subtotal = amount_wei * len(validated.recipients)
            fee_bps = self._get_fee_bps(wallet_provider)
            fee = (subtotal * fee_bps) // 10000
            total_value = subtotal + fee

            w3 = Web3()
            contract = w3.eth.contract(
                address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
            )
            data = contract.encode_abi(
                "sprayEqual",
                [
                    w3.to_checksum_address(ZERO_ADDRESS),
                    [w3.to_checksum_address(r) for r in validated.recipients],
                    amount_wei,
                ],
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS),
                    "data": data,
                    "value": total_value,
                }
            )
            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return self._format_spray_result(
                headline=(
                    f"Successfully sprayed {validated.amount_per_recipient} ETH to "
                    f"{len(validated.recipients)} recipients via Spraay."
                ),
                subtotal=subtotal,
                fee=fee,
                fee_bps=fee_bps,
                decimals=18,
                symbol="ETH",
                tx_hash=tx_hash,
                receipt=receipt,
                preflight_report=preflight_report,
            )
        except Exception as e:
            return f"Error spraying ETH via Spraay: {e}"

    @create_action(
        name="spraay_token",
        description=(
            "Send equal amounts of an ERC-20 token (like USDC) to multiple recipients in a "
            "single atomic transaction via the Spraay batch contract on Base. Up to 200 "
            "recipients per transaction; the protocol fee (default 0.3%) is added on top. "
            "Allowance handling is automatic: for tokens that support EIP-2612 permit (USDC on "
            "Base does), a signed permit grants an exact, deadline-bounded allowance instead "
            "of a standard approve; non-permit tokens fall back to approve. This is the direct "
            "on-chain path: the agent signs and pays gas itself. For x402-metered gateway "
            "execution instead, use spraay_execute_batch_gateway. Set preflight=true to "
            "validate the batch against the free Spraay gateway endpoint before signing."
        ),
        schema=SprayTokenInput,
    )
    def spraay_token(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Spray equal amounts of an ERC-20 token to multiple recipients.

        Args:
            wallet_provider: The wallet provider to send the transaction.
            args: The input arguments (token_address, recipients, amount_per_recipient, preflight).

        Returns:
            str: A message describing the result of the transaction.

        """
        try:
            validated = SprayTokenInput(**args)

            decimals = self._get_token_decimals(wallet_provider, validated.token_address)
            symbol = self._get_token_symbol(wallet_provider, validated.token_address)

            preflight_report = None
            if validated.preflight:
                proceed, preflight_report = self._run_preflight(
                    symbol,
                    [
                        {"recipient": r, "amount": validated.amount_per_recipient}
                        for r in validated.recipients
                    ],
                )
                if not proceed:
                    return (
                        "Batch failed Spraay gateway pre-flight validation; no transaction "
                        f"was signed.\n{preflight_report}"
                    )

            amount_wei = parse_units(validated.amount_per_recipient, decimals)
            subtotal = amount_wei * len(validated.recipients)
            fee_bps = self._get_fee_bps(wallet_provider)
            fee = (subtotal * fee_bps) // 10000
            total_amount = subtotal + fee

            allowance_msg = self._ensure_token_allowance(
                wallet_provider, validated.token_address, total_amount
            )

            w3 = Web3()
            contract = w3.eth.contract(
                address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
            )
            data = contract.encode_abi(
                "sprayEqual",
                [
                    w3.to_checksum_address(validated.token_address),
                    [w3.to_checksum_address(r) for r in validated.recipients],
                    amount_wei,
                ],
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS),
                    "data": data,
                }
            )
            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return self._format_spray_result(
                headline=(
                    f"Successfully sprayed {validated.amount_per_recipient} {symbol} to "
                    f"{len(validated.recipients)} recipients via Spraay."
                ),
                allowance_msg=allowance_msg,
                subtotal=subtotal,
                fee=fee,
                fee_bps=fee_bps,
                decimals=decimals,
                symbol=symbol,
                tx_hash=tx_hash,
                receipt=receipt,
                preflight_report=preflight_report,
            )
        except Exception as e:
            return f"Error spraying tokens via Spraay: {e}"

    @create_action(
        name="spraay_eth_variable",
        description=(
            "Send different amounts of ETH to multiple recipients in a single atomic "
            "transaction via the Spraay batch contract on Base. Each recipient gets its own "
            "specified amount — ideal for bounty payouts or tiered distributions. Up to 200 "
            "recipients per transaction; the protocol fee (default 0.3%) is added on top. "
            "This is the direct on-chain path: the agent signs and pays gas itself. For "
            "x402-metered gateway execution instead, use spraay_execute_batch_gateway. Set "
            "preflight=true to validate the batch against the free Spraay gateway endpoint "
            "before signing."
        ),
        schema=SprayEthVariableInput,
    )
    def spraay_eth_variable(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Spray variable amounts of ETH to multiple recipients.

        Args:
            wallet_provider: The wallet provider to send the transaction.
            args: The input arguments (recipients, amounts, preflight).

        Returns:
            str: A message describing the result of the transaction.

        """
        try:
            validated = SprayEthVariableInput(**args)

            if len(validated.recipients) != len(validated.amounts):
                return (
                    f"Error: recipients length ({len(validated.recipients)}) must match "
                    f"amounts length ({len(validated.amounts)})."
                )

            preflight_report = None
            if validated.preflight:
                proceed, preflight_report = self._run_preflight(
                    "ETH",
                    [
                        {"recipient": r, "amount": a}
                        for r, a in zip(validated.recipients, validated.amounts, strict=True)
                    ],
                )
                if not proceed:
                    return (
                        "Batch failed Spraay gateway pre-flight validation; no transaction "
                        f"was signed.\n{preflight_report}"
                    )

            amounts = [parse_units(a, 18) for a in validated.amounts]
            subtotal = sum(amounts)
            fee_bps = self._get_fee_bps(wallet_provider)
            fee = (subtotal * fee_bps) // 10000
            total_value = subtotal + fee

            w3 = Web3()
            contract = w3.eth.contract(
                address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
            )
            data = contract.encode_abi(
                "sprayETH",
                [
                    [
                        (w3.to_checksum_address(r), amount)
                        for r, amount in zip(validated.recipients, amounts, strict=True)
                    ]
                ],
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS),
                    "data": data,
                    "value": total_value,
                }
            )
            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return self._format_spray_result(
                headline=(
                    f"Successfully sprayed variable ETH amounts to "
                    f"{len(validated.recipients)} recipients via Spraay."
                ),
                subtotal=subtotal,
                fee=fee,
                fee_bps=fee_bps,
                decimals=18,
                symbol="ETH",
                tx_hash=tx_hash,
                receipt=receipt,
                preflight_report=preflight_report,
            )
        except Exception as e:
            return f"Error spraying variable ETH via Spraay: {e}"

    @create_action(
        name="spraay_token_variable",
        description=(
            "Send different amounts of an ERC-20 token to multiple recipients in a single "
            "atomic transaction via the Spraay batch contract on Base. Each recipient gets its "
            "own specified amount. Up to 200 recipients per transaction; the protocol fee "
            "(default 0.3%) is added on top. Allowance handling is automatic: EIP-2612 permit "
            "for tokens that support it (USDC on Base does), approve fallback otherwise. This "
            "is the direct on-chain path: the agent signs and pays gas itself. For x402-metered "
            "gateway execution instead, use spraay_execute_batch_gateway. Set preflight=true "
            "to validate the batch against the free Spraay gateway endpoint before signing."
        ),
        schema=SprayTokenVariableInput,
    )
    def spraay_token_variable(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Spray variable amounts of an ERC-20 token to multiple recipients.

        Args:
            wallet_provider: The wallet provider to send the transaction.
            args: The input arguments (token_address, recipients, amounts, preflight).

        Returns:
            str: A message describing the result of the transaction.

        """
        try:
            validated = SprayTokenVariableInput(**args)

            if len(validated.recipients) != len(validated.amounts):
                return (
                    f"Error: recipients length ({len(validated.recipients)}) must match "
                    f"amounts length ({len(validated.amounts)})."
                )

            decimals = self._get_token_decimals(wallet_provider, validated.token_address)
            symbol = self._get_token_symbol(wallet_provider, validated.token_address)

            preflight_report = None
            if validated.preflight:
                proceed, preflight_report = self._run_preflight(
                    symbol,
                    [
                        {"recipient": r, "amount": a}
                        for r, a in zip(validated.recipients, validated.amounts, strict=True)
                    ],
                )
                if not proceed:
                    return (
                        "Batch failed Spraay gateway pre-flight validation; no transaction "
                        f"was signed.\n{preflight_report}"
                    )

            amounts = [parse_units(a, decimals) for a in validated.amounts]
            subtotal = sum(amounts)
            fee_bps = self._get_fee_bps(wallet_provider)
            fee = (subtotal * fee_bps) // 10000
            total_amount = subtotal + fee

            allowance_msg = self._ensure_token_allowance(
                wallet_provider, validated.token_address, total_amount
            )

            w3 = Web3()
            contract = w3.eth.contract(
                address=w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), abi=SPRAAY_ABI
            )
            data = contract.encode_abi(
                "sprayToken",
                [
                    w3.to_checksum_address(validated.token_address),
                    [
                        (w3.to_checksum_address(r), amount)
                        for r, amount in zip(validated.recipients, amounts, strict=True)
                    ],
                ],
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS),
                    "data": data,
                }
            )
            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return self._format_spray_result(
                headline=(
                    f"Successfully sprayed variable {symbol} amounts to "
                    f"{len(validated.recipients)} recipients via Spraay."
                ),
                allowance_msg=allowance_msg,
                subtotal=subtotal,
                fee=fee,
                fee_bps=fee_bps,
                decimals=decimals,
                symbol=symbol,
                tx_hash=tx_hash,
                receipt=receipt,
                preflight_report=preflight_report,
            )
        except Exception as e:
            return f"Error spraying variable tokens via Spraay: {e}"

    # ── Gateway pre-flight actions (free, no payment) ──────────────────────

    @create_action(
        name="spraay_validate_batch",
        description=(
            "Validate a batch payment against the free Spraay gateway pre-flight endpoint "
            f"(POST {SPRAAY_GATEWAY_BASE_URL}{SPRAAY_FREE_VALIDATE_BATCH_PATH}). No payment "
            "and no transaction signing required. Checks recipients and amounts and returns "
            "valid/errors/warnings/summary. Use this before the on-chain spray actions or "
            "spraay_execute_batch_gateway to catch malformed batches before signing anything."
        ),
        schema=SpraayValidateBatchInput,
    )
    def spraay_validate_batch(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Validate a batch via the free Spraay gateway pre-flight endpoint.

        Args:
            wallet_provider: The wallet provider (unused; validation is off-chain and free).
            args: The batch to validate (token, recipients, chain).

        Returns:
            str: JSON string with the gateway validation result.

        """
        try:
            validated = SpraayValidateBatchInput(**args)
            response = requests.post(
                f"{self._config.gateway_base_url}{SPRAAY_FREE_VALIDATE_BATCH_PATH}",
                json=self._build_bpa_body(
                    validated.chain,
                    validated.token,
                    [entry.model_dump() for entry in validated.recipients],
                ),
                timeout=30,
            )
            data = self._parse_response_data(response)

            if not response.ok:
                return json.dumps(
                    {
                        "error": True,
                        "message": (
                            "Spraay gateway validation request failed with status "
                            f"{response.status_code}"
                        ),
                        "data": data,
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "success": True,
                    "endpoint": SPRAAY_FREE_VALIDATE_BATCH_PATH,
                    "validation": data,
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to reach the Spraay gateway for batch validation",
                    "details": str(e),
                    "note": (
                        "Validation is an optional pre-flight step; the direct on-chain "
                        "batch actions remain available."
                    ),
                },
                indent=2,
            )

    @create_action(
        name="spraay_estimate_batch",
        description=(
            "Estimate the cost of a batch payment via the free Spraay gateway endpoint "
            f"(GET {SPRAAY_GATEWAY_BASE_URL}{SPRAAY_FREE_ESTIMATE_BATCH_PATH}"
            "?recipients=<count>&chain=<chain>&token=<token>). No payment and no transaction "
            "signing required. Use this to preview gas and fee costs for a batch of a given "
            "size before executing on-chain or via the gateway."
        ),
        schema=SpraayEstimateBatchInput,
    )
    def spraay_estimate_batch(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Estimate batch execution cost via the free Spraay gateway endpoint.

        Args:
            wallet_provider: The wallet provider (unused; estimation is off-chain and free).
            args: The estimate parameters (recipients count, token, chain).

        Returns:
            str: JSON string with the gateway cost estimate.

        """
        try:
            validated = SpraayEstimateBatchInput(**args)
            response = requests.get(
                f"{self._config.gateway_base_url}{SPRAAY_FREE_ESTIMATE_BATCH_PATH}",
                params={
                    "recipients": validated.recipients,
                    "chain": validated.chain,
                    "token": validated.token,
                },
                timeout=30,
            )
            data = self._parse_response_data(response)

            if not response.ok:
                return json.dumps(
                    {
                        "error": True,
                        "message": (
                            "Spraay gateway estimate request failed with status "
                            f"{response.status_code}"
                        ),
                        "data": data,
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "success": True,
                    "endpoint": SPRAAY_FREE_ESTIMATE_BATCH_PATH,
                    "estimate": data,
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to reach the Spraay gateway for batch estimation",
                    "details": str(e),
                    "note": (
                        "Estimation is an optional pre-flight step; the direct on-chain "
                        "batch actions remain available."
                    ),
                },
                indent=2,
            )

    # ── Gateway execution and escrow (x402-metered, paid) ──────────────────

    @create_action(
        name="spraay_execute_batch_gateway",
        description=(
            "Execute a batch payment through the x402-metered Spraay gateway "
            f"(POST {SPRAAY_GATEWAY_BASE_URL}{SPRAAY_GATEWAY_BATCH_EXECUTE_PATH}). This is a "
            "PAID endpoint: pricing is returned via an x402 402 Payment Required challenge and "
            "settled in USDC before execution. A live quote is available the same way from "
            f"POST {SPRAAY_GATEWAY_BASE_URL}{SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH}. Tradeoff vs "
            "the direct on-chain actions: direct on-chain means the agent signs the batch "
            "transaction and pays gas itself on Base; gateway execution is x402-metered and "
            "multi-chain capable — the gateway handles submission and the agent pays a metered "
            "USDC fee instead of managing gas. Payments respect the provider's "
            "max_gateway_payment_usdc limit. Use spraay_validate_batch (free) first to catch "
            "malformed batches."
        ),
        schema=SpraayExecuteBatchGatewayInput,
    )
    def spraay_execute_batch_gateway(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Execute a batch payment through the x402-metered Spraay gateway.

        Args:
            wallet_provider: The wallet provider used to sign the x402 payment.
            args: The batch to execute (token, recipients, chain).

        Returns:
            str: JSON string with the gateway execution result and payment details.

        """
        try:
            validated = SpraayExecuteBatchGatewayInput(**args)
        except Exception as e:
            return json.dumps(
                {"error": True, "message": "Invalid batch input", "details": str(e)}, indent=2
            )

        return self._request_with_x402(
            wallet_provider,
            SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
            self._build_bpa_body(
                validated.chain,
                validated.token,
                [entry.model_dump() for entry in validated.recipients],
            ),
        )

    @create_action(
        name="spraay_create_escrow",
        description=(
            "Create an escrow through the x402-metered Spraay gateway "
            f"(POST {SPRAAY_GATEWAY_BASE_URL}{SPRAAY_GATEWAY_ESCROW_CREATE_PATH}). This is a "
            "PAID endpoint: pricing is returned via an x402 402 Payment Required challenge and "
            "settled in USDC. Escrow complements Spraay batch payments: lock funds for a "
            "beneficiary with optional deadline and terms, then release or refund later. This "
            "action covers creation only — see the Spraay gateway documentation "
            f"({SPRAAY_GATEWAY_BASE_URL}) for release and refund flows. Payments respect the "
            "provider's max_gateway_payment_usdc limit."
        ),
        schema=SpraayCreateEscrowInput,
    )
    def spraay_create_escrow(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Create an escrow through the x402-metered Spraay gateway.

        Args:
            wallet_provider: The wallet provider used to sign the x402 payment.
            args: The escrow parameters (token, amount, beneficiary, chain, deadline, description).

        Returns:
            str: JSON string with the gateway escrow creation result and payment details.

        """
        try:
            validated = SpraayCreateEscrowInput(**args)
        except Exception as e:
            return json.dumps(
                {"error": True, "message": "Invalid escrow input", "details": str(e)}, indent=2
            )

        body: dict[str, Any] = {
            "bpa_version": SPRAAY_BPA_VERSION,
            "chain": validated.chain,
            "token": validated.token,
            "amount": validated.amount,
            "beneficiary": validated.beneficiary,
        }
        if validated.deadline:
            body["deadline"] = validated.deadline
        if validated.description:
            body["description"] = validated.description

        return self._request_with_x402(wallet_provider, SPRAAY_GATEWAY_ESCROW_CREATE_PATH, body)

    # ── Private helpers ────────────────────────────────────────────────────

    def _build_bpa_body(
        self, chain: str, token: str, recipients: list[dict[str, str]]
    ) -> dict[str, Any]:
        """Build a Batch Payment Aggregate (BPA 1.0) request body.

        Note the array key is "recipients" (not "payments").

        Args:
            chain: Target chain identifier.
            token: Token symbol.
            recipients: Batch entries as (recipient, amount) dicts.

        Returns:
            dict[str, Any]: The BPA request body.

        """
        return {
            "bpa_version": SPRAAY_BPA_VERSION,
            "chain": chain,
            "token": token,
            "recipients": [
                {"recipient": entry["recipient"], "amount": entry["amount"]} for entry in recipients
            ],
        }

    def _run_preflight(self, token: str, entries: list[dict[str, str]]) -> tuple[bool, str]:
        """Run the free gateway pre-flight validation for an on-chain batch.

        Gateway unavailability never blocks the on-chain path; an explicit
        "valid: false" verdict does.

        Args:
            token: Token symbol for the batch.
            entries: Batch entries as (recipient, amount) dicts.

        Returns:
            tuple[bool, str]: Whether to proceed, plus a report for the action result.

        """
        try:
            response = requests.post(
                f"{self._config.gateway_base_url}{SPRAAY_FREE_VALIDATE_BATCH_PATH}",
                json=self._build_bpa_body("base", token, entries),
                timeout=30,
            )
            if not response.ok:
                return True, (
                    "Pre-flight validation skipped: gateway responded with status "
                    f"{response.status_code}."
                )

            data = self._parse_response_data(response)
            report = f"Pre-flight validation: {json.dumps(data)}"

            if isinstance(data, dict) and data.get("valid") is False:
                return False, report

            return True, report
        except Exception as e:
            return True, f"Pre-flight validation skipped: gateway unreachable ({e})."

    def _format_spray_result(
        self,
        headline: str,
        subtotal: int,
        fee: int,
        fee_bps: int,
        decimals: int,
        symbol: str,
        tx_hash: str,
        receipt: dict[str, Any],
        allowance_msg: str | None = None,
        preflight_report: str | None = None,
    ) -> str:
        """Format a successful spray result into the shared multi-line shape.

        Args:
            headline: First line describing the outcome.
            subtotal: Total amount sent, excluding fee, in atomic units.
            fee: Protocol fee amount in atomic units.
            fee_bps: Protocol fee in basis points.
            decimals: Token decimals for formatting.
            symbol: Token symbol for formatting.
            tx_hash: The spray transaction hash.
            receipt: The transaction receipt.
            allowance_msg: Optional allowance message (permit/approve).
            preflight_report: Optional pre-flight report to surface.

        Returns:
            str: The formatted result string.

        """
        lines: list[str] = []
        if preflight_report:
            lines.append(preflight_report)
        if allowance_msg:
            lines.append(allowance_msg)
        lines.extend(
            [
                headline,
                f"Total sent: {format_units(subtotal, decimals)} {symbol}",
                f"Protocol fee ({fee_bps / 100}%): {format_units(fee, decimals)} {symbol}",
                f"Transaction hash: {tx_hash}",
                f"Block: {receipt.get('blockNumber', 'pending')}",
                f"View on BaseScan: https://basescan.org/tx/{tx_hash}",
            ]
        )
        return "\n".join(lines)

    def _get_fee_bps(self, wallet_provider: EvmWalletProvider) -> int:
        """Read the live protocol fee from the contract, with a constant fallback.

        Args:
            wallet_provider: The wallet provider to read with.

        Returns:
            int: The protocol fee in basis points.

        """
        try:
            return int(
                wallet_provider.read_contract(SPRAAY_CONTRACT_ADDRESS, SPRAAY_ABI, "feeBps", [])
            )
        except Exception:
            return SPRAAY_PROTOCOL_FEE_BPS

    def _ensure_token_allowance(
        self, wallet_provider: EvmWalletProvider, token_address: str, required: int
    ) -> str | None:
        """Ensure the Spraay contract has a sufficient token allowance.

        Prefers an EIP-2612 permit (exact value, deadline-bounded) when the
        token supports it, falling back to a standard approve otherwise.

        Args:
            wallet_provider: The wallet provider to sign and send with.
            token_address: The ERC-20 token contract address.
            required: The allowance required, in atomic units.

        Returns:
            str | None: A message describing what was done, or None if nothing was needed.

        """
        wallet_address = wallet_provider.get_address()
        current_allowance = int(
            wallet_provider.read_contract(
                token_address, ERC20_ABI, "allowance", [wallet_address, SPRAAY_CONTRACT_ADDRESS]
            )
        )
        if current_allowance >= required:
            return None

        permit_msg = self._try_permit(wallet_provider, token_address, required)
        if permit_msg:
            return permit_msg

        w3 = Web3()
        contract = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=ERC20_ABI)
        data = contract.encode_abi(
            "approve", [w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS), required]
        )
        tx_hash = wallet_provider.send_transaction(
            {"to": w3.to_checksum_address(token_address), "data": data}
        )
        wallet_provider.wait_for_transaction_receipt(tx_hash)
        return (
            "Token approval granted to Spraay contract (token does not support EIP-2612 "
            f"permit). Approval tx: {tx_hash}"
        )

    def _try_permit(
        self, wallet_provider: EvmWalletProvider, token_address: str, required: int
    ) -> str | None:
        """Attempt to grant the allowance via an EIP-2612 permit.

        Support is detected at runtime (nonces/name reads) rather than from a
        hardcoded token list. Returns None when the token does not support
        permit or any step fails, so the caller can fall back to approve.

        Args:
            wallet_provider: The wallet provider to sign and send with.
            token_address: The ERC-20 token contract address.
            required: The allowance value to permit, in atomic units.

        Returns:
            str | None: A message describing the permit, or None to signal fallback.

        """
        try:
            owner = wallet_provider.get_address()

            # Detect permit support: EIP-2612 tokens expose nonces(owner).
            nonce = int(wallet_provider.read_contract(token_address, ERC20_ABI, "nonces", [owner]))
            name = str(wallet_provider.read_contract(token_address, ERC20_ABI, "name", []))

            # EIP-2612 domain version: USDC on Base reports "2"; default to "1".
            try:
                version = str(
                    wallet_provider.read_contract(token_address, ERC20_ABI, "version", [])
                )
            except Exception:
                version = "1"

            network = wallet_provider.get_network()
            chain_id = int(network.chain_id or 8453)
            deadline = int(time.time()) + PERMIT_DEADLINE_SECONDS

            typed_data = {
                "types": {
                    "EIP712Domain": [
                        {"name": "name", "type": "string"},
                        {"name": "version", "type": "string"},
                        {"name": "chainId", "type": "uint256"},
                        {"name": "verifyingContract", "type": "address"},
                    ],
                    "Permit": [
                        {"name": "owner", "type": "address"},
                        {"name": "spender", "type": "address"},
                        {"name": "value", "type": "uint256"},
                        {"name": "nonce", "type": "uint256"},
                        {"name": "deadline", "type": "uint256"},
                    ],
                },
                "primaryType": "Permit",
                "domain": {
                    "name": name,
                    "version": version,
                    "chainId": chain_id,
                    "verifyingContract": token_address,
                },
                "message": {
                    "owner": owner,
                    "spender": SPRAAY_CONTRACT_ADDRESS,
                    "value": required,
                    "nonce": nonce,
                    "deadline": deadline,
                },
            }

            signature = wallet_provider.sign_typed_data(typed_data)
            r, s, v = split_signature(signature)

            w3 = Web3()
            contract = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=ERC20_ABI)
            data = contract.encode_abi(
                "permit",
                [
                    w3.to_checksum_address(owner),
                    w3.to_checksum_address(SPRAAY_CONTRACT_ADDRESS),
                    required,
                    deadline,
                    v,
                    bytes.fromhex(r[2:]),
                    bytes.fromhex(s[2:]),
                ],
            )
            tx_hash = wallet_provider.send_transaction(
                {"to": w3.to_checksum_address(token_address), "data": data}
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            # Verify the permit took effect (e.g. smart-wallet ERC-1271 signatures
            # do not pass permit's ecrecover); otherwise fall back to approve.
            allowance_after = int(
                wallet_provider.read_contract(
                    token_address,
                    ERC20_ABI,
                    "allowance",
                    [owner, SPRAAY_CONTRACT_ADDRESS],
                )
            )
            if allowance_after < required:
                return None

            return (
                "Token allowance granted via EIP-2612 permit (exact value, "
                f"{PERMIT_DEADLINE_SECONDS // 60}-minute deadline, no standing unlimited "
                f"approval). Permit tx: {tx_hash}"
            )
        except Exception:
            # Token does not support EIP-2612 permit (or signing failed) — fall back to approve.
            return None

    def _request_with_x402(
        self, wallet_provider: EvmWalletProvider, path: str, body: dict[str, Any]
    ) -> str:
        """Make a request to an x402-metered Spraay gateway endpoint.

        The first request is unpaid; on a 402 challenge the payment is
        validated against the configured limit and settled either with a
        pre-funded payment header or by signing with the wallet provider via
        the x402 client. Payment is never faked or stubbed.

        Args:
            wallet_provider: The wallet provider used to sign the x402 payment.
            path: The gateway endpoint path.
            body: The JSON request body.

        Returns:
            str: JSON string with the result and payment details.

        """
        url = f"{self._config.gateway_base_url}{path}"

        try:
            initial_response = requests.post(url, json=body, timeout=30)

            if initial_response.status_code != 402:
                data = self._parse_response_data(initial_response)
                return json.dumps(
                    {
                        "success": initial_response.ok,
                        "url": url,
                        "status": initial_response.status_code,
                        "data": data,
                    },
                    indent=2,
                )

            # Parse the 402 challenge: v2 sends requirements in the
            # PAYMENT-REQUIRED header; v1 sends them in the body.
            accepts_array: list[dict[str, Any]] = []
            payment_required_header = initial_response.headers.get("payment-required")
            if payment_required_header:
                try:
                    decoded = json.loads(base64.b64decode(payment_required_header))
                    accepts_array = decoded.get("accepts", [])
                except Exception:
                    pass
            if not accepts_array:
                with contextlib.suppress(Exception):
                    accepts_array = initial_response.json().get("accepts", [])

            # Enforce the configured payment limit against the cheapest quoted option.
            quoted_amounts = [
                option.get("maxAmountRequired") or option.get("amount") or option.get("price")
                for option in accepts_array
            ]
            quoted_amounts = [amount for amount in quoted_amounts if amount]
            if quoted_amounts:
                cheapest = min(quoted_amounts, key=int)
                payment_validation = validate_payment_limit(
                    cheapest, self._config.max_gateway_payment_usdc
                )
                if not payment_validation["is_valid"]:
                    return json.dumps(
                        {
                            "error": True,
                            "message": "Gateway payment exceeds limit",
                            "details": (
                                f"The Spraay gateway quoted "
                                f"{payment_validation['requested_amount']} USDC, which exceeds "
                                f"the maximum gateway payment limit of "
                                f"{payment_validation['max_amount']} USDC. No payment was made."
                            ),
                            "maxGatewayPaymentUsdc": self._config.max_gateway_payment_usdc,
                            "acceptablePaymentOptions": accepts_array,
                        },
                        indent=2,
                    )

            # Settle the payment: pre-funded header if configured, otherwise
            # sign with the wallet provider via the x402 client.
            if self._config.x402_payment_header:
                paid_response = requests.post(
                    url,
                    json=body,
                    headers={
                        "X-PAYMENT": self._config.x402_payment_header,
                        "PAYMENT": self._config.x402_payment_header,
                    },
                    timeout=30,
                )
            else:
                client = x402ClientSync()
                register_exact_evm_client(client, EthAccountSigner(wallet_provider.to_signer()))
                session = x402_requests(client)
                paid_response = session.post(url, json=body, timeout=30)

            data = self._parse_response_data(paid_response)

            payment_response_header = paid_response.headers.get(
                "payment-response"
            ) or paid_response.headers.get("x-payment-response")
            payment_proof: dict[str, Any] | None = None
            if payment_response_header:
                try:
                    payment_proof = json.loads(base64.b64decode(payment_response_header))
                except Exception:
                    payment_proof = {"raw": payment_response_header}

            if paid_response.status_code != 200:
                return json.dumps(
                    {
                        "error": True,
                        "message": (
                            f"Gateway request failed with status {paid_response.status_code}. "
                            "Payment was not settled."
                        ),
                        "url": url,
                        "status": paid_response.status_code,
                        "data": data,
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "success": True,
                    "message": "Gateway request completed with x402 payment",
                    "url": url,
                    "status": paid_response.status_code,
                    "data": data,
                    "paymentProof": payment_proof,
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": f"Error calling the Spraay gateway at {url}",
                    "details": str(e),
                },
                indent=2,
            )

    def _parse_response_data(self, response: requests.Response) -> Any:
        """Parse response data based on content type.

        Args:
            response: The requests Response object.

        Returns:
            Any: Parsed response data.

        """
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                return response.json()
            except Exception:
                return response.text
        return response.text

    def _get_token_decimals(self, wallet_provider: EvmWalletProvider, token_address: str) -> int:
        """Get the number of decimals for an ERC-20 token.

        Args:
            wallet_provider: The wallet provider to read with.
            token_address: The ERC-20 token contract address.

        Returns:
            int: The token decimals, defaulting to 18 on failure.

        """
        try:
            return int(wallet_provider.read_contract(token_address, ERC20_ABI, "decimals", []))
        except Exception:
            return 18

    def _get_token_symbol(self, wallet_provider: EvmWalletProvider, token_address: str) -> str:
        """Get the symbol for an ERC-20 token.

        Args:
            wallet_provider: The wallet provider to read with.
            token_address: The ERC-20 token contract address.

        Returns:
            str: The token symbol, defaulting to "TOKEN" on failure.

        """
        try:
            return str(wallet_provider.read_contract(token_address, ERC20_ABI, "symbol", []))
        except Exception:
            return "TOKEN"


def spraay_action_provider(config: SpraayConfig | None = None) -> SpraayActionProvider:
    """Create a new SpraayActionProvider instance.

    Args:
        config: Optional configuration for gateway payment limits and endpoints.

    Returns:
        SpraayActionProvider: A new Spraay action provider instance.

    Example::

        from coinbase_agentkit import AgentKit, AgentKitConfig
        from coinbase_agentkit.action_providers.spraay import spraay_action_provider

        agent_kit = AgentKit(AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[spraay_action_provider()],
        ))

    """
    return SpraayActionProvider(config)
