"""Utility functions for x402 action provider."""

from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode, urlparse

import requests

from ..erc20.constants import TOKEN_ADDRESSES_BY_SYMBOLS
from ..erc20.utils import get_token_details
from .constants import (
    KNOWN_FACILITATORS,
    NETWORK_MAPPINGS,
    SOLANA_USDC_ADDRESSES,
    DiscoveryResource,
    SimplifiedResource,
    X402Version,
)

if TYPE_CHECKING:
    from ...network import Network
    from ...wallet_providers.wallet_provider import WalletProvider


def get_x402_networks(network: Network) -> list[str]:
    """Return array of matching network identifiers (both v1 and v2 CAIP-2 formats).

    Used for filtering discovery results that may contain either format.

    Args:
        network: The network object

    Returns:
        Array of network identifiers that match the wallet's network

    """
    network_id = network.network_id
    if not network_id:
        return []
    return NETWORK_MAPPINGS.get(network_id, [network_id])


def get_network_id(network: str) -> str:
    """Get network ID from a CAIP-2 or v1 network identifier.

    Args:
        network: The x402 network identifier (e.g., "eip155:8453" for v2 or "base" for v1)

    Returns:
        The network ID (e.g., "base-mainnet") or the original if not found

    """
    for agentkit_id, formats in NETWORK_MAPPINGS.items():
        if network in formats:
            return agentkit_id
    return network


def _fetch_with_retry(
    url: str,
    context: str = "",
    max_retries: int = 3,
    initial_delay_ms: int = 1000,
) -> requests.Response:
    """Fetch a URL with retry logic and exponential backoff for errors.

    Args:
        url: The URL to fetch
        context: Optional context string for error messages (e.g., "page 1")
        max_retries: Maximum number of retries (default 3)
        initial_delay_ms: Initial delay in milliseconds (default 1000)

    Returns:
        The requests Response

    Raises:
        RuntimeError: If all retries fail

    """
    context_str = f" ({context})" if context else ""

    for attempt in range(max_retries + 1):
        try:
            response = requests.get(url, timeout=30)
            if response.ok:
                return response
            raise RuntimeError(f"HTTP {response.status_code} {response.reason}")
        except Exception as error:
            if attempt >= max_retries:
                raise RuntimeError(
                    f"Failed to fetch{context_str} after {max_retries} retries: {error}"
                ) from error

            delay_ms = initial_delay_ms * (2**attempt)
            print(
                f"Fetch error{context_str}: {error}, "
                f"retrying in {delay_ms}ms (attempt {attempt + 1}/{max_retries})"
            )
            time.sleep(delay_ms / 1000)

    raise RuntimeError(f"Failed to fetch{context_str} after {max_retries} retries")


def fetch_all_discovery_resources(
    discovery_url: str,
    page_size: int = 1000,
) -> list[DiscoveryResource]:
    """Fetch all resources from the discovery API with pagination.

    Args:
        discovery_url: The base URL for discovery
        page_size: Number of resources per page (default 1000)

    Returns:
        Array of all discovered resources

    """
    all_resources: list[DiscoveryResource] = []
    offset = 0
    page_number = 1
    known_total = 0

    while True:
        url = f"{discovery_url}?limit={page_size}&offset={offset}"
        page_context = f"page {page_number}, offset {offset}"

        try:
            response = _fetch_with_retry(url, page_context)
        except RuntimeError:
            # If a page fails, skip to the next page
            print(f"Failed to fetch {page_context}, skipping to next page")
            offset += page_size
            page_number += 1

            # Stop if we've exceeded the known total (from previous successful responses)
            if known_total > 0 and offset >= known_total:
                break
            # If we've never had a successful response, stop after first failure
            if known_total == 0:
                break

            time.sleep(0.25)
            continue

        data = response.json()
        resources = data.get("resources", data.get("items", []))
        total = data.get("pagination", {}).get("total", 0)

        # Update known total from successful response
        if total > 0:
            known_total = total

        all_resources.extend(resources)

        # Use pagination.total to determine if we're done
        offset += len(resources)
        page_number += 1

        if len(resources) == 0 or offset >= known_total:
            break

        # Small delay between pages to avoid rate limiting
        time.sleep(0.25)

    return all_resources


