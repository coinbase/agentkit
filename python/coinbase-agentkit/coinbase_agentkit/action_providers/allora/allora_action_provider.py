"""Allora Network action provider."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from allora_sdk.v2.api_client import (
    AlloraAPIClient,
    ChainSlug,
    PriceInferenceTimeframe,
    PriceInferenceToken,
)

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetAllTopicsInput, GetInferenceByTopicIdInput, GetPriceInferenceInput


def _convert_to_dict(obj: Any) -> dict[str, Any]:
    """Convert an object to a dictionary.

    This is needed because the Allora SDK returns objects that are not directly JSON serializable.

    Args:
        obj: The object to convert

    Returns:
        A dictionary representation of the object

    """
    if hasattr(obj, "__dict__"):
        return {k: _convert_to_dict(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    elif isinstance(obj, list):
        return [_convert_to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: _convert_to_dict(v) for k, v in obj.items()}
    else:
        return obj


class AlloraActionProvider(ActionProvider[WalletProvider]):
    """Action provider for interacting with Allora Network."""

    def __init__(
        self,
        api_key: str | None = None,
        chain_slug: ChainSlug | None = None,
    ):
        """Initialize the Allora action provider.

        Args:
            api_key: API key for Allora Network
            chain_slug: Chain slug to use (testnet or mainnet)

        """
        super().__init__("allora", [])

        # This is a public, development only key and should be used for testing purposes only.
        # It might be changed or revoked in the future. It is also subject to limits and usage policies.
        default_api_key = "UP-4151d0cc489a44a7aa5cd7ef"

        self.client = AlloraAPIClient(
            api_key=api_key or default_api_key,
            chain_slug=chain_slug or ChainSlug.TESTNET,
        )
        # Create a thread pool executor for running async code
        self._executor = ThreadPoolExecutor(max_workers=5)

    def _run_async(self, coro):
        """Run an async coroutine in a synchronous context.

        Args:
            coro: The coroutine to run

        Returns:
            The result of the coroutine

        """
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    @create_action(
        name="get_all_topics",
        description="""
This tool will get all available inference topics from Allora Network.

A successful response will return a list of available topics in JSON format. Example:
[
    {
        "topic_id": 1,
        "topic_name": "Bitcoin 8h",
        "description": "Bitcoin price prediction for the next 8 hours",
        "epoch_length": 100,
        "ground_truth_lag": 10,
        "loss_method": "method1",
        "worker_submission_window": 50,
        "worker_count": 5,
        "reputer_count": 3,
        "total_staked_allo": 1000,
        "total_emissions_allo": 500,
        "is_active": true,
        "updated_at": "2023-01-01T00:00:00Z"
    }
]

Key fields:
- topic_id: Unique identifier, use with get_inference_by_topic_id action
- topic_name: Name of the topic
- description: Short description of the topic's purpose
- is_active: If true, topic is active and accepting submissions
- updated_at: Timestamp of last update

A failure response will return an error message with details.
        """,
        schema=GetAllTopicsInput,
    )
    def get_all_topics(self, args: dict[str, Any]) -> str:
        """Get all available topics from Allora Network."""
        try:
            topics = self._run_async(self.client.get_all_topics())
            # Convert the topics to dictionaries before serializing
            topics_dict = [_convert_to_dict(topic) for topic in topics]
            topics_json = json.dumps(topics_dict)
            return f"The available topics at Allora Network are:\n {topics_json}"
        except Exception as e:
            return f"Error getting all topics: {e}"

    @create_action(
        name="get_inference_by_topic_id",
        description="""
This tool will get inference for a specific topic from Allora Network.
It requires a topic ID as input, which can be obtained from the get_all_topics action.

A successful response will return a message with the inference data in JSON format. Example:
    {
        "network_inference": "0.5",
        "network_inference_normalized": "0.5",
        "confidence_interval_percentiles": ["0.1", "0.5", "0.9"],
        "confidence_interval_percentiles_normalized": ["0.1", "0.5", "0.9"],
        "confidence_interval_values": ["0.1", "0.5", "0.9"],
        "confidence_interval_values_normalized": ["0.1", "0.5", "0.9"],
        "topic_id": "1",
        "timestamp": 1718198400,
        "extra_data": "extra_data"
    }
The network_inference field is the inference for the topic.
The network_inference_normalized field is the normalized inference for the topic.

