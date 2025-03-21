"""DESK action provider."""

import json
from typing import Any

from cdp import Network
from desk.auth import Auth
from desk.constant.common import CHAIN_ID
from desk.enum import OrderType, TimeInForce
from desk.exchange import Exchange
from desk.info import Info
from eth_account import Account

from coinbase_agentkit.network.network import arbitrum_sepolia, base

from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    CancelAllOrdersSchema,
    CancelOrderSchema,
    DepositCollateralSchema,
    GetCurrentFundingRateSchema,
    GetHistoricalFundingRatesSchema,
    GetLastTradesSchema,
    PlaceOrderSchema,
    WithdrawCollateralSchema,
)

SUPPORTED_CHAINS = list({str(chain_id) for chain_id in CHAIN_ID.values()})


class DeskActionProvider(ActionProvider):
    """Action provider for DESK trading platform operations."""

    def __init__(
        self, private_key: str, sub_account_id: str, chain_id: str, rpc_url: str | None = None
    ):
        """Initialize the DESK action provider."""
        super().__init__("desk", [])

        try:
            # Ensure PRIVATE_KEY is set
            assert private_key, "You must set the PRIVATE_KEY environment variable"

            assert chain_id, "You must set the CHAIN_ID environment variable"
            assert (
                chain_id in SUPPORTED_CHAINS
            ), f"Unsupported chain ID: {chain_id}. Only {SUPPORTED_CHAINS} are supported"

            assert sub_account_id, "You must set the SUB_ACCOUNT_ID environment variable"

            # Create Ethereum account from private key
            account = Account.from_key(private_key)

            if rpc_url:
                self.rpc_url = rpc_url
            else:
                self.rpc_url = (
                    base.rpc_urls["default"].http[0]
                    if chain_id == base.id
                    else arbitrum_sepolia.rpc_urls["default"].http[0]
                )

            self.network = "mainnet" if chain_id == base.id else "testnet"
            self.sub_account_id = int(sub_account_id)
            self.private_key = private_key

            self.account = account.address
            self.auth = Auth(
                network=self.network,
                rpc_url=self.rpc_url,
                account=self.account,
                sub_account_id=self.sub_account_id,
                private_key=self.private_key,
            )

            self.info = Info(network=self.network, skip_ws=True)
            self.exchange = Exchange(network=self.network, auth=self.auth)

        except Exception as e:
            raise ValueError(f"Failed to initialize DESK client: {e!s}") from e

    @create_action(
        name="get_subaccount_summary",
        description="""
        This tool will return the details of DESK account including:
        - Collaterals
        - Positions
        - Opened Orders
        """,
    )
    def get_subaccount_summary(self, args: dict[str, Any]) -> str:
        """Get the summary of the subaccount."""
        res = self.info.get_subaccount_summary(self.account, self.sub_account_id)
        return json.dumps(res, indent=4)

    @create_action(
        name="get_market_info",
        description="""
        Get the market info.
        """,
    )
    def get_market_info(self, args: dict[str, Any]) -> str:
        """Get the market info."""
        res = self.info.get_market_info()
        return json.dumps(res, indent=4)

    @create_action(
        name="get_collaterals_info",
        description="""
        Get the collaterals info.
        """,
    )
    def get_collaterals_info(self, args: dict[str, Any]) -> str:
        """Get the collaterals info."""
        res = self.info.get_collaterals_info()
        return json.dumps(res, indent=4)

    @create_action(
        name="get_current_funding_rate",
        description="""
        Get the current funding rate.

        Args:
            symbol (str): market symbol to get funding rates for
        """,
        schema=GetCurrentFundingRateSchema,
    )
    def get_current_funding_rate(self, args: dict[str, Any]) -> str:
        """Get the current funding rate."""
        res = self.info.get_current_funding_rate(symbol=args["symbol"])
        return json.dumps(res, indent=4)

    @create_action(
        name="get_historical_funding_rates",
        description="""
        Get the historical funding rates.
        Args:
            symbol (str): market symbol to get premium index for
            start_time (int): start time in seconds
            end_time (int): end time in seconds
        """,
        schema=GetHistoricalFundingRatesSchema,
    )
    def get_historical_funding_rates(self, args: dict[str, Any]) -> str:
        """Get the historical funding rates."""
        res = self.info.get_historical_funding_rates(
            symbol=args["symbol"], start_time=args["start_time"], end_time=args["end_time"]
        )
        return json.dumps(res, indent=4)

    @create_action(
        name="get_last_trades",
        description="""
        Get the most recent trades for each market.

        Args:
            symbol (str): market symbol to get trades for
        """,
        schema=GetLastTradesSchema,
    )
    def get_last_trades(self, args: dict[str, Any]) -> str:
        """Get the most recent trades."""
        res = self.info.get_last_trades(symbol=args["symbol"])
        return json.dumps(res, indent=4)

    @create_action(
        name="get_mark_price",
        description="""
        Get the current mark price.
        """,
    )
    def get_mark_price(self, args: dict[str, Any]) -> str:
        """Get the current mark price."""
        res = self.info.get_mark_price()
        return json.dumps(res, indent=4)

    @create_action(
        name="place_order",
        description="""
        Place an order on DESK.

        Args:
            amount (str): order amount
            price (str): order price (0 if market order)
            side (OrderSide): order side
            symbol (str): market symbol
            order_type (OrderType): order type
            reduce_only (Optional[bool]): whether the order is a reduce only order (true if close position)
            trigger_price (Optional[str]): trigger price
            time_in_force (Optional[TimeInForce]): time in force
            wait_for_reply (bool): should api wait for reply
            client_order_id (Optional[str]): client order id (max alphanumeric 36 characters)
        """,
        schema=PlaceOrderSchema,
    )
    def place_order(self, args: dict[str, Any]) -> str:
        """Place an order."""
        res = self.exchange.place_order(
            amount=args["amount"],
            price=args["price"],
            side=args["side"],
            symbol=args["symbol"],
            order_type=args.get("order_type", OrderType.MARKET),
            reduce_only=args.get("reduce_only", False),
            trigger_price=args.get("trigger_price"),
            time_in_force=args.get("time_in_force", TimeInForce.GTC),
            wait_for_reply=args.get("wait_for_reply", True),
            client_order_id=args.get("client_order_id"),
        )
        return json.dumps(res, indent=4)

    @create_action(
        name="cancel_order",
        description="""
        Cancel an order on DESK.

        Args:
            symbol (str): market symbol
            order_digest (str): order digest
            is_conditional_order (bool): whether the order is a conditional order
            wait_for_reply (bool): should api wait for reply
            client_order_id (str): client order id to cancel
        """,
        schema=CancelOrderSchema,
    )
    def cancel_order(self, args: dict[str, Any]) -> str:
        """Cancel an order."""
        res = self.exchange.cancel_order(
            symbol=args["symbol"],
            is_conditional_order=args.get("is_conditional_order", True),
            order_digest=args.get("order_digest"),
            wait_for_reply=args.get("wait_for_reply", True),
            client_order_id=args.get("client_order_id"),
        )
        return json.dumps(res, indent=4)

    @create_action(
        name="cancel_all_orders",
        description="""
        Cancel all orders on DESK.

        Args:
            symbol (str): symbol to cancel all orders for
            is_conditional_order (bool): whether the order is a conditional order
            wait_for_reply (bool): should api wait for reply
        """,
        schema=CancelAllOrdersSchema,
    )
    def cancel_all_orders(self, args: dict[str, Any]) -> str:
        """Cancel all orders."""
        res = self.exchange.cancel_all_orders(
            symbol=args.get("symbol"),
            is_conditional_order=args.get("is_conditional_order", True),
            wait_for_reply=args.get("wait_for_reply", True),
        )
        return json.dumps(res, indent=4)

    @create_action(
        name="deposit_collateral",
        description="""
        Deposit collateral on DESK.

        Args:
            asset (str): asset name
            amount (float): amount to deposit (human readable)

        Returns:
            transaction hash: str
        """,
        schema=DepositCollateralSchema,
    )
    def deposit_collateral(self, args: dict[str, Any]) -> str:
        """Deposit collateral."""
        res = self.exchange.deposit_collateral(asset=args["asset"], amount=args["amount"])
        return json.dumps(res, indent=4)

    @create_action(
        name="withdraw_collateral",
        description="""
        Withdraw collateral

        Args:
            asset (str): asset name
            amount (float): amount to withdraw (human readable)

        Returns:
            transaction hash: str
        """,
        schema=WithdrawCollateralSchema,
    )
    def withdraw_collateral(self, args: dict[str, Any]) -> str:
        """Withdraw collateral."""
        res = self.exchange.withdraw_collateral(asset=args["asset"], amount=args["amount"])
        return json.dumps(res, indent=4)

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by WETH actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: True if the network is supported, False otherwise.

        """
        return network.chain_id in SUPPORTED_CHAINS


def desk_action_provider(
    private_key: str, sub_account_id: str, chain_id: str, rpc_url: str | None = None
) -> DeskActionProvider:
    """Create a new DeskActionProvider instance."""
    return DeskActionProvider(
        private_key=private_key, sub_account_id=sub_account_id, chain_id=chain_id, rpc_url=rpc_url
    )