def filter_by_network(
    resources: list[DiscoveryResource],
    wallet_networks: list[str],
) -> list[DiscoveryResource]:
    """Filter resources by network compatibility.

    Matches resources that accept any of the wallet's network identifiers (v1 or v2 format).

    Args:
        resources: Array of discovery resources
        wallet_networks: Array of network identifiers to match

    Returns:
        Filtered array of resources

    """
    filtered = []
    for resource in resources:
        accepts = resource.get("accepts", [])
        if any(option.get("network") in wallet_networks for option in accepts):
            filtered.append(resource)
    return filtered


def _get_resource_description(resource: DiscoveryResource) -> str:
    """Extract description from a resource based on its x402 version.

    - v1: description is in accepts[].description
    - v2: description is in metadata.description

    Args:
        resource: The discovery resource

    Returns:
        The description string or empty string if not found

    """
    x402_version = resource.get("x402_version", resource.get("x402Version"))
    if x402_version == 2:
        metadata = resource.get("metadata", {})
        metadata_desc = metadata.get("description") if metadata else None
        return metadata_desc if isinstance(metadata_desc, str) else ""

    # v1: look in accepts[].description
    accepts = resource.get("accepts", [])
    for option in accepts:
        desc = option.get("description", "")
        if desc and desc.strip():
            return desc
    return ""


def filter_by_description(resources: list[DiscoveryResource]) -> list[DiscoveryResource]:
    """Filter resources by having a valid description.

    Removes resources with empty or default descriptions.
    Supports both v1 (accepts[].description) and v2 (metadata.description) formats.

    Args:
        resources: Array of discovery resources

    Returns:
        Filtered array of resources with valid descriptions

    """
    filtered = []
    for resource in resources:
        desc = _get_resource_description(resource).strip()
        if desc and desc != "Access to protected content":
            filtered.append(resource)
    return filtered


def filter_by_x402_version(
    resources: list[DiscoveryResource],
    allowed_versions: list[X402Version] | None = None,
) -> list[DiscoveryResource]:
    """Filter resources by x402 protocol version.

    Uses the x402Version field on the resource.

    Args:
        resources: Array of discovery resources
        allowed_versions: Array of allowed versions (default: [1, 2])

    Returns:
        Filtered array of resources matching the allowed versions

    """
    if allowed_versions is None:
        allowed_versions = [1, 2]

    filtered = []
    for resource in resources:
        version = resource.get("x402_version", resource.get("x402Version"))
        if version is None:
            # Include resources without version info
            filtered.append(resource)
        elif version in allowed_versions:
            filtered.append(resource)
    return filtered


def filter_by_keyword(
    resources: list[DiscoveryResource],
    keyword: str,
) -> list[DiscoveryResource]:
    """Filter resources by keyword appearing in description or URL.

    Case-insensitive search.
    Supports both v1 (accepts[].description) and v2 (metadata.description) formats.

    Args:
        resources: Array of discovery resources
        keyword: The keyword to search for in descriptions and URLs

    Returns:
        Filtered array of resources with matching descriptions or URLs

    """
    lower_keyword = keyword.lower()
    filtered = []
    for resource in resources:
        # Check description (version-aware)
        desc = _get_resource_description(resource).lower()
        if lower_keyword in desc:
            filtered.append(resource)
            continue

        # Also check the URL for keyword matches
        url = (resource.get("resource") or resource.get("url") or "").lower()
        if lower_keyword in url:
            filtered.append(resource)

    return filtered


def filter_by_max_price(
    resources: list[DiscoveryResource],
    max_usdc_price: float,
    wallet_provider: WalletProvider,
    wallet_networks: list[str],
) -> list[DiscoveryResource]:
    """Filter resources by maximum USDC price.

    Args:
        resources: Array of discovery resources
        max_usdc_price: Maximum price in whole USDC units
        wallet_provider: Wallet provider for asset identification
        wallet_networks: Array of network identifiers to match

    Returns:
        Filtered array of resources within price limit

    """
    filtered: list[DiscoveryResource] = []

    for resource in resources:
        accepts = resource.get("accepts", [])
        should_include = False

        for option in accepts:
            if option.get("network") not in wallet_networks:
                continue

            asset = option.get("asset")
            if not asset:
                continue

            # Check if this is a USDC asset
            if not is_usdc_asset(asset, wallet_provider):
                continue

            # Get the amount (supports both v1 maxAmountRequired and v2 amount/price)
            amount_str = (
                option.get("max_amount_required")
                or option.get("maxAmountRequired")
                or option.get("amount")
                or option.get("price")
            )
            if not amount_str:
                continue

            try:
                max_usdc_price_atomic = convert_whole_units_to_atomic(
                    max_usdc_price,
                    asset,
                    wallet_provider,
                )
                if max_usdc_price_atomic:
                    resource_amount = int(amount_str)
                    max_amount = int(max_usdc_price_atomic)
                    if resource_amount <= max_amount:
                        should_include = True
                        break
            except (ValueError, TypeError):
                # Skip if conversion fails
                continue

        if should_include:
            filtered.append(resource)

    return filtered


