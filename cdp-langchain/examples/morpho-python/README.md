# CDP Agentkit Langchain Extension Examples - Morpho Markets Agent

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP Agentkit actions for Morpho Markets interactions.

## Two Available Flow Options:

### 1. Morpho Market Flow (morpho_market_flow.py)
This script provides an automated, sequential flow that:
- Executes all Morpho operations in a predefined order
- Runs through the complete lifecycle of a position
- Ideal for testing or demonstrating the full Morpho lending/borrowing cycle
- No manual operation selection needed
- Operations execute in this fixed sequence:
  1. Supply collateral (cbBTC)
  2. Borrow (USDC)
  3. Repay loan
  4. Withdraw collateral

### 2. Specific Action Flow (specific_action_flow.py)
This script offers a more flexible, interactive approach:
- Allows manual selection of individual operations
- Users can choose which operation to execute and when
- Supports multiple execution paths based on user needs
- Available operations:
  - Supply Collateral (cbBTC)
  - Borrow (USDC)
  - Repay
  - Withdraw Collateral
- Ideal for testing specific operations or managing positions manually

## Available Morpho Actions
- `morpho_supply_collateral`
- `morpho_borrow`
- `morpho_repay`
- `morpho_withdraw_collateral`

## Requirements
- Python 3.10+
- Poetry for package management and tooling
  - [Poetry Installation Instructions](https://python-poetry.org/docs/#installation)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Configured wallet data file

### Wallet Configuration
Before running the scripts, you might want to configure your wallet data in `morpho_base_mainnet_wallet_data.txt`:

Be careful as you expose your seed here, this should be used only for dev purpose. 

```txt
{"wallet_id": "XXX", "seed": "XXX", "network_id": "base-mainnet", "default_address_id": "XXX"}
```

> ⚠️ **Important**: Never commit your actual wallet credentials to version control. Make sure to keep your wallet data secure.

### Checking Python Version

```bash
python --version
poetry --version
```

## Installation
```bash
poetry install
```

## Run the Agent

### Env
Ensure the following vars are set in .env-local:
- "OPENAI_API_KEY"

Rename .env-local to .env

### Running the Scripts

For complete market flow:
```bash
poetry run python morpho_market_flow.py
```

For specific action flow:
```bash
poetry run python specific_action_flow.py
```

## Market Parameters
The scripts use predefined market parameters for Morpho operations:

| Parameter         | Description          | Value                                               |
|-------------------|----------------------|-----------------------------------------------------|
| **Loan Token**    | USDC                 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`        |
| **Collateral Token** | cbBTC             | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`        |
| **Oracle**        |     MorphoChainlinkOracleV2                 | `0x663BECd10daE6C4A3Dcd89F1d76c1174199639B9`        |
| **IRM**           |      AdaptiveCurve                | `0x46415998764C29aB2a25CbeA6254146D50D22687`        |
| **LLTV**          |          86%            | `860000000000000000`                                |

The market is visible here, on the [Morpho App](https://app.morpho.org/market?id=0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836&network=base)

> ⚠️ **Important**:
A bit of interests might be accrued between the borrow and repay, thus the repay amount is slightly higher than the borrow amount after 1 block.
That can prevent a full withdraw operation.

> ⚠️ Also, be careful with your position. if your loan to value goes above the LLTV, your position will be at rsk and can suffer of liquidation, [more here](https://docs.morpho.org/morpho/concepts/liquidation).

## Important Final Notes
- The agent validates available tools before execution
- Each operation requires user confirmation
- Operations are executed sequentially with success verification
- Detailed error reporting for any failures
- Wallet data is persisted between sessions