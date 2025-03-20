# Allora Action Provider Tests

This directory contains tests for the Allora action provider, which allows interaction with the Allora Network API.

## Test Types

There are two types of tests:

1. **Unit Tests**: These tests use mocks to test the functionality of the Allora action provider without making actual API calls.
2. **Integration Tests**: These tests make actual API calls to the Allora Network API and require an internet connection.

## Running Tests

### Prerequisites

Make sure you have Poetry installed and have installed the project dependencies:

```bash
# Navigate to the project root
cd python/coinbase-agentkit

# Install dependencies with Poetry
poetry install
```

The tests automatically add the project root to the Python path, so you don't need to do any special setup beyond installing the dependencies.

### Running Unit Tests

To run the unit tests:

```bash
# Using Poetry
poetry run pytest tests/action_providers/allora/test_allora_action_provider.py -v

# Or using the Makefile (which uses Poetry internally)
make test
```

### Running Integration Tests

Integration tests are automatically skipped when running `make test` or when running pytest without specific flags. This ensures that integration tests don't run accidentally.

To run the integration tests, you must explicitly request them using the `-m integration` flag:

```bash
# Using the Makefile
make test-integration

# Or directly with Poetry
poetry run pytest -m integration tests/action_providers/allora/test_allora_integration.py -v
```

## Configuration (Optional)

By default, the integration tests use the default development API key and testnet configuration provided in the `AlloraActionProvider` class. You don't need to set any environment variables to run the tests.

If you want to use custom values, you can set the following environment variables:

- `ALLORA_API_KEY`: Custom API key for Allora Network
- `ALLORA_CHAIN_SLUG`: Chain slug to use (`testnet` or `mainnet`)

Example with custom values:

```bash
# Using the Makefile
ALLORA_API_KEY=your-api-key ALLORA_CHAIN_SLUG=testnet make test-integration

# Or directly with Poetry
ALLORA_API_KEY=your-api-key ALLORA_CHAIN_SLUG=testnet poetry run pytest -m integration tests/action_providers/allora/test_allora_integration.py -v
```

## Test Structure

- `test_allora_action_provider.py`: Unit tests for the Allora action provider.
- `test_allora_integration.py`: Integration tests for the Allora action provider.
- `conftest.py`: Fixtures for both unit tests and integration tests.

## Adding New Tests

When adding new tests, follow these guidelines:

1. For unit tests, use the `provider` fixture from `conftest.py` to get a mocked Allora action provider.
2. For integration tests, use the `integration_provider` fixture from `conftest.py` to get a real Allora action provider.
3. Mark integration tests with the `@pytest.mark.integration` decorator.
4. For integration tests, handle potential API errors gracefully and add appropriate assertions to verify the response structure.

### Input Parameters

The Allora action provider requires enum values for the `asset` and `timeframe` parameters when calling the Allora SDK. The provider will attempt to convert string inputs to the appropriate enum values:

- **asset**: Must be a valid `PriceInferenceToken` enum value. Currently supported: `BTC`, `ETH`
- **timeframe**: Must be a valid `PriceInferenceTimeframe` enum value. Currently supported: `5m`, `8h`

If a string input cannot be converted to a valid enum value, the provider will return a clear error message listing the supported values. This ensures that only valid inputs are passed to the Allora SDK.

Example error messages:
- `Error: 'SOL' is not a valid asset. Valid assets are: BTC, ETH`
- `Error: '24h' is not a valid timeframe. Valid timeframes are: 5m (FIVE_MIN), 8h (EIGHT_HOURS)`

## Notes

- The integration tests may fail if the Allora Network API is down.
- The integration tests may take longer to run than the unit tests due to network latency.
- The default development API key provided in the AlloraActionProvider class is subject to rate limits.
