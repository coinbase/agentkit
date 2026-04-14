"""Schemas for ThoughtProof action provider."""

from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


class VerifyReasoningSchema(BaseModel):
    """Input schema for verifying reasoning via adversarial consensus."""

    claim: str = Field(..., description="The reasoning claim or statement to verify")
    context: Optional[str] = Field(
        None, description="Additional context for the verification"
    )
    domain: Optional[Literal["financial", "medical", "legal", "code", "general"]] = Field(
        None, description="The domain context for verification (defaults to general)"
    )
    speed: Optional[Literal["fast", "standard", "deep"]] = Field(
        None, description="The verification speed/depth (defaults to standard)"
    )


class GetVerificationReceiptSchema(BaseModel):
    """Input schema for getting a cryptographically signed verification receipt."""

    agent_id: str = Field(..., description="The ID of the agent requesting verification")
    claim: str = Field(..., description="The reasoning claim that was verified")
    verdict: Literal["ALLOW", "BLOCK", "UNCERTAIN"] = Field(
        ..., description="The verification verdict"
    )
    domain: Optional[str] = Field(
        None, description="The domain context for the verification"
    )
    metadata: Optional[Dict[str, str]] = Field(
        None, description="Additional metadata for the verification receipt"
    )
