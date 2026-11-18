"""
Optume Translations x402 Action Provider for Coinbase AgentKit (Python).

Enables autonomous AI agents using Coinbase AgentKit to natively execute turnkey
legal-grade translations over x402 micropayments settled on Base Layer-2.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from pydantic import BaseModel, Field

# Graceful import of Coinbase AgentKit ActionProvider base class & decorator
try:
    from coinbase_agentkit.action_providers.action_decorator import create_action
    from coinbase_agentkit.action_providers.action_provider import ActionProvider

    HAS_AGENTKIT = True
except ImportError:
    HAS_AGENTKIT = False

    class ActionProvider:
        """Fallback ActionProvider base class when coinbase-agentkit is not installed."""

        def __init__(
            self, name: str = "", dependencies: list[Any] | None = None
        ) -> None:
            self.name = name

        def get_actions(self, wallet_provider: Any = None) -> list[Any]:
            return []

    def create_action(*args: Any, **kwargs: Any) -> Any:
        """Fallback decorator for create_action."""

        def decorator(func: Any) -> Any:
            return func

        return decorator


# ---------------------------------------------------------------------------
# Pydantic Input Schemas for AgentKit Actions
# ---------------------------------------------------------------------------


class RunFullPipelineInput(BaseModel):
    raw_text: str | None = Field(
        None,
        description="Raw legal contract text to translate.",
    )
    document_url: str | None = Field(
        None,
        description="Public URL of document to execute complete end-to-end 7-node Veritas legal translation pipeline.",
    )
    source_language: str = Field(
        "en",
        description="ISO source language code (e.g. 'en').",
    )
    target_language: str = Field(
        "fr",
        description="ISO target language code (e.g. 'fr', 'es', 'de', 'ar', 'zh').",
    )


# ---------------------------------------------------------------------------
# Safe Redirect Handler
# ---------------------------------------------------------------------------


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """
    Secure redirect handler preventing cross-origin token leakage and protocol downgrades.
    """

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        orig_parsed = urllib.parse.urlparse(req.full_url)
        new_parsed = urllib.parse.urlparse(newurl)

        # Reject protocol downgrade from HTTPS to HTTP
        if orig_parsed.scheme == "https" and new_parsed.scheme != "https":
            raise urllib.error.HTTPError(
                newurl,
                code,
                "Redirect rejected: protocol downgrade from HTTPS to HTTP is forbidden.",
                headers,
                fp,
            )

        # Reject cross-origin redirects
        if orig_parsed.netloc.lower() != new_parsed.netloc.lower():
            raise urllib.error.HTTPError(
                newurl,
                code,
                f"Redirect rejected: cross-origin redirect to {new_parsed.netloc} is forbidden.",
                headers,
                fp,
            )

        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req:
            # Preserve X-402-Payment-Proof header across allowed redirects
            proof_header = req.headers.get("X-402-payment-proof") or req.headers.get(
                "X-402-Payment-Proof"
            )
            if proof_header:
                new_req.add_header("X-402-Payment-Proof", proof_header)
        return new_req


# ---------------------------------------------------------------------------
# Optume Action Provider Implementation
# ---------------------------------------------------------------------------


class OptumeActionProvider(ActionProvider):
    """
    Coinbase AgentKit Action Provider for Optume Translations x402 Services.
    """

    def __init__(self, base_url: str = "https://api.optranslations.com"):
        if HAS_AGENTKIT:
            super().__init__("optume", [])
        else:
            self.name = "optume"

        parsed = urllib.parse.urlparse(base_url)

        # Validate HTTPS-origin policy (allowing http only for localhost/127.0.0.1 in local dev)
        if parsed.scheme not in ("https", "http"):
            raise ValueError(
                f"Invalid base_url scheme '{parsed.scheme}'. Must be HTTPS."
            )
        if parsed.scheme == "http" and parsed.hostname not in (
            "localhost",
            "127.0.0.1",
            "testserver",
        ):
            raise ValueError("Insecure HTTP base_url allowed only for local testing.")

        self.base_url = base_url.rstrip("/")

    def supports_network(self, network: Any) -> bool:
        """
        Check whether target EVM network is supported (Base Mainnet / Sepolia).
        """
        net_str = str(network).lower().strip()
        if hasattr(network, "network_id"):
            net_str = str(network.network_id).lower().strip()
        elif hasattr(network, "chain_id"):
            net_str = str(network.chain_id).lower().strip()

        supported_bases = {
            "base",
            "8453",
            "84532",
            "eip155:8453",
            "eip155:84532",
            "base-mainnet",
            "base-sepolia",
        }
        return net_str in supported_bases

    def _execute_x402_request(
        self,
        endpoint_path: str,
        payload: dict[str, Any],
        x402_payment_proof: str | None = None,
    ) -> dict[str, Any]:
        """
        Helper method to execute HTTP POST requests to Optume x402 endpoints with redirect security.
        """
        url = f"{self.base_url}{endpoint_path}"
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        if x402_payment_proof:
            headers["X-402-Payment-Proof"] = x402_payment_proof

        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        opener = urllib.request.build_opener(SafeRedirectHandler())

        try:
            with opener.open(req, timeout=30.0) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
            try:
                error_json = json.loads(body)
            except Exception:
                error_json = {"error": str(e), "raw_body": body}

            return {
                "status_code": e.code,
                "x402_challenge": {
                    "price_usdc": e.headers.get("X-402-Price-USDC")
                    if hasattr(e, "headers")
                    else None,
                    "pay_to": e.headers.get("X-402-Pay-To")
                    if hasattr(e, "headers")
                    else None,
                    "network": e.headers.get("X-402-Network", "eip155:8453")
                    if hasattr(e, "headers")
                    else "eip155:8453",
                },
                "response": error_json,
            }
        except Exception as e:
            return {"error": str(e)}

    # ---------------------------------------------------------------------------
    # AgentKit Decorated Action Methods
    # ---------------------------------------------------------------------------

    @create_action(
        name="veritas_legal_translation",
        description="Turnkey legal-grade document translation engine combining all 7 Veritas pipeline nodes ($0.0005/word, min $0.05 USDC on Base L2).",
        schema=RunFullPipelineInput,
    )
    def veritas_legal_translation(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            RunFullPipelineInput.model_validate(args)
            if isinstance(args, dict)
            else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/veritas/legal-translation", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    def get_actions(self, wallet_provider: Any = None) -> list[Any]:
        """
        Return the list of actions exposed to Coinbase AgentKit.
        """
        if HAS_AGENTKIT and hasattr(super(), "get_actions"):
            actions = super().get_actions(wallet_provider)
            if actions:
                return actions

        return [
            {
                "name": "veritas_legal_translation",
                "description": "Turnkey legal-grade document translation engine combining all 7 Veritas pipeline nodes ($0.0005/word, min $0.05 USDC on Base L2).",
                "schema": RunFullPipelineInput,
                "func": self.veritas_legal_translation,
            },
        ]


def optume_action_provider(
    base_url: str = "https://api.optranslations.com",
) -> OptumeActionProvider:
    """
    Factory function for OptumeActionProvider.
    """
    return OptumeActionProvider(base_url=base_url)
