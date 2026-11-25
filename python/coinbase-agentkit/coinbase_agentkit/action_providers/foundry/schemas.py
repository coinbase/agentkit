"""Schemas for Foundry action provider."""

from pydantic import BaseModel, Field


class ListFoundryToolsSchema(BaseModel):
    """Input schema for listing Foundry tools."""

    keyword: str | None = Field(
        default=None,
        description="Optional keyword to filter tools by id, description or tag (e.g. 'contract', 'ocr', 'dns')",
    )


class CallFoundryToolSchema(BaseModel):
    """Input schema for calling a Foundry tool."""

    tool: str = Field(
        ...,
        description="The tool id from list_foundry_tools, e.g. 'contract-facts' or 'tx-explain'",
    )
    input: str = Field(
        ...,
        description="The tool's input string, e.g. a contract address, tx hash, URL, or text",
    )
