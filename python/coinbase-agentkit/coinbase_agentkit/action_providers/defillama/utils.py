"""Utility functions for DefiLlama action provider."""

from typing import Any


def prune_get_protocol_response(
    data: dict[str, Any] | None, max_entries: int = 5
) -> dict[str, Any] | None:
    """Prunes the protocol response by limiting time-series data arrays.

    Args:
        data: The raw protocol dictionary from DefiLlama API.
        max_entries: Maximum number of historical time-series entries to keep.

    Returns:
        Pruned dictionary with manageable payload size.
    """
    if not data or not isinstance(data, dict):
        return data

    result = dict(data)
    time_series_keys = {"tvl", "tokens", "tokensInUsd"}

    def process_time_series_list(arr: list[Any]) -> list[Any]:
        if len(arr) <= max_entries:
            return arr
        if arr and isinstance(arr[0], dict) and "date" in arr[0]:
            try:
                sorted_arr = sorted(
                    arr,
                    key=lambda x: x.get("date", 0) if isinstance(x, dict) else 0,
                    reverse=True,
                )
                return sorted_arr[:max_entries]
            except Exception:
                pass
        return arr[-max_entries:]

    for key in time_series_keys:
        if key in result and isinstance(result[key], list):
            result[key] = process_time_series_list(result[key])

    if "chainTvls" in result and isinstance(result["chainTvls"], dict):
        for chain, chain_data in result["chainTvls"].items():
            if isinstance(chain_data, dict):
                for ts_key in time_series_keys:
                    if ts_key in chain_data and isinstance(chain_data[ts_key], list):
                        chain_data[ts_key] = process_time_series_list(chain_data[ts_key])

    return result