def format_simplified_resources(
    resources: list[DiscoveryResource],
    wallet_networks: list[str],
    wallet_provider: WalletProvider,
) -> list[SimplifiedResource]:
    """Format resources into simplified output for LLM consumption.

    Args:
        resources: Array of discovery resources
        wallet_networks: Array of network identifiers to match for price extraction
        wallet_provider: Wallet provider for formatting

    Returns:
        Array of simplified resources with url, price, description

    """
    simplified: list[SimplifiedResource] = []

    for resource in resources:
        accepts = resource.get("accepts", [])
        matching_option = None
        for opt in accepts:
            if opt.get("network") in wallet_networks:
                matching_option = opt
                break

        if not matching_option:
            continue

        # Extract URL: v1 and v2 both use resource.resource, but v2 docs show resource.url
        url = resource.get("resource") or resource.get("url") or ""

        # Extract description (version-aware via helper)
        description = _get_resource_description(resource)

        price = "Unknown"

        # Get the amount (supports both v1 and v2 formats)
        amount_str = (
            matching_option.get("max_amount_required")
            or matching_option.get("maxAmountRequired")
            or matching_option.get("amount")
            or matching_option.get("price")
        )
        asset = matching_option.get("asset")
        if amount_str and asset:
            price = format_payment_option(
                {
                    "asset": asset,
                    "max_amount_required": amount_str,
                    "network": matching_option.get("network", ""),
                },
                wallet_provider,
            )

        simplified.append(
            SimplifiedResource(
                url=url,
                price=price,
                description=description,
            )
        )

    return simplified


def handle_http_error(error: Exception, url: str) -> str:
    """Handle HTTP errors consistently.

    Args:
        error: The error to handle
        url: The URL that was being accessed when the error occurred

    Returns:
        A JSON string containing formatted error details

    """
    if hasattr(error, "response") and error.response is not None:
        response = error.response
        try:
            error_details = response.json()
        except Exception:
            error_details = {"error": str(error)}

        return json.dumps(
            {
                "error": True,
                "message": f"HTTP {response.status_code} error when accessing {url}",
                "details": error_details.get("error", str(error)),
                "suggestion": "Check if the URL is correct and the API is available.",
            },
            indent=2,
        )

    if hasattr(error, "request") and error.request is not None:
        return json.dumps(
            {
                "error": True,
                "message": f"Network error when accessing {url}",
                "details": str(error),
                "suggestion": "Check your internet connection and verify the API endpoint is accessible.",
            },
            indent=2,
        )

    return json.dumps(
        {
            "error": True,
            "message": f"Error making request to {url}",
            "details": str(error),
            "suggestion": "Please check the request parameters and try again.",
        },
        indent=2,
    )


def format_payment_option(
    option: dict[str, Any],
    wallet_provider: WalletProvider,
) -> str:
    """Format a payment option into a human-readable string.

    Args:
        option: The payment option to format with keys: asset, max_amount_required, network
        wallet_provider: The wallet provider for token details lookup

    Returns:
        A formatted string like "0.1 USDC on base"

    """
    from ...wallet_providers.evm_wallet_provider import EvmWalletProvider

    asset = option.get("asset", "")
    max_amount_required = option.get("max_amount_required", "0")
    network = option.get("network", "")

    # Check if this is an EVM network and we can use ERC20 helpers
    wallet_network = wallet_provider.get_network()
    is_evm_network = wallet_network.protocol_family == "evm"
    is_svm_network = wallet_network.protocol_family == "svm"

    if is_evm_network and isinstance(wallet_provider, EvmWalletProvider):
        network_id = wallet_network.network_id
        token_symbols = TOKEN_ADDRESSES_BY_SYMBOLS.get(network_id, {})

        if token_symbols:
            for symbol, address in token_symbols.items():
                if asset.lower() == address.lower():
                    decimals = 6 if symbol in ("USDC", "EURC") else 18
                    formatted_amount = _format_units(int(max_amount_required), decimals)
                    return f"{formatted_amount} {symbol} on {get_network_id(network)}"

        # Fall back to get_token_details for unknown tokens
        try:
            token_details = get_token_details(wallet_provider, asset)
            if token_details:
                formatted_amount = _format_units(int(max_amount_required), token_details.decimals)
                return f"{formatted_amount} {token_details.name} on {get_network_id(network)}"
        except Exception:
            # If we can't get token details, fall back to raw format
            pass

    if is_svm_network:
        # Check if the asset is USDC on Solana networks
        network_id = wallet_network.network_id
        usdc_address = SOLANA_USDC_ADDRESSES.get(network_id)

        if usdc_address and asset == usdc_address:
            # USDC has 6 decimals on Solana
            formatted_amount = _format_units(int(max_amount_required), 6)
            return f"{formatted_amount} USDC on {get_network_id(network)}"

    # Fallback to original format for non-EVM/SVM networks or when token details can't be fetched
    return f"{asset} {max_amount_required} on {get_network_id(network)}"


