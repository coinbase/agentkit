"""Helper functions for DESK action provider."""


def format_number(num: float, precision: int = 2) -> str:
    """Format numbers to precision."""
    return f"{float(num):.{precision}f}"
