import time
from decimal import Decimal
from os import getenv

import pytest
from cdp import Cdp, Wallet

from cdp_agentkit_core.actions.compound.borrow import compound_borrow
from cdp_agentkit_core.actions.compound.portfolio_details import get_portfolio_details
from cdp_agentkit_core.actions.compound.repay import compound_repay
from cdp_agentkit_core.actions.compound.supply import compound_supply
from cdp_agentkit_core.actions.compound.withdraw import compound_withdraw
from cdp_agentkit_core.actions.request_faucet_funds import request_faucet_funds
from cdp_agentkit_core.actions.weth.wrap_eth import wrap_eth

# Constants
USDC_ASSET = "usdc"
ETH_ASSET = "eth"
WAIT_TIME = 3  # seconds to wait between transactions
CDP_JSON_KEY_PATH = getenv("CDP_JSON_KEY_PATH")    # Configure the CDP SDK

if CDP_JSON_KEY_PATH:
    Cdp.configure_from_json(CDP_JSON_KEY_PATH)
    print("CDP SDK has been successfully configured from JSON file.")
else:
    print("CDP_JSON_KEY_PATH is not set, skipping integration tests.")

@pytest.fixture
def wallet():
    """Create a real wallet instance for testing."""
    wallet = Wallet.create()
    # Request test tokens from the faucet
    request_faucet_funds(wallet, ETH_ASSET)
    request_faucet_funds(wallet, USDC_ASSET)

    # Verify we're on testnet
    assert wallet.network_id == "base-sepolia", "Tests must be run on base-sepolia network"

    return wallet

@pytest.mark.integration
def test_compound_cdp_integration(wallet):
    """Test the integration of Compound and CDP.

    1. Wrap ETH to WETH
    2. Supply WETH
    3. Borrow USDC
    4. Repay USDC
    5. Withdraw WETH
    """
    # Get initial ETH balance and convert to wei
    eth_balance = wallet.default_address.balance(ETH_ASSET)
    wrap_amount = eth_balance / Decimal(2)  # Wrap half of available ETH

    # Print the balances
    print(f"ETH balance: {eth_balance}")
    print(f"Wrap amount: {wrap_amount}")

    # Step 1: Wrap ETH to WETH
    print(f"\nWrapping {wrap_amount} ETH to WETH...")
    wrap_result = wrap_eth(wallet, wrap_amount)
    assert "transaction hash" in wrap_result.lower()
    print(wrap_result)

    time.sleep(WAIT_TIME)

    # Step 2: Supply WETH
    print("\nSupplying WETH...")
    supply_result = compound_supply(wallet, "weth", wrap_amount)
    assert "Supplied" in supply_result
    assert "Transaction hash" in supply_result
    print(supply_result)

    time.sleep(WAIT_TIME)

    # Step 3: Borrow USDC
    borrow_amount = 0.01
    print(f"\nBorrowing {borrow_amount} USDC...")
    borrow_result = compound_borrow(wallet, USDC_ASSET, borrow_amount)
    assert "Borrowed" in borrow_result
    assert "Transaction hash" in borrow_result
    print(borrow_result)

    time.sleep(WAIT_TIME)

    portfolio_details = get_portfolio_details(wallet)
    print("Portfolio Details: ", portfolio_details)
    # Assert we supplied and borrowed the correct amounts
    assert "**Supply Amount:** 0.000050000000000000" in portfolio_details
    assert "**Borrow Amount:** 0.010000" in portfolio_details

    # Step 4: Repay USDC
    print(f"\nRepaying {borrow_amount} USDC...")
    repay_result = compound_repay(wallet, USDC_ASSET, borrow_amount)
    assert "Repaid" in repay_result
    assert "Transaction hash" in repay_result
    print(repay_result)

    time.sleep(WAIT_TIME)

    # Step 5: Withdraw WETH
    print(f"\nWithdrawing {wrap_amount} WETH...")
    # Withdraw a little less since the interest is unrepaid
    withdraw_result = compound_withdraw(wallet, "weth", wrap_amount * Decimal(0.99))
    assert "Withdrew" in withdraw_result
    assert "Transaction hash" in withdraw_result
    print(withdraw_result)

    # Step 6: Check the portfolio details again
    portfolio_details = get_portfolio_details(wallet)
    print("Portfolio Details: ", portfolio_details)
    # Assert we supplied and borrowed the correct amounts, ignore the dusts, truncate the decimals
    assert "**Supply Amount:** 0.00000" in portfolio_details
    assert "**Borrow Amount:** 0.00" in portfolio_details or "No borrowed assets" in portfolio_details
