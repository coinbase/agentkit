"""Tests for CDP EVM Wallet action provider."""

import json
from unittest.mock import AsyncMock, Mock, patch

import pytest

from coinbase_agentkit.action_providers.cdp.cdp_evm_wallet_action_provider import (
    CdpEvmWalletActionProvider,
    cdp_evm_wallet_action_provider,
)
from coinbase_agentkit.action_providers.cdp.schemas import SwapSchema
from coinbase_agentkit.network import Network

# Mock constants
MOCK_ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
MOCK_USDC_ADDRESS = (
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"  # lowercase to match schema validation
)
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_SWAP_TX_HASH = "0xswap789"
MOCK_APPROVAL_TX_HASH = "0xapproval123"


@pytest.fixture
def mock_cdp_client():
    """Create a mock CDP client."""
    client = Mock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    # Mock EVM methods
    client.evm = Mock()
    client.evm.get_swap_price = AsyncMock()
    client.evm.get_account = AsyncMock()
    client.evm.send_transaction = AsyncMock()
    client.evm.wait_for_transaction_receipt = AsyncMock()

    return client


@pytest.fixture
def mock_evm_wallet_provider():
    """Create a mock EVM wallet provider."""
    provider = Mock()
    provider.get_address.return_value = MOCK_WALLET_ADDRESS
    provider.get_client.return_value = Mock()
    provider._get_cdp_sdk_network.return_value = "base"
    provider.wait_for_transaction_receipt = AsyncMock()
    provider._web3 = Mock()

    # Mock web3 contract calls for token details - need to handle different tokens
    def mock_contract_side_effect(address, abi):
        mock_contract = Mock()
        # Return different values based on the address
        if address.lower() == MOCK_USDC_ADDRESS:
            mock_contract.functions.decimals.return_value.call.return_value = 6
            mock_contract.functions.name.return_value.call.return_value = "USDC"
        else:  # Default to ETH
            mock_contract.functions.decimals.return_value.call.return_value = 18
            mock_contract.functions.name.return_value.call.return_value = "ETH"
        return mock_contract

    provider._web3.eth.contract.side_effect = mock_contract_side_effect

    return provider


@pytest.fixture
def mock_account():
    """Create a mock CDP account."""
    account = Mock()
    account.quote_swap = AsyncMock()
    return account


@pytest.fixture
def mock_swap_quote():
    """Create a mock swap quote."""
    quote = Mock()
    quote.liquidity_available = True
    quote.issues = None
    quote.to_amount = "990000000000000000"  # 0.99 ETH
    quote.min_to_amount = "980000000000000000"  # 0.98 ETH
    quote.execute = AsyncMock()
    return quote


@pytest.fixture
def action_provider():
    """Create a CDP EVM wallet action provider instance."""
    return CdpEvmWalletActionProvider()


