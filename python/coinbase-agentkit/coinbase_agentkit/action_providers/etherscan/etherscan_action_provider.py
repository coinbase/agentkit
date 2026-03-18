"""Etherscan action provider for smart contract verification."""

import os
from typing import Any

import requests

from ...network import CHAIN_ID_TO_NETWORK_ID, NETWORK_ID_TO_CHAIN, Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetVerificationStatusSchema, VerifySmartContractSchema


class EtherscanActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for verifying smart contracts on Etherscan.

    This provider enables submission of smart contract source code to Etherscan
    (and compatible block explorers such as Basescan, Arbiscan, and Optimism Explorer)
    for verification, as well as checking the status of pending verification requests.
    """

    def __init__(self, api_key: str | None = None) -> None:
        """Initialize the EtherscanActionProvider.

        Args:
            api_key: Etherscan API key. Falls back to the ``ETHERSCAN_API_KEY``
                environment variable when not supplied directly.

        Raises:
            ValueError: If no API key is provided or found in the environment.

        """
        super().__init__("etherscan", [])

        api_key = api_key or os.getenv("ETHERSCAN_API_KEY")
        if not api_key:
            raise ValueError(
                "Etherscan API key is required. "
                "Provide it via the 'api_key' argument or the 'ETHERSCAN_API_KEY' environment variable."
            )
        self.api_key = api_key

    def _get_api_url(self, wallet_provider: EvmWalletProvider) -> str:
        """Resolve the correct block-explorer API URL for the current network.

        Args:
            wallet_provider: The active EVM wallet provider.

        Returns:
            The API URL string (e.g. ``https://api.etherscan.io/api``).

        Raises:
            ValueError: If the network cannot be resolved to a known chain.

        """
        network = wallet_provider.get_network()
        network_id = network.network_id
        chain_id = network.chain_id

        # Prefer network_id lookup; fall back to chain_id → network_id → chain.
        if network_id and network_id in NETWORK_ID_TO_CHAIN:
            chain = NETWORK_ID_TO_CHAIN[network_id]
        elif chain_id and chain_id in CHAIN_ID_TO_NETWORK_ID:
            resolved_network_id = CHAIN_ID_TO_NETWORK_ID[chain_id]
            chain = NETWORK_ID_TO_CHAIN[resolved_network_id]
        else:
            raise ValueError(
                f"Unsupported network: network_id={network_id}, chain_id={chain_id}. "
                "The network must be a supported EVM chain."
            )

        try:
            return chain.block_explorers["default"].api_url
        except (KeyError, AttributeError) as e:
            raise ValueError(
                f"No block explorer API URL configured for network '{network_id or chain_id}'."
            ) from e

    @create_action(
        name="verify_smart_contract",
        description="""
Verify and publish the source code of a deployed smart contract on Etherscan (or a compatible
block explorer such as Basescan or Arbiscan).

Use this action when:
- You have deployed a contract and want to verify its source code publicly
- You want to make the contract source code and ABI visible on the block explorer
- A user asks you to verify a contract they have deployed

Required inputs:
- contract_address: The on-chain address of the deployed contract
- source_code: Full Solidity source code (or Standard JSON input for multi-file projects)
- contract_name: Name declared in the source (e.g. 'MyToken'); for Standard JSON include the
  file path (e.g. 'contracts/MyToken.sol:MyToken')
- compiler_version: Exact compiler version string (e.g. 'v0.8.20+commit.a1b79de6')

Optional inputs:
- optimization_used: Whether the optimizer was enabled (default: False)
- runs: Optimizer runs (default: 200, only relevant when optimization_used is True)
- constructor_arguments: ABI-encoded constructor args without '0x' prefix (default: '')
- evm_version: Target EVM version, e.g. 'london' or 'paris' (default: compiler default)
- license_type: SPDX license type number 1-14 (default: 1 = No License)
- code_format: 'solidity-single-file' or 'solidity-standard-json-input' (default: single-file)

On success, returns a GUID that can be used with get_verification_status to poll for results.
""",
        schema=VerifySmartContractSchema,
    )
    def verify_smart_contract(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Submit a smart contract for source-code verification on Etherscan.

        Args:
            wallet_provider: The wallet provider instance (used to determine the network).
            args: Action arguments matching ``VerifySmartContractSchema``.

        Returns:
            A message containing the GUID for polling, or an error description.

        """
        try:
            validated = VerifySmartContractSchema(**args)
            api_url = self._get_api_url(wallet_provider)
        except ValueError as e:
            return f"Error preparing verification request: {e!s}"

        payload: dict[str, Any] = {
            "apikey": self.api_key,
            "module": "contract",
            "action": "verifysourcecode",
            "contractaddress": validated.contract_address,
            "sourceCode": validated.source_code,
            "codeformat": validated.code_format,
            "contractname": validated.contract_name,
            "compilerversion": validated.compiler_version,
            "optimizationUsed": 1 if validated.optimization_used else 0,
            "runs": validated.runs,
            "constructorArguements": validated.constructor_arguments,  # Etherscan API typo
            "licenseType": validated.license_type,
        }
        if validated.evm_version:
            payload["evmversion"] = validated.evm_version

        try:
            response = requests.post(api_url, data=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
        except requests.RequestException as e:
            return f"Error submitting verification request to {api_url}: {e!s}"
        except ValueError as e:
            return f"Error parsing Etherscan response: {e!s}"

        if result.get("status") == "1":
            guid = result.get("result", "")
            return (
                f"Contract verification submitted successfully for {validated.contract_address}. "
                f"GUID: {guid}. "
                "Use the get_verification_status action with this GUID to check the result."
            )
        else:
            message = result.get("result") or result.get("message") or "Unknown error"
            return (
                f"Etherscan returned an error for contract {validated.contract_address}: {message}"
            )

    @create_action(
        name="get_verification_status",
        description="""
Check the verification status of a previously submitted contract verification request on Etherscan.

Use this action when:
- You submitted a contract for verification and want to know if it succeeded
- A user asks for the result of a pending verification

Required inputs:
- guid: The GUID returned by the verify_smart_contract action

Possible status values:
- "Pending in queue" - the request is queued but not yet processed
- "Pass - Verified" - the contract source code has been successfully verified
- "Fail - Unable to verify" - verification failed (check compiler settings and source code)
- "Already Verified" - the contract is already verified on this block explorer
""",
        schema=GetVerificationStatusSchema,
    )
    def get_verification_status(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Check the status of a pending contract verification request.

        Args:
            wallet_provider: The wallet provider instance (used to determine the network).
            args: Action arguments matching ``GetVerificationStatusSchema``.

        Returns:
            A message describing the current verification status or an error.

        """
        try:
            validated = GetVerificationStatusSchema(**args)
            api_url = self._get_api_url(wallet_provider)
        except ValueError as e:
            return f"Error preparing status request: {e!s}"

        params: dict[str, str] = {
            "apikey": self.api_key,
            "module": "contract",
            "action": "checkverifystatus",
            "guid": validated.guid,
        }

        try:
            response = requests.get(api_url, params=params, timeout=30)
            response.raise_for_status()
            result = response.json()
        except requests.RequestException as e:
            return f"Error fetching verification status from {api_url}: {e!s}"
        except ValueError as e:
            return f"Error parsing Etherscan response: {e!s}"

        status = result.get("result") or result.get("message") or "Unknown"
        if result.get("status") == "1":
            return f"Verification status for GUID {validated.guid}: {status}"
        else:
            return f"Verification status for GUID {validated.guid}: {status}"

    def supports_network(self, network: Network) -> bool:
        """Check if the given network is supported by this provider.

        Only EVM-family networks with a configured block explorer are supported.

        Args:
            network: The network to check.

        Returns:
            ``True`` if the network is a supported EVM chain, ``False`` otherwise.

        """
        return network.protocol_family == "evm"


def etherscan_action_provider(api_key: str | None = None) -> EtherscanActionProvider:
    """Create and return a new EtherscanActionProvider instance.

    Args:
        api_key: Etherscan API key. Falls back to the ``ETHERSCAN_API_KEY``
            environment variable when not supplied directly.

    Returns:
        A configured ``EtherscanActionProvider``.

    """
    return EtherscanActionProvider(api_key=api_key)
