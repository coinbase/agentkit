# Allora Action Provider

This action provider enables interaction with the Allora Network, allowing AI agents to fetch topics and inferences.

## Setup

To use the Allora action provider, you'll need an API key from Allora Network. Initialize the provider like this:

```typescript
import { createAlloraActionProvider } from "@coinbase/agentkit";

const provider = createAlloraActionProvider({
  apiKey: "your-api-key",
  chainSlug: "testnet" // optional, defaults to testnet
});
```

## Available Actions

### Get All Topics

Fetches all available topics from Allora Network. Each topic represents a prediction market.

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
```typescript
const result = await provider.getInferenceByTopicId({ topicId: 1 });
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
```typescript
import { PriceInferenceToken } from "@alloralabs/allora-sdk";

const result = await provider.getPriceInference({
  asset: PriceInferenceToken.BTC,
  timeframe: "8h"
});
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