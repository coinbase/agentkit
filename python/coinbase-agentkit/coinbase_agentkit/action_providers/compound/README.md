# Compound Action Provider

This directory contains the **CompoundActionProvider** implementation, which provides actions to interact with **Compound Protocol** for lending and borrowing operations.

## Directory Structure

```
compound/
├── compound_action_provider.py     # Compound action provider
├── schemas.py                      # Compound action schemas
├── __init__.py                     # Main exports
└── README.md                       # This file

# From python/coinbase-agentkit/
tests/action_providers/compound/
├── conftest.py                    # Test configuration
├── test_compound_borrow.py        # Test for borrow action
├── test_compound_portfolio.py     # Test for portfolio action
├── test_compound_provider.py      # Test for provider
├── test_compound_repay.py         # Test for repay action
├── test_compound_schemas.py       # Test for schemas
├── test_compound_supply.py        # Test for supply action
├── test_compound_utils.py         # Test for utils
└── test_compound_withdraw.py      # Test for withdraw action
```

## Actions

These actions allow you to supply, borrow, repay, withdraw ETH or USDC to Compound V3 markets through the Base USDC Comet Contract.

> 🧪 **Try it on Base Sepolia First!**  
> These actions work seamlessly on Base Sepolia testnet, allowing you to develop and test your agent's Compound interactions without using real funds. Once you're confident in your implementation, you can switch to Base mainnet for production use.

- `supply`: Supply ETH or USDC to Compound V3 markets on Base.
- `borrow`: Borrow ETH or USDC from Compound V3 markets on Base.
- `repay`: Repay ETH or USDC to Compound V3 markets on Base.
- `withdraw`: Withdraw ETH or USDC from Compound V3 markets on Base.
- `get_portfolio_details`: Get the portfolio details for the Compound V3 markets on Base.

## Notes

### Limitations and Assumptions

- Only supports one Comet contract, the Base/Base Sepolia USDC Comet
- The only borrowable asset is USDC as a result of the above.
- The amounts sent to these actions are _whole units_ of the asset (e.g., 0.01 ETH, 100 USDC).
- Token symbols are the `asset_id` (lowercase) rather than the symbol.

### Sample Integration Test Reference

Integration tests are planned for Coinbase/Agentkit. In the meantime, you can use the following example to test the action provider, which is how the action provider is tested in the Coinbase/Agentkit repo:

```python
import time
from decimal import Decimal

import pytest

from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import CdpApiActionProvider
from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    CompoundActionProvider,
)
from coinbase_agentkit.action_providers.weth.weth_action_provider import WethActionProvider
from coinbase_agentkit.wallet_providers import CdpWalletProvider

# Constants
USDC_ASSET = "usdc"
ETH_ASSET = "eth"
WAIT_TIME = 15

@pytest.fixture
def wallet():
    """Create a real wallet instance for testing using the CDP wallet provider."""
    return CdpWalletProvider()

@pytest.fixture
def compound_provider():
    """Create a compound provider instance for testing."""
    return CompoundActionProvider()

@pytest.fixture
def weth_provider():
    """Create a WETH provider instance for testing."""
    return WethActionProvider()

@pytest.fixture
def cdp_provider():
    """Create a CDP API provider instance for testing."""
    return CdpApiActionProvider()

@pytest.mark.integration
def test_compound_integration(wallet, compound_provider, weth_provider, cdp_provider):
    """Test the full Compound integration flow using the new action provider pattern."""

    # Step 1: Request funds from faucet using cdp_api provider
    faucet_result = cdp_provider.request_faucet_funds(wallet, {"asset_id": ETH_ASSET})
    assert "Received" in faucet_result and ETH_ASSET in faucet_result, f"Faucet funds error: {faucet_result}"
    time.sleep(WAIT_TIME)

    # Step 2: Wrap ETH to WETH using weth provider
    wrap_amount = Decimal("0.00005")
    wrap_result = weth_provider.wrap_eth(wallet, {"amount_to_wrap": str(wrap_amount)})
    assert "Wrapped" in wrap_result, f"Wrap action failed: {wrap_result}"
    time.sleep(WAIT_TIME)

    # Step 3: Supply WETH to Compound using compound provider
    supply_result = compound_provider.supply(wallet, {"asset_id": "weth", "amount": str(wrap_amount)})
    assert "Supplied" in supply_result, f"Supply action failed: {supply_result}"
    assert "Transaction hash" in supply_result, f"Supply result missing transaction hash: {supply_result}"
    time.sleep(WAIT_TIME)

    # Step 4: Borrow USDC from Compound
    borrow_amount = Decimal("0.01")
    borrow_result = compound_provider.borrow(wallet, {"asset_id": USDC_ASSET, "amount": str(borrow_amount)})
    assert "Borrowed" in borrow_result, f"Borrow action failed: {borrow_result}"
    time.sleep(WAIT_TIME)

    # Step 5: Check portfolio details
    portfolio_details = compound_provider.get_portfolio(wallet, {})
    assert "**Supply Amount:** 0.000050000000000000" in portfolio_details
    assert "**Borrow Amount:** 0.010000" in portfolio_details

    # Step 6: Repay USDC
    repay_result = compound_provider.repay(wallet, {
        "asset_id": USDC_ASSET,
        "amount": str(borrow_amount)
    })
    assert "Repaid" in repay_result
    assert "Transaction hash" in repay_result
    time.sleep(WAIT_TIME)

    # Step 7: Withdraw WETH
    withdraw_result = compound_provider.withdraw(wallet, {
        "asset_id": "weth",
        "amount": str(wrap_amount)
    })
    assert "Withdrawn" in withdraw_result
    assert "Transaction hash" in withdraw_result

    # Step 8: Check the portfolio details again
    portfolio_details = compound_provider.get_portfolio(wallet, {})
    assert "No supplied assets found in your Compound position." in portfolio_details
    assert "No borrowed assets found in your Compound position." in portfolio_details
```

### Supported Compound Markets (aka. Comets)

#### Base

- USDC Comet
  - Supply Assets: USDC, WETH, cbBTC, cbETH, wstETH
  - Borrow Asset: USDC

#### Base Sepolia

- USDC Comet
  - Supply Assets: USDC, WETH
  - Borrow Asset: USDC

### Funded by Compound Grants Program

Compound Actions for AgentKit is funded by the Compound Grants Program. Learn more about the Grant on Questbook [here](https://new.questbook.app/dashboard/?role=builder&chainId=10&proposalId=678c218180bdbe26619c3ae8&grantId=66f29bb58868f5130abc054d). For support, please reach out the original author of this action provider: [@mikeghen](https://x.com/mikeghen).
