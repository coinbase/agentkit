from typing import Any

from pydantic import BaseModel, Field


class NillionCreateSchemaInput(BaseModel):
    """Input argument schema for schema create action."""

    schema_description: str = Field(
        ..., description="a complete description of the desired nildb schema"
    )


class NillionDataDownloadInput(BaseModel):
    """Input argument schema for data download action."""

    schema_uuid: str = Field(description="the UUID4 obtained from the nildb_schema_lookup_tool")


class NillionDataUploadInput(BaseModel):
    """Input argument schema for data upload action."""

    schema_uuid: str = Field(description="the UUID obtained from the nillion_lookup_schema tool.")
    data_to_store: list[dict[str, Any]] = Field(
        description="data to store in the database that validates against desired schema"
    )


class NillionLookupSchemaInput(BaseModel):
    """Input argument schema for lookup schema action."""

    schema_description: str = Field(
        ..., description="a complete description of the desired nildb schema"
    )
