"""ThoughtProof action provider."""

import json
import os
from typing import Any

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetVerificationReceiptSchema, VerifyReasoningSchema


class ThoughtProofActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for epistemic verification via ThoughtProof.

    ThoughtProof verifies AI agent reasoning using multi-model adversarial consensus
    (4 independent LLMs cross-verify claims). Returns signed verification receipts
    that serve as cryptographic proof of reasoning quality.

    API docs: https://api.thoughtproof.ai/openapi.json
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        super().__init__("thoughtproof", [])

        self.api_key = api_key or os.getenv("THOUGHTPROOF_API_KEY")
        self.base_url = "https://api.thoughtproof.ai/v1"

        if not self.api_key:
            raise ValueError(
                "THOUGHTPROOF_API_KEY is not configured. "
                "Set it as an environment variable or pass api_key to the constructor. "
                "Get a key at https://thoughtproof.ai"
            )

    def _get_headers(self) -> dict[str, str]:
        """Get request headers with API key authentication."""
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }

    @create_action(
        name="verify_reasoning",
        description="""Verify a reasoning claim via multi-model adversarial consensus.

    Runs 4 independent LLMs to cross-verify whether a reasoning claim is sound.
    Returns a verdict (ALLOW/BLOCK/UNCERTAIN), confidence score, and any objections.

    Inputs:
    - claim: The reasoning claim to verify (e.g. "This swap is safe because liquidity is sufficient")
    - context: Additional context for verification (optional)
    - domain: Domain hint — financial, medical, legal, code, or general (optional, defaults to general)
    - speed: Verification depth — fast ($0.008), standard ($0.02), or deep ($0.08) (optional, defaults to standard)

    Examples:
    - Verify a DeFi decision: claim="Swapping 1 ETH for USDC on Uniswap v3 is safe at current slippage"
    - Verify a code review: claim="This smart contract has no reentrancy vulnerabilities", domain="code"
    - Quick check: claim="Market conditions support this trade", speed="fast"
    """,
        schema=VerifyReasoningSchema,
    )
    def verify_reasoning(self, args: dict[str, Any]) -> str:
        """Verify reasoning via adversarial consensus.

        Args:
            args (dict[str, Any]): Arguments containing claim and optional context/domain/speed.

        Returns:
            str: A JSON string containing the verification results or error details.

        """
        validated_args = VerifyReasoningSchema(**args)

        request_body: dict[str, Any] = {"claim": validated_args.claim}
        if validated_args.context:
            request_body["context"] = validated_args.context
        if validated_args.domain:
            request_body["domain"] = validated_args.domain
        if validated_args.speed:
            request_body["speed"] = validated_args.speed

        try:
            response = requests.post(
                f"{self.base_url}/check",
                json=request_body,
                headers=self._get_headers(),
                timeout=60,
            )

            if not response.ok:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"API error: {response.status_code} {response.text}",
                    }
                )

            result = response.json()
            return json.dumps(
                {
                    "success": True,
                    "verdict": result.get("verdict"),
                    "confidence": result.get("confidence"),
                    "objections": result.get("objections", []),
                    "modelCount": result.get("modelCount"),
                    "durationMs": result.get("durationMs"),
                }
            )

        except requests.exceptions.RequestException as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"Request failed: {e}",
                }
            )

    @create_action(
        name="get_verification_receipt",
        description="""Issue a cryptographically signed verification receipt.

    Creates an EdDSA-signed receipt for a verification verdict. The receipt includes
    a JWT that can be independently verified via the issuer's JWKS endpoint.
    Useful for audit trails, compliance, and on-chain settlement.

    Inputs:
    - agent_id: The ERC-8004 agent ID or identifier requesting the receipt (required)
    - claim: The reasoning claim that was verified (required)
    - verdict: The verification verdict — ALLOW, BLOCK, or UNCERTAIN (required)
    - domain: Domain context for the verification (optional)
    - metadata: Key-value pairs of additional metadata (optional)

    Examples:
    - After verification: agent_id="agent-28388", claim="Swap is safe", verdict="ALLOW"
    - With metadata: agent_id="my-agent", claim="Contract is secure", verdict="ALLOW", metadata={"chain": "base"}
    """,
        schema=GetVerificationReceiptSchema,
    )
    def get_verification_receipt(self, args: dict[str, Any]) -> str:
        """Get a cryptographically signed verification receipt.

        Args:
            args (dict[str, Any]): Arguments containing agentId, claim, verdict and optional domain/metadata.

        Returns:
            str: A JSON string containing the verification receipt or error details.

        """
        validated_args = GetVerificationReceiptSchema(**args)

        request_body: dict[str, Any] = {
            "agentId": validated_args.agent_id,
            "claim": validated_args.claim,
            "verdict": validated_args.verdict,
        }
        if validated_args.domain:
            request_body["domain"] = validated_args.domain
        if validated_args.metadata:
            request_body["metadata"] = validated_args.metadata

        try:
            response = requests.post(
                f"{self.base_url}/verify",
                json=request_body,
                headers=self._get_headers(),
                timeout=30,
            )

            if not response.ok:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"API error: {response.status_code} {response.text}",
                    }
                )

            result = response.json()
            return json.dumps(
                {
                    "success": True,
                    "receiptId": result.get("receiptId"),
                    "agentId": result.get("agentId"),
                    "verdict": result.get("verdict"),
                    "score": result.get("score"),
                    "jwt": result.get("jwt"),
                    "verifyUrl": result.get("verifyUrl"),
                }
            )

        except requests.exceptions.RequestException as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"Request failed: {e}",
                }
            )

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported.

        ThoughtProof operates at the reasoning layer and is network-agnostic.

        Returns:
            bool: Always True.

        """
        return True


def thoughtproof_action_provider(
    api_key: str | None = None,
) -> ThoughtProofActionProvider:
    """Create and return a new ThoughtProofActionProvider instance.

    Args:
        api_key: ThoughtProof API key. Falls back to THOUGHTPROOF_API_KEY env var.

    Returns:
        ThoughtProofActionProvider: A configured provider instance.

    """
    return ThoughtProofActionProvider(api_key=api_key)
