"""Configuration preparation for the action provider generator script."""

from .prompts import (
    prompt_for_name,
    prompt_for_overwrite,
    prompt_for_protocol_family,
    prompt_for_wallet_provider,
    should_prompt_for_wallet_provider,
)
from .types import NetworkId, ProtocolFamily, ProviderConfig, WalletProvider
from .utils import provider_exists, validate_name


def prepare_provider_config(
    name: str | None,
    protocol_family: ProtocolFamily | None,
    networks: list[NetworkId] | None,
    wallet_provider: WalletProvider | None,
    interactive: bool = False,
) -> ProviderConfig:
    """Prepare provider configuration from CLI args with interactive prompt fallbacks.

    Args:
        name: Provider name from CLI args
        protocol_family: Protocol family from CLI args
        networks: Network IDs from CLI args
        wallet_provider: Wallet provider from CLI args
        interactive: Whether to prompt for missing values. Defaults to True if no args provided.

    Returns:
        ProviderConfig: The complete provider configuration

    Raises:
        ValueError: If required fields are missing or invalid

    """
    if not any([name, protocol_family, networks, wallet_provider]):
        interactive = True

    # always get a valid name first
    resolved_name = name
    if not resolved_name or not validate_name(resolved_name):
        resolved_name = prompt_for_name()

    # check if provider exists and prompt for overwrite
    should_overwrite = False
    if provider_exists(resolved_name):
        should_overwrite = prompt_for_overwrite(resolved_name)
        if not should_overwrite:
            raise ValueError("Action provider creation cancelled - provider already exists")

    # start with provided values
    config = ProviderConfig(
        name=resolved_name,
        protocol_family=protocol_family or None,
        network_ids=networks or [],
        wallet_provider=wallet_provider,
    )

    # set default wallet providers by protocol
    if not config.wallet_provider and config.protocol_family == "evm":
        config.wallet_provider = "EvmWalletProvider"

    if not interactive:
        return config

    # handle missing values
    if not config.protocol_family:
        config.protocol_family = prompt_for_protocol_family()

    # handle wallet provider in interactive mode
    if not config.wallet_provider and config.protocol_family != "none":
        if config.protocol_family != "all" and should_prompt_for_wallet_provider():
            config.wallet_provider = prompt_for_wallet_provider(config.protocol_family)
        elif config.protocol_family == "evm":
            config.wallet_provider = "EvmWalletProvider"
        else:
            config.wallet_provider = "WalletProvider"

    # convert special values to None
    if config.protocol_family in ("all", "none"):
        config.protocol_family = None

    # set provider key
    if config.wallet_provider:
        config.provider_key = "wallet_provider"

    return config