def is_usdc_asset(asset: str, wallet_provider: WalletProvider) -> bool:
    """Check if an asset is USDC on any supported network.

    Args:
        asset: The asset address or identifier
        wallet_provider: The wallet provider for network context

    Returns:
        True if the asset is USDC, False otherwise

    """
    from ...wallet_providers.evm_wallet_provider import EvmWalletProvider

    wallet_network = wallet_provider.get_network()
    is_evm_network = wallet_network.protocol_family == "evm"
    is_svm_network = wallet_network.protocol_family == "svm"

    if is_evm_network and isinstance(wallet_provider, EvmWalletProvider):
        network_id = wallet_network.network_id
        token_symbols = TOKEN_ADDRESSES_BY_SYMBOLS.get(network_id, {})

        usdc_address = token_symbols.get("USDC")
        if usdc_address:
            return asset.lower() == usdc_address.lower()

    if is_svm_network:
        network_id = wallet_network.network_id
        usdc_address = SOLANA_USDC_ADDRESSES.get(network_id)

        if usdc_address:
            return asset == usdc_address

    return False


def convert_whole_units_to_atomic(
    whole_units: float,
    asset: str,
    wallet_provider: WalletProvider,
) -> str | None:
    """Convert whole units to atomic units for a given asset.

    Args:
        whole_units: The amount in whole units (e.g., 0.1 for 0.1 USDC)
        asset: The asset address or identifier
        wallet_provider: The wallet provider for token details lookup

    Returns:
        The amount in atomic units as a string, or None if conversion fails

    """
    from ...wallet_providers.evm_wallet_provider import EvmWalletProvider

    # Check if this is an EVM network and we can use ERC20 helpers
    wallet_network = wallet_provider.get_network()
    is_evm_network = wallet_network.protocol_family == "evm"
    is_svm_network = wallet_network.protocol_family == "svm"

    if is_evm_network and isinstance(wallet_provider, EvmWalletProvider):
        network_id = wallet_network.network_id
        token_symbols = TOKEN_ADDRESSES_BY_SYMBOLS.get(network_id, {})

        if token_symbols:
            for symbol, address in token_symbols.items():
                if asset.lower() == address.lower():
                    decimals = 6 if symbol in ("USDC", "EURC") else 18
                    return _parse_units(whole_units, decimals)

        # Fall back to get_token_details for unknown tokens
        try:
            token_details = get_token_details(wallet_provider, asset)
            if token_details:
                return _parse_units(whole_units, token_details.decimals)
        except Exception:
            # If we can't get token details, fall back to assuming 18 decimals
            pass

    if is_svm_network:
        # Check if the asset is USDC on Solana networks
        network_id = wallet_network.network_id
        usdc_address = SOLANA_USDC_ADDRESSES.get(network_id)

        if usdc_address and asset == usdc_address:
            # USDC has 6 decimals on Solana
            return _parse_units(whole_units, 6)

    # Fallback to 18 decimals for unknown tokens or non-EVM/SVM networks
    return _parse_units(whole_units, 18)


def build_url_with_params(
    base_url: str,
    query_params: dict[str, str] | None = None,
) -> str:
    """Build a URL with query parameters appended.

    Args:
        base_url: The base URL
        query_params: Optional query parameters to append

    Returns:
        URL string with query parameters

    """
    if not query_params:
        return base_url

    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{urlencode(query_params)}"