class TestCdpEvmWalletActionProvider:
    """Test cases for CDP EVM Wallet Action Provider."""

    def test_provider_initializes(self):
        """Test provider initializes correctly."""
        provider = cdp_evm_wallet_action_provider()
        assert isinstance(provider, CdpEvmWalletActionProvider)
        assert provider.name == "cdp_evm_wallet"

    def test_supports_network(self, action_provider):
        """Test network support based on protocol family."""
        # Test EVM networks
        evm_network = Network(protocol_family="evm", network_id="base-mainnet")
        assert action_provider.supports_network(evm_network) is True

        # Test non-EVM networks
        svm_network = Network(protocol_family="svm", network_id="solana-devnet")
        assert action_provider.supports_network(svm_network) is False

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    @patch("asyncio.get_event_loop")
    def test_get_swap_price_base_mainnet(
        self,
        mock_get_event_loop,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
    ):
        """Test get_swap_price on base-mainnet."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_swap_price = Mock()
        mock_swap_price.to_amount = "990000"  # 0.99 USDC
        mock_cdp_client.evm.get_swap_price.return_value = mock_swap_price

        # Mock the event loop
        mock_loop = Mock()
        mock_loop.run_until_complete.return_value = mock_swap_price
        mock_get_event_loop.return_value = mock_loop

        args = {
            "from_token": MOCK_ETH_ADDRESS,
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "0.1",
            "slippage_bps": 100,
        }

        # Execute
        result = action_provider.get_swap_price(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is True
        assert parsed_result["fromAmount"] == "0.1"
        assert parsed_result["fromTokenName"] == "ETH"
        assert parsed_result["toTokenName"] == "USDC"
        assert parsed_result["slippageBps"] == 100

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    @patch("asyncio.get_event_loop")
    def test_get_swap_price_ethereum_mainnet(
        self,
        mock_get_event_loop,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
    ):
        """Test get_swap_price on ethereum-mainnet."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="ethereum-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client
        mock_evm_wallet_provider._get_cdp_sdk_network.return_value = "ethereum"

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_swap_price = Mock()
        mock_swap_price.to_amount = "990000"
        mock_cdp_client.evm.get_swap_price.return_value = mock_swap_price

        # Mock the event loop
        mock_loop = Mock()
        mock_loop.run_until_complete.return_value = mock_swap_price
        mock_get_event_loop.return_value = mock_loop

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.get_swap_price(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is True

    def test_get_swap_price_unsupported_network(self, action_provider, mock_evm_wallet_provider):
        """Test get_swap_price returns error for unsupported networks."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-sepolia"
        )

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.get_swap_price(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert (
            "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'"
            in parsed_result["error"]
        )

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    def test_get_swap_price_api_error(
        self, mock_get_token_details, action_provider, mock_evm_wallet_provider, mock_cdp_client
    ):
        """Test get_swap_price handles API errors."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_swap_price.side_effect = Exception("API Error")

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.get_swap_price(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert "Error fetching swap price: API Error" in parsed_result["error"]

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.retry_with_exponential_backoff")
    @patch("asyncio.get_event_loop")
    def test_swap_successful_execution(
        self,
        mock_get_event_loop,
        mock_retry,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test successful swap execution."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client
        mock_evm_wallet_provider.wait_for_transaction_receipt.return_value = Mock(status="success")

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_account.return_value = mock_account
        mock_account.quote_swap.return_value = mock_swap_quote

        mock_swap_result = Mock()
        mock_swap_result.transaction_hash = MOCK_SWAP_TX_HASH
        mock_swap_quote.execute.return_value = mock_swap_result
        mock_retry.return_value = mock_swap_result

        # Mock the event loop - need to return the result of the async function
        mock_loop = Mock()

        # The actual result that gets returned from the async function
        async_result = {
            "success": True,
            "transactionHash": MOCK_SWAP_TX_HASH,
            "fromAmount": "0.1",
            "fromTokenName": "ETH",
            "fromToken": MOCK_ETH_ADDRESS,
            "toAmount": "0.99",
            "minToAmount": "0.98",
            "toTokenName": "USDC",
            "toToken": MOCK_USDC_ADDRESS,
            "slippageBps": 100,
            "network": "base-mainnet",
        }
        mock_loop.run_until_complete.return_value = async_result
        mock_get_event_loop.return_value = mock_loop

        args = {
            "from_token": MOCK_ETH_ADDRESS,
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "0.1",
            "slippage_bps": 100,
        }

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is True
        assert parsed_result["transactionHash"] == MOCK_SWAP_TX_HASH
        assert parsed_result["fromAmount"] == "0.1"
        assert parsed_result["fromTokenName"] == "ETH"
        assert parsed_result["toTokenName"] == "USDC"

    def test_swap_unsupported_network(self, action_provider, mock_evm_wallet_provider):
        """Test swap returns error for unsupported networks."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-sepolia"
        )

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert (
            "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'"
            in parsed_result["error"]
        )

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    def test_swap_no_liquidity_available(
        self,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test swap returns error when liquidity is not available."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_account.return_value = mock_account
        mock_swap_quote.liquidity_available = False
        mock_account.quote_swap.return_value = mock_swap_quote

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert "No liquidity available to swap" in parsed_result["error"]

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    def test_swap_insufficient_balance(
        self,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test swap returns error when balance is insufficient."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_account.return_value = mock_account

        # Mock insufficient balance
        mock_balance_issue = Mock()
        mock_balance_issue.current_balance = "50000000000000000"  # 0.05 ETH
        mock_issues = Mock()
        mock_issues.balance = mock_balance_issue
        mock_swap_quote.issues = mock_issues
        mock_account.quote_swap.return_value = mock_swap_quote

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert "Balance is not enough to perform swap" in parsed_result["error"]
        assert "but only have 0.05 ETH" in parsed_result["error"]

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.retry_with_exponential_backoff")
    @patch("web3.Web3")
    @patch("asyncio.get_event_loop")
    def test_swap_with_approval_transaction(
        self,
        mock_get_event_loop,
        mock_web3,
        mock_retry,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test swap handles approval transaction when allowance is insufficient."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client
        mock_evm_wallet_provider.wait_for_transaction_receipt.side_effect = [
            Mock(status="success"),  # Approval receipt
            Mock(status="success"),  # Swap receipt
        ]

        mock_get_token_details.return_value = {
            "from_token_decimals": 6,  # USDC decimals
            "to_token_decimals": 18,  # ETH decimals
            "from_token_name": "USDC",
            "to_token_name": "ETH",
        }

        # Mock Web3 contract for approval
        mock_contract = Mock()
        mock_contract.encodeABI.return_value = "0xapprovaldata"
        mock_web3_instance = Mock()
        mock_web3_instance.eth.contract.return_value = mock_contract
        mock_web3.return_value = mock_web3_instance

        mock_cdp_client.evm.get_account.return_value = mock_account
        mock_cdp_client.evm.send_transaction.return_value = MOCK_APPROVAL_TX_HASH
        mock_cdp_client.evm.wait_for_transaction_receipt.return_value = Mock(status="success")

        # Mock allowance issue
        mock_allowance_issue = Mock()
        mock_allowance_issue.required_allowance = "100000000000000000"
        mock_allowance_issue.current_allowance = "0"
        mock_issues = Mock()
        mock_issues.allowance = mock_allowance_issue
        mock_swap_quote.issues = mock_issues
        mock_account.quote_swap.return_value = mock_swap_quote

        mock_swap_result = Mock()
        mock_swap_result.transaction_hash = MOCK_SWAP_TX_HASH
        mock_swap_quote.execute.return_value = mock_swap_result
        mock_retry.return_value = mock_swap_result

        # Mock the event loop
        mock_loop = Mock()
        async_result = {
            "success": True,
            "transactionHash": MOCK_SWAP_TX_HASH,
            "approvalTxHash": MOCK_APPROVAL_TX_HASH,
            "fromAmount": "100",
            "fromTokenName": "USDC",
            "fromToken": MOCK_USDC_ADDRESS,
            "toAmount": "0.04",  # Some ETH amount
            "minToAmount": "0.039",
            "toTokenName": "ETH",
            "toToken": MOCK_ETH_ADDRESS,
            "slippageBps": 100,
            "network": "base-mainnet",
        }
        mock_loop.run_until_complete.return_value = async_result
        mock_get_event_loop.return_value = mock_loop

        args = {
            "from_token": MOCK_USDC_ADDRESS,  # Using USDC to trigger approval
            "to_token": MOCK_ETH_ADDRESS,
            "from_amount": "100",
        }

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is True
        assert parsed_result["approvalTxHash"] == MOCK_APPROVAL_TX_HASH
        assert parsed_result["transactionHash"] == MOCK_SWAP_TX_HASH

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    def test_swap_execution_error(
        self,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test swap handles execution errors."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_account.return_value = mock_account
        mock_account.quote_swap.return_value = mock_swap_quote
        mock_swap_quote.execute.side_effect = Exception("Swap execution failed")

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert "Swap failed: Swap execution failed" in parsed_result["error"]

    @patch("coinbase_agentkit.action_providers.cdp.swap_utils.get_token_details")
    def test_swap_transaction_reverted(
        self,
        mock_get_token_details,
        action_provider,
        mock_evm_wallet_provider,
        mock_cdp_client,
        mock_account,
        mock_swap_quote,
    ):
        """Test swap handles transaction revert."""
        # Setup
        mock_evm_wallet_provider.get_network.return_value = Network(
            protocol_family="evm", network_id="base-mainnet"
        )
        mock_evm_wallet_provider.get_client.return_value = mock_cdp_client
        mock_evm_wallet_provider.wait_for_transaction_receipt.return_value = Mock(status="failed")

        mock_get_token_details.return_value = {
            "from_token_decimals": 18,
            "to_token_decimals": 6,
            "from_token_name": "ETH",
            "to_token_name": "USDC",
        }

        mock_cdp_client.evm.get_account.return_value = mock_account
        mock_account.quote_swap.return_value = mock_swap_quote

        mock_swap_result = Mock()
        mock_swap_result.transaction_hash = MOCK_SWAP_TX_HASH
        mock_swap_quote.execute.return_value = mock_swap_result

        args = {"from_token": MOCK_ETH_ADDRESS, "to_token": MOCK_USDC_ADDRESS, "from_amount": "0.1"}

        # Execute
        result = action_provider.swap(mock_evm_wallet_provider, args)
        parsed_result = json.loads(result)

        # Verify
        assert parsed_result["success"] is False
        assert "Swap transaction reverted" in parsed_result["error"]


class TestSwapSchema:
    """Test cases for SwapSchema validation."""

    def test_swap_schema_valid_input(self):
        """Test SwapSchema validates correct input."""
        valid_input = {
            "from_token": MOCK_ETH_ADDRESS,
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "0.1",
        }

        schema = SwapSchema(**valid_input)
        assert schema.from_token == MOCK_ETH_ADDRESS
        assert schema.to_token == MOCK_USDC_ADDRESS
        assert schema.from_amount == "0.1"
        assert schema.slippage_bps == 100  # Default value

    def test_swap_schema_with_optional_slippage(self):
        """Test SwapSchema validates input with optional slippageBps."""
        valid_input = {
            "from_token": MOCK_USDC_ADDRESS,
            "to_token": MOCK_ETH_ADDRESS,
            "from_amount": "100",
            "slippage_bps": 50,
        }

        schema = SwapSchema(**valid_input)
        assert schema.slippage_bps == 50

    def test_swap_schema_invalid_missing_fields(self):
        """Test SwapSchema fails validation when missing required fields."""
        invalid_input = {
            "from_token": MOCK_ETH_ADDRESS,
            # missing to_token and from_amount
        }

        with pytest.raises(ValueError):
            SwapSchema(**invalid_input)

    def test_swap_schema_invalid_token_address(self):
        """Test SwapSchema fails validation with invalid token address."""
        invalid_input = {
            "from_token": "not-an-address",
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "0.1",
        }

        with pytest.raises(ValueError, match="Invalid Ethereum address format"):
            SwapSchema(**invalid_input)

    def test_swap_schema_invalid_amount(self):
        """Test SwapSchema fails validation with invalid amount."""
        invalid_input = {
            "from_token": MOCK_ETH_ADDRESS,
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "-1.0",
        }

        with pytest.raises(ValueError, match="Amount must be greater than 0"):
            SwapSchema(**invalid_input)

    def test_swap_schema_invalid_slippage_range(self):
        """Test SwapSchema fails validation with slippage out of range."""
        invalid_input = {
            "from_token": MOCK_ETH_ADDRESS,
            "to_token": MOCK_USDC_ADDRESS,
            "from_amount": "0.1",
            "slippage_bps": 20000,  # > 10000
        }

        with pytest.raises(ValueError):
            SwapSchema(**invalid_input)
