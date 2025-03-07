"""Integration tests for Allora action provider.

These tests interact with the actual Allora API and require an internet connection.
By default, they use the development API key provided in the AlloraActionProvider class.

IMPORTANT: These tests should ONLY be run explicitly using the integration marker:
pytest -m integration tests/action_providers/allora/test_allora_integration.py -v

Optional configuration via environment variables:
- ALLORA_API_KEY: Custom API key for Allora Network
- ALLORA_CHAIN_SLUG: Chain slug to use (testnet or mainnet)
"""

import json

import pytest

from coinbase_agentkit.network import Network

# The fixtures are imported from conftest.py

# Mark the entire module as integration tests
pytestmark = pytest.mark.integration


def test_get_all_topics_integration(integration_provider):
    """Test getting all topics from the Allora API."""
    result = integration_provider.get_all_topics({})

    # Check that the response contains the expected text
    assert (
        "The available topics at Allora Network are:" in result
        or "Error getting all topics:" in result
    )

    # If there's an error, we can't test further
    if "Error getting all topics:" in result:
        pytest.skip(f"Skipping due to API error: {result}")

    # Extract the JSON part from the response
    json_start = result.find("[")
    json_end = result.rfind("]") + 1
    topics_json = result[json_start:json_end]

    # Parse the JSON and check that it's a list
    topics = json.loads(topics_json)
    assert isinstance(topics, list)

    # If there are topics, check that they have the expected structure
    if topics:
        topic = topics[0]
        assert "topic_id" in topic
        assert "topic_name" in topic
        assert "description" in topic
        assert "is_active" in topic


def test_get_inference_by_topic_id_integration(integration_provider):
    """Test getting inference by topic ID from the Allora API."""
    # First, get all topics to find a valid topic ID
    all_topics_result = integration_provider.get_all_topics({})

    # If there's an error, we can't test further
    if "Error getting all topics:" in all_topics_result:
        pytest.skip(f"Skipping due to API error: {all_topics_result}")

    # Extract the JSON part from the response
    json_start = all_topics_result.find("[")
    json_end = all_topics_result.rfind("]") + 1
    topics_json = all_topics_result[json_start:json_end]

    # Parse the JSON and check that it's a list
    topics = json.loads(topics_json)

    # Skip the test if there are no topics
    if not topics:
        pytest.skip("No topics available for testing")

    # Use the first active topic for testing
    active_topics = [t for t in topics if t.get("is_active", False)]
    if not active_topics:
        pytest.skip("No active topics available for testing")

    topic_id = active_topics[0]["topic_id"]

    # Now test getting inference for this topic
    result = integration_provider.get_inference_by_topic_id({"topic_id": topic_id})

    # Check that the response contains the expected text
    assert (
        f"The inference for topic {topic_id} is:" in result
        or f"Error getting inference for topic {topic_id}:" in result
    )

    # If there's an error, we can't test further
    if f"Error getting inference for topic {topic_id}:" in result:
        pytest.skip(f"Skipping due to API error: {result}")

    # Extract the JSON part from the response
    json_start = result.find("{")
    json_end = result.rfind("}") + 1
    inference_json = result[json_start:json_end]

    # Parse the JSON and check that it has the expected structure
    inference = json.loads(inference_json)
    assert "topic_id" in inference
    assert "timestamp" in inference
    # One of these should be present
    assert "network_inference" in inference or "network_inference_normalized" in inference


def test_get_price_inference_btc_integration(integration_provider):
    """Test getting price inference for BTC from the Allora API."""
    # Test with BTC and 8h timeframe using string values
    asset = "BTC"
    timeframe = "8h"

    result = integration_provider.get_price_inference(
        {
            "asset": asset,
            "timeframe": timeframe,
        }
    )

    print(f"Result: {result}")

    # Check that the response contains the expected text or an error
    expected_text = f"The price inference for {asset} ({timeframe}) is:"
    assert expected_text in result or f"Error getting price inference for {asset}" in result

    # If there's an error, skip the test
    if f"Error getting price inference for {asset}" in result:
        pytest.skip(f"Skipping due to API error: {result}")

    # Extract the JSON part from the response
    json_start = result.find("{")
    json_end = result.rfind("}") + 1
    inference_json = result[json_start:json_end]

    # Parse the JSON and check that it has the expected structure
    inference = json.loads(inference_json)
    assert "price" in inference
    assert "timestamp" in inference
    assert "asset" in inference
    assert "timeframe" in inference
    assert inference["asset"] == asset
    assert inference["timeframe"] == timeframe

    # Check that the price is a valid number
    price = float(inference["price"])
    assert price > 0