def is_service_registered(url: str, registered_services: set[str]) -> bool:
    """Check if a URL is registered for x402 requests.

    Matches by origin (protocol + hostname + port) or by same-origin path prefix.

    Does **not** use raw ``url.startswith(registered)`` — that allows hostname-suffix
    and other prefix bypasses (e.g. ``https://good.com.evil.com`` vs ``https://good.com``).

    Args:
        url: The URL to check
        registered_services: Set of registered service URLs or origins

    Returns:
        True if the service is registered, False otherwise

    """
    if not registered_services:
        return False

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        origin = f"{parsed.scheme}://{parsed.netloc}"

        for registered in registered_services:
            # Bare origin registration: "https://api.example.com"
            if origin == registered:
                return True

            reg = urlparse(registered)
            if not reg.scheme or not reg.netloc:
                continue

            reg_origin = f"{reg.scheme}://{reg.netloc}"
            if origin != reg_origin:
                continue

            # Origin-only URL form ("https://api.example.com/") → any path on that origin
            reg_path = reg.path or "/"
            if reg_path == "/" and not reg.query and not reg.fragment:
                return True

            # Same-origin path match or segment-boundary prefix
            req_path = parsed.path or "/"
            reg_prefix = reg_path if reg_path.endswith("/") else f"{reg_path}/"
            if req_path == reg_path or req_path.startswith(reg_prefix):
                return True

        return False
    except Exception:
        return False


def is_url_allowed(url: str, registered_services: set[str]) -> bool:
    """Check if a URL is allowed for x402 requests.

    Args:
        url: The URL to check
        registered_services: Set of registered service URLs

    Returns:
        True if registered, False otherwise

    """
    return is_service_registered(url, registered_services)


def filter_usdc_payment_options(
    accepts: list[dict[str, Any]],
    wallet_provider: WalletProvider,
) -> list[dict[str, Any]]:
    """Filter payment options to only include USDC payments.

    Args:
        accepts: Array of payment options
        wallet_provider: Wallet provider for USDC address lookup

    Returns:
        Array of USDC-only payment options

    """
    return [opt for opt in accepts if is_usdc_asset(opt.get("asset", ""), wallet_provider)]


def validate_payment_limit(
    amount_atomic: str,
    max_payment_usdc: float,
) -> dict[str, Any]:
    """Validate that a payment amount is within the configured limit.

    Args:
        amount_atomic: The payment amount in atomic units (e.g., 6 decimals for USDC)
        max_payment_usdc: Maximum payment in USDC whole units

    Returns:
        Object with is_valid flag and formatted amounts for error messages

    """
    usdc_decimals = 6
    max_amount_atomic = int(max_payment_usdc * (10**usdc_decimals))
    requested = int(amount_atomic)

    return {
        "is_valid": requested <= max_amount_atomic,
        "requested_amount": _format_units(requested, usdc_decimals),
        "max_amount": str(max_payment_usdc),
    }


def validate_facilitator(
    facilitator: str,
    registered_facilitators: dict[str, str],
) -> dict[str, Any]:
    """Check if a facilitator is allowed (known name or registered name).

    Args:
        facilitator: The facilitator name to check
        registered_facilitators: Map of registered custom facilitator names to URLs

    Returns:
        Object with is_allowed flag and resolved URL

    """
    # Check if it's a known facilitator name (CDP, PayAI)
    if facilitator in KNOWN_FACILITATORS:
        return {
            "is_allowed": True,
            "resolved_url": KNOWN_FACILITATORS[facilitator],
        }

    # Check if it's a registered custom facilitator name
    if facilitator in registered_facilitators:
        return {
            "is_allowed": True,
            "resolved_url": registered_facilitators[facilitator],
        }

    return {"is_allowed": False, "resolved_url": facilitator}


def _format_units(value: int, decimals: int) -> str:
    """Format atomic units to human-readable decimal string.

    Args:
        value: The value in atomic units
        decimals: Number of decimal places

    Returns:
        Formatted decimal string

    """
    if decimals == 0:
        return str(value)

    divisor = 10**decimals
    whole = value // divisor
    remainder = value % divisor

    if remainder == 0:
        return str(whole)

    # Format remainder with leading zeros
    remainder_str = str(remainder).zfill(decimals).rstrip("0")
    return f"{whole}.{remainder_str}"


def _parse_units(value: float, decimals: int) -> str:
    """Parse human-readable decimal to atomic units string.

    Args:
        value: The value in whole units
        decimals: Number of decimal places

    Returns:
        Atomic units as string

    """
    multiplier = 10**decimals
    return str(int(value * multiplier))
