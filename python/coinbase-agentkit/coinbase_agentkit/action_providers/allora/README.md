# Allora Action Provider

This directory contains the **AlloraActionProvider** implementation, which enables interaction with the **Allora Network**, allowing AI agents to fetch topics and inferences for prediction markets.

## Directory Structure

```
allora/
├── allora_action_provider.py     # Main provider with Allora functionality
├── schemas.py                    # Pydantic schemas for action inputs
├── __init__.py                   # Package exports
└── README.md                     # This file

# From python/coinbase-agentkit/
tests/action_providers/allora/
├── conftest.py                   # Test fixtures
├── test_allora_action_provider.py # Tests for Allora provider
```

## Actions

- `get_all_topics`: Fetches all available topics from Allora Network
- `get_inference_by_topic_id`: Fetches inference data for a specific topic
- `get_price_inference`: Fetches price inference for a specific token and timeframe

## Setup

To use the Allora action provider:

```python
from coinbase_agentkit.action_providers.allora import allora_action_provider

# With default configuration
provider = allora_action_provider()

# Or with custom configuration
provider_with_config = allora_action_provider(
    api_key="your-api-key",  # optional, defaults to a public, development-only key
    chain_slug="testnet"  # optional, defaults to testnet
)
```

## Action Details

### Get All Topics

Fetches all available topics from Allora Network. Each topic represents a prediction market.

Example usage:
```python
result = provider.get_all_topics({})
```

Example response:
```json
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
```

### Get Inference By Topic ID

Fetches inference data for a specific topic. Requires a topic ID which can be obtained from the get_all_topics action.

Example usage:
```python
result = provider.get_inference_by_topic_id({"topic_id": 1})
```

Example response:
```json
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
```

### Get Price Inference

Fetches price inference for a specific token and timeframe. Requires a token symbol from the supported list and a timeframe.

Example usage:
```python
from allora_sdk.v2.api_client import PriceInferenceToken, PriceInferenceTimeframe

result = provider.get_price_inference({
    "asset": PriceInferenceToken.BTC,
    "timeframe": PriceInferenceTimeframe.EIGHT_HOURS
})
```

Example response:
```json
{
  "price": "50000.00",
  "timestamp": 1718198400,
  "asset": "BTC",
  "timeframe": "8h"
}
```

## Adding New Actions

To add new Allora actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `allora_action_provider.py`
3. Add tests in `tests/action_providers/allora/test_allora_action_provider.py`

## Network Support

The Allora provider is network-agnostic.

## Notes

For more information about Allora Network and its capabilities, visit [Allora Documentation](https://docs.allora.network/). 
