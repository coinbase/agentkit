"""
Optume Translations x402 Action Provider for Coinbase AgentKit (Python).

Enables autonomous AI agents using Coinbase AgentKit to natively parse documents,
extract spatial AST structures, generate legal glossaries, perform legal QA audits,
and execute multi-language legal translations over x402 micropayments ($0.01 - $0.50 USDC)
settled on Base Layer-2.
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


class ParseDocumentInput(BaseModel):
    document_url: str = Field(
        ...,
        description="Public URL or accessible link of the document (PDF, DOCX, XLSX, PPTX, image) to parse.",
    )


class ExtractVeritasChunksInput(BaseModel):
    document_url: str = Field(
        ...,
        description="Public URL of document to extract spatial AST layout, table grids, and clause hierarchies.",
    )


class AnalyzeLegalDocumentInput(BaseModel):
    document_url: str = Field(
        ...,
        description="Public URL of the legal contract to extract defined terms and generate structured legal glossary.",
    )


class CompileContextInput(BaseModel):
    document_id: str = Field(
        ...,
        description="Unique Document ID from pre-translation analysis.",
    )
    target_language: str = Field(
        "fr",
        description="ISO language code for target translation (e.g., 'fr', 'es', 'de', 'ar', 'zh').",
    )


class TranslateClausesInput(BaseModel):
    document_id: str = Field(
        ...,
        description="Unique Document ID with compiled context directives.",
    )
    target_language: str = Field(
        "fr",
        description="ISO target language code.",
    )


class EvaluateQAInput(BaseModel):
    document_id: str = Field(
        ...,
        description="Unique Document ID of translated legal contract to run QA risk and terminology audit.",
    )


class AssembleDocumentInput(BaseModel):
    document_id: str = Field(
        ...,
        description="Unique Document ID to assemble into final spatial-layout-preserved document.",
    )


class RunFullPipelineInput(BaseModel):
    document_url: str = Field(
        ...,
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
# Custom Safe HTTP Redirect Handler
# ---------------------------------------------------------------------------


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """
    Custom redirect handler enforcing HTTPS origin policy and rejecting
    cross-origin or HTTP downgrade redirects.
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

        # Reject origin change
        if orig_parsed.netloc != new_parsed.netloc:
            raise urllib.error.HTTPError(
                newurl,
                code,
                f"Redirect rejected: cross-origin redirect to {new_parsed.netloc} is forbidden.",
                headers,
                fp,
            )

        # Reject protocol downgrade from HTTPS to HTTP
        if orig_parsed.scheme == "https" and new_parsed.scheme != "https":
            raise urllib.error.HTTPError(
                newurl,
                code,
                "Redirect rejected: protocol downgrade from HTTPS to HTTP is forbidden.",
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
        name="parse_document",
        description="High-speed spatial parsing for PDF, DOCX, XLSX, PPTX, and OCR Images ($0.010 USDC on Base L2).",
        schema=ParseDocumentInput,
    )
    def parse_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            ParseDocumentInput.model_validate(args) if isinstance(args, dict) else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request("/api/v1/parser/analyze", payload, x402_proof)
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="extract_veritas_chunks",
        description="Extracts spatial AST layout, table grids, and clause structural hierarchies ($0.025 USDC on Base L2).",
        schema=ExtractVeritasChunksInput,
    )
    def extract_veritas_chunks(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            ExtractVeritasChunksInput.model_validate(args)
            if isinstance(args, dict)
            else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/parser/veritas-chunks", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="analyze_legal_document",
        description="Ingestion, defined legal terms extraction, and structured legal glossary generation ($0.050 USDC on Base L2).",
        schema=AnalyzeLegalDocumentInput,
    )
    def analyze_legal_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            AnalyzeLegalDocumentInput.model_validate(args)
            if isinstance(args, dict)
            else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request("/api/v1/veritas/analyze", payload, x402_proof)
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="compile_translation_context",
        description="Filters sub-glossaries and compiles translation directives per clause chunk ($0.020 USDC on Base L2).",
        schema=CompileContextInput,
    )
    def compile_translation_context(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            CompileContextInput.model_validate(args) if isinstance(args, dict) else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/veritas/compile-context", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="translate_legal_clauses",
        description="Parallel clause translation engine preserving formatting across 50+ languages ($0.150 USDC on Base L2).",
        schema=TranslateClausesInput,
    )
    def translate_legal_clauses(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            TranslateClausesInput.model_validate(args)
            if isinstance(args, dict)
            else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/veritas/translate", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="audit_legal_qa",
        description="Multi-dimensional audit of legal terminology, numerical accuracy, and omissions ($0.050 USDC on Base L2).",
        schema=EvaluateQAInput,
    )
    def audit_legal_qa(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            EvaluateQAInput.model_validate(args) if isinstance(args, dict) else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/veritas/evaluate-qa", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="assemble_translated_document",
        description="Re-assembles translated text into layout-preserving original document structures ($0.050 USDC on Base L2).",
        schema=AssembleDocumentInput,
    )
    def assemble_translated_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        validated = (
            AssembleDocumentInput.model_validate(args)
            if isinstance(args, dict)
            else args
        )
        payload = validated.model_dump() if hasattr(validated, "model_dump") else args
        res = self._execute_x402_request(
            "/api/v1/veritas/assemble-document", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

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
            "/api/v1/veritas/run-full", payload, x402_proof
        )
        return json.dumps(res) if HAS_AGENTKIT else res

    @create_action(
        name="run_full_veritas_pipeline",
        description="Complete end-to-end legal translation pipeline across all 7 Veritas nodes ($0.0005/word, min $0.05 USDC on Base L2).",
        schema=RunFullPipelineInput,
    )
    def run_full_veritas_pipeline(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> str | dict[str, Any]:
        return self.veritas_legal_translation(args, x402_proof)

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
                "name": "parse_document",
                "description": "High-speed spatial parsing for PDF, DOCX, XLSX, PPTX, and OCR Images ($0.010 USDC on Base L2).",
                "schema": ParseDocumentInput,
                "func": self.parse_document,
            },
            {
                "name": "extract_veritas_chunks",
                "description": "Extracts spatial AST layout, table grids, and clause structural hierarchies ($0.025 USDC on Base L2).",
                "schema": ExtractVeritasChunksInput,
                "func": self.extract_veritas_chunks,
            },
            {
                "name": "analyze_legal_document",
                "description": "Ingestion, defined legal terms extraction, and structured legal glossary generation ($0.050 USDC on Base L2).",
                "schema": AnalyzeLegalDocumentInput,
                "func": self.analyze_legal_document,
            },
            {
                "name": "compile_translation_context",
                "description": "Filters sub-glossaries and compiles translation directives per clause chunk ($0.020 USDC on Base L2).",
                "schema": CompileContextInput,
                "func": self.compile_translation_context,
            },
            {
                "name": "translate_legal_clauses",
                "description": "Parallel clause translation engine preserving formatting across 50+ languages ($0.150 USDC on Base L2).",
                "schema": TranslateClausesInput,
                "func": self.translate_legal_clauses,
            },
            {
                "name": "audit_legal_qa",
                "description": "Multi-dimensional audit of legal terminology, numerical accuracy, and omissions ($0.050 USDC on Base L2).",
                "schema": EvaluateQAInput,
                "func": self.audit_legal_qa,
            },
            {
                "name": "assemble_translated_document",
                "description": "Re-assembles translated text into layout-preserving original document structures ($0.050 USDC on Base L2).",
                "schema": AssembleDocumentInput,
                "func": self.assemble_translated_document,
            },
            {
                "name": "veritas_legal_translation",
                "description": "Turnkey legal-grade document translation engine combining all 7 Veritas pipeline nodes ($0.0005/word, min $0.05 USDC on Base L2).",
                "schema": RunFullPipelineInput,
                "func": self.veritas_legal_translation,
            },
            {
                "name": "run_full_veritas_pipeline",
                "description": "Complete end-to-end legal translation pipeline across all 7 Veritas nodes ($0.0005/word, min $0.05 USDC on Base L2).",
                "schema": RunFullPipelineInput,
                "func": self.run_full_veritas_pipeline,
            },
        ]


def optume_action_provider(
    base_url: str = "https://api.optranslations.com",
) -> OptumeActionProvider:
    """
    Factory function for OptumeActionProvider.
    """
    return OptumeActionProvider(base_url=base_url)
