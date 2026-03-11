"""Schemas for the Etherscan action provider."""

from pydantic import BaseModel, Field


class VerifySmartContractSchema(BaseModel):
    """Schema for verifying a smart contract on Etherscan."""

    contract_address: str = Field(
        ...,
        description="The address of the deployed smart contract to verify",
    )
    source_code: str = Field(
        ...,
        description=(
            "The Solidity source code of the contract. For a single-file contract, provide the "
            "full source. For a multi-file project, provide the Standard JSON input."
        ),
    )
    contract_name: str = Field(
        ...,
        description=(
            "The name of the contract as declared in the source code. For Standard JSON input, "
            "include the file path (e.g. 'contracts/MyToken.sol:MyToken')"
        ),
    )
    compiler_version: str = Field(
        ...,
        description=(
            "The Solidity compiler version used to compile the contract "
            "(e.g. 'v0.8.20+commit.a1b79de6')"
        ),
    )
    optimization_used: bool = Field(
        default=False,
        description="Whether compiler optimization was enabled during compilation",
    )
    runs: int = Field(
        default=200,
        description="Number of optimization runs (only relevant when optimization_used is True)",
        ge=1,
    )
    constructor_arguments: str = Field(
        default="",
        description=(
            "ABI-encoded constructor arguments (without the '0x' prefix). "
            "Leave empty if the constructor takes no arguments."
        ),
    )
    evm_version: str = Field(
        default="",
        description=(
            "Target EVM version for the compiler (e.g. 'london', 'paris', 'shanghai'). "
            "Leave empty to use the compiler default."
        ),
    )
    license_type: int = Field(
        default=1,
        description=(
            "SPDX license identifier number: 1=No License, 2=The Unlicense, 3=MIT, "
            "4=GNU GPLv2, 5=GNU GPLv3, 6=GNU LGPLv2.1, 7=GNU LGPLv3, "
            "8=BSD-2-Clause, 9=BSD-3-Clause, 10=MPL-2.0, 11=OSL-3.0, "
            "12=Apache-2.0, 13=GNU AGPLv3, 14=BSL 1.1"
        ),
        ge=1,
        le=14,
    )
    code_format: str = Field(
        default="solidity-single-file",
        description=(
            "Source code format: 'solidity-single-file' for a single Solidity file, "
            "or 'solidity-standard-json-input' for a Standard JSON input"
        ),
    )


class GetVerificationStatusSchema(BaseModel):
    """Schema for checking the verification status of a submitted contract."""

    guid: str = Field(
        ...,
        description=(
            "The GUID returned by the verify_smart_contract action when the verification "
            "request was submitted"
        ),
    )
