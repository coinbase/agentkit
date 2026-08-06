"""
Optume Translations x402 Action Provider for Coinbase AgentKit (Python).

Enables autonomous AI agents using Coinbase AgentKit to natively parse documents,
extract spatial AST structures, generate legal glossaries, perform legal QA audits,
and execute multi-language legal translations over x402 micropayments ($0.01 - $0.50 USDC)
settled on Base Layer-2.
"""

import json
import urllib.error
import urllib.request
from typing import Any

from pydantic import BaseModel, Field

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
# Optume Action Provider Implementation
# ---------------------------------------------------------------------------


class OptumeActionProvider:
    """
    Coinbase AgentKit Action Provider for Optume Translations x402 Services.
    """

    def __init__(self, base_url: str = "https://api.optranslations.com"):
        self.name = "optume"
        self.base_url = base_url.rstrip("/")

    def get_actions(self) -> list[dict[str, Any]]:
        """
        Return the list of actions exposed to Coinbase AgentKit.
        """
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
                "name": "run_full_veritas_pipeline",
                "description": "Complete end-to-end legal translation pipeline across all 7 Veritas nodes ($0.500 USDC on Base L2).",
                "schema": RunFullPipelineInput,
                "func": self.run_full_veritas_pipeline,
            },
        ]

    def _execute_x402_request(
        self,
        endpoint_path: str,
        payload: dict[str, Any],
        x402_payment_proof: str | None = None,
    ) -> dict[str, Any]:
        """
        Helper method to execute HTTP POST requests to Optume x402 endpoints.
        Returns the JSON response or the x402 payment required challenge.
        """
        url = f"{self.base_url}{endpoint_path}"
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        if x402_payment_proof:
            headers["X-402-Payment-Proof"] = x402_payment_proof

        req = urllib.request.Request(url, data=data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                error_json = json.loads(body)
            except Exception:
                error_json = {"error": str(e), "raw_body": body}

            return {
                "status_code": e.code,
                "x402_challenge": {
                    "price_usdc": e.headers.get("X-402-Price-USDC"),
                    "pay_to": e.headers.get("X-402-Pay-To"),
                    "network": e.headers.get("X-402-Network", "base"),
                },
                "response": error_json,
            }
        except Exception as e:
            return {"error": str(e)}

    # Action implementations
    def parse_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request("/api/v1/parser/analyze", args, x402_proof)

    def extract_veritas_chunks(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request(
            "/api/v1/parser/veritas-chunks", args, x402_proof
        )

    def analyze_legal_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request("/api/v1/veritas/analyze", args, x402_proof)

    def compile_translation_context(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request(
            "/api/v1/veritas/compile-context", args, x402_proof
        )

    def translate_legal_clauses(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request("/api/v1/veritas/translate", args, x402_proof)

    def audit_legal_qa(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request(
            "/api/v1/veritas/evaluate-qa", args, x402_proof
        )

    def assemble_translated_document(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request(
            "/api/v1/veritas/assemble-document", args, x402_proof
        )

    def run_full_veritas_pipeline(
        self, args: dict[str, Any], x402_proof: str | None = None
    ) -> dict[str, Any]:
        return self._execute_x402_request("/api/v1/veritas/run-full", args, x402_proof)


def optume_action_provider(
    base_url: str = "https://api.optranslations.com",
) -> OptumeActionProvider:
    """
    Factory function for OptumeActionProvider.
    """
    return OptumeActionProvider(base_url=base_url)