A failure response will return an error message with details.
        """,
        schema=GetInferenceByTopicIdInput,
    )
    def get_inference_by_topic_id(self, args: dict[str, Any]) -> str:
        """Get inference data for a specific topic."""
        try:
            inference = self._run_async(self.client.get_inference_by_topic_id(args["topic_id"]))
            # Convert the inference data to a dictionary before serializing
            inference_dict = _convert_to_dict(inference.inference_data)
            inference_json = json.dumps(inference_dict)
            return f"The inference for topic {args['topic_id']} is:\n {inference_json}"
        except Exception as e:
            return f"Error getting inference for topic {args['topic_id']}: {e}"

    @create_action(
        name="get_price_inference",
        description="""
This tool will get price inference for a specific token and timeframe from Allora Network.
It requires an asset symbol (e.g., 'BTC', 'ETH') and a timeframe (e.g., '5m', '8h') as input.

Supported timeframes:
- Minutes: 5m
- Hours: 8h

A successful response will return a message with the price inference. Example:
    The price inference for BTC (8h) is:
    {
        "price": "100000",
        "timestamp": 1718198400,
        "asset": "BTC",
        "timeframe": "8h"
    }

A failure response will return an error message with details.
        """,
        schema=GetPriceInferenceInput,
    )
    def get_price_inference(self, args: dict[str, Any]) -> str:
        """Get price inference for a token/timeframe pair."""
        try:
            # Get the input values
            asset = args["asset"]
            timeframe = args["timeframe"]

            # Convert asset string to enum if it's a string
            if isinstance(asset, str):
                try:
                    # Try to get the enum value directly by name
                    asset = getattr(PriceInferenceToken, asset.upper())
                except (AttributeError, ValueError):
                    # Fail explicitly if the asset can't be converted to a valid enum
                    return f"Error: '{asset}' is not a valid asset. Valid assets are: {', '.join([e.name for e in PriceInferenceToken])}"
            elif not isinstance(asset, PriceInferenceToken):
                # Fail if the asset is not a string or PriceInferenceToken
                return f"Error: Asset must be a string or PriceInferenceToken enum, got {type(asset).__name__}"

            # Convert timeframe string to enum if it's a string
            if isinstance(timeframe, str):
                try:
                    # Map common timeframe formats to enum names
                    timeframe_name_map = {
                        "5m": "FIVE_MIN",
                        "8h": "EIGHT_HOURS",
                    }
                    enum_name = timeframe_name_map.get(timeframe.lower(), timeframe.upper())
                    timeframe = getattr(PriceInferenceTimeframe, enum_name)
                except (AttributeError, ValueError):
                    # Fail explicitly if the timeframe can't be converted to a valid enum
                    valid_timeframes = [f"{tf.value} ({tf.name})" for tf in PriceInferenceTimeframe]
                    return f"Error: '{timeframe}' is not a valid timeframe. Valid timeframes are: {', '.join(valid_timeframes)}"
            elif not isinstance(timeframe, PriceInferenceTimeframe):
                # Fail if the timeframe is not a string or PriceInferenceTimeframe
                return f"Error: Timeframe must be a string or PriceInferenceTimeframe enum, got {type(timeframe).__name__}"

            inference = self._run_async(
                self.client.get_price_inference(
                    asset,
                    timeframe,
                )
            )
            # Convert the inference data to a dictionary before accessing its fields
            inference_dict = _convert_to_dict(inference.inference_data)

            # Get the string values from the enums
            asset_value = asset.value
            timeframe_value = timeframe.value

            response = {
                "price": inference_dict.get("network_inference_normalized", "0"),
                "timestamp": inference_dict.get("timestamp", 0),
                "asset": asset_value,
                "timeframe": timeframe_value,
            }
            inference_json = json.dumps(response)
            return (
                f"The price inference for {asset_value} ({timeframe_value}) is:\n{inference_json}"
            )
        except Exception as e:
            # Use the enum values in error messages
            try:
                asset_value = asset.value if hasattr(asset, "value") else str(asset)
                timeframe_value = timeframe.value if hasattr(timeframe, "value") else str(timeframe)
                return f"Error getting price inference for {asset_value} ({timeframe_value}): {e}"
            except Exception:
                # Fallback if we can't access the values
                return f"Error getting price inference: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if the provider supports a given network.

        Returns:
            bool: Always returns True as Allora service is network-agnostic

        """
        return True  # Allora service is network-agnostic


def allora_action_provider(
    api_key: str | None = None, chain_slug: ChainSlug | None = None
) -> AlloraActionProvider:
    """Create a new Allora action provider.

    Returns:
        AlloraActionProvider: A new Allora action provider instance.

    """
    return AlloraActionProvider(api_key=api_key, chain_slug=chain_slug)