def test_get_price_inference_eth_integration(integration_provider):
    """Test getting price inference for ETH from the Allora API."""
    # Test with ETH and 8h timeframe using string values
    asset = "ETH"
    timeframe = "8h"

    result = integration_provider.get_price_inference(
        {
            "asset": asset,
            "timeframe": timeframe,
        }
    )

    # Check that the response contains the expected text or an error
    expected_text = f"The price inference for {asset} ({timeframe}) is:"
    assert expected_text in result or f"Error getting price inference for {asset}" in result

    # If there's an error, we can't test further
    if f"Error getting price inference for {asset}" in result:
        pytest.skip(f"Skipping due to API error: {result}")

    # Extract the JSON part from the response
    json_start = result.find("{")
    json_end = result.rfind("}") + 1
    inference_json = result[json_start:json_end]

    # Parse the JSON and check that it has the expected structure
    inference = json.loads(inference_json)
    assert "price" in inference
    assert "timestamp" in inference
    assert "asset" in inference
    assert "timeframe" in inference
    assert inference["asset"] == asset
    assert inference["timeframe"] == timeframe

    # Check that the price is a valid number
    price = float(inference["price"])
    assert price > 0


def test_error_handling_invalid_topic_id(integration_provider):
    """Test error handling when an invalid topic ID is provided."""
    # Use a very large topic ID that is unlikely to exist
    invalid_topic_id = 999999999

    result = integration_provider.get_inference_by_topic_id({"topic_id": invalid_topic_id})

    # Check that the response contains an error message
    assert f"Error getting inference for topic {invalid_topic_id}:" in result


def test_supports_network(integration_provider):
    """Test that the provider supports all networks."""
    # Create Network instances instead of using enum values
    ethereum = Network(protocol_family="ethereum", network_id="ethereum-mainnet", chain_id="1")
    polygon = Network(protocol_family="ethereum", network_id="polygon-mainnet", chain_id="137")
    solana = Network(protocol_family="solana")
    bitcoin = Network(protocol_family="bitcoin")

    # Test with different networks
    assert integration_provider.supports_network(ethereum)
    assert integration_provider.supports_network(polygon)
    assert integration_provider.supports_network(solana)
    # The provider should support all networks as it's network-agnostic
    assert integration_provider.supports_network(bitcoin)


def test_get_price_inference_unsupported_values(integration_provider):
    """Test getting price inference with unsupported values."""
    # Test with SOL and 24h timeframe, which are not supported
    asset = "SOL"
    timeframe = "24h"

    result = integration_provider.get_price_inference(
        {
            "asset": asset,
            "timeframe": timeframe,
        }
    )

    # Check that the response contains an error message
    assert "Error:" in result

    # Check that the error message mentions SOL is not a valid asset
    assert f"'{asset}' is not a valid asset" in result
    assert "BTC" in result  # Should mention valid assets
    assert "ETH" in result  # Should mention valid assets

    # Test with BTC and 24h timeframe
    asset = "BTC"
    timeframe = "24h"

    result = integration_provider.get_price_inference(
        {
            "asset": asset,
            "timeframe": timeframe,
        }
    )

    # Check that the response contains an error message
    assert "Error:" in result

    # Check that the error message mentions 24h is not a valid timeframe
    assert f"'{timeframe}' is not a valid timeframe" in result
    assert "5m" in result  # Should mention valid timeframes
    assert "8h" in result  # Should mention valid timeframes
