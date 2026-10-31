"""Utility helpers for the Spraay action provider."""


def parse_units(value: str, decimals: int) -> int:
    """Convert a human-readable number string to an integer with the given decimals.

    Args:
        value: The human-readable amount (e.g. "0.01").
        decimals: The token decimals.

    Returns:
        int: The amount in atomic units.

    """
    parts = value.split(".")
    if len(parts) == 1:
        return int(parts[0]) * (10**decimals)
    integer_part = parts[0]
    decimal_part = parts[1][:decimals].ljust(decimals, "0")
    return int(integer_part) * (10**decimals) + int(decimal_part)


def format_units(value: int, decimals: int) -> str:
    """Convert an atomic-unit integer back to a human-readable string.

    Args:
        value: The amount in atomic units.
        decimals: The token decimals.

    Returns:
        str: The human-readable amount.

    """
    whole = value // (10**decimals)
    fraction = value % (10**decimals)
    if fraction == 0:
        return str(whole)
    frac_str = str(fraction).zfill(decimals).rstrip("0")
    return f"{whole}.{frac_str}"


def split_signature(signature: str) -> tuple[str, str, int]:
    """Split a 65-byte hex signature into its r, s, v components.

    Args:
        signature: The 0x-prefixed 65-byte signature.

    Returns:
        tuple[str, str, int]: The r, s, and v components.

    """
    sig = signature[2:] if signature.startswith("0x") else signature
    r = "0x" + sig[0:64]
    s = "0x" + sig[64:128]
    v = int(sig[128:130], 16)
    if v < 27:
        v += 27
    return r, s, v
