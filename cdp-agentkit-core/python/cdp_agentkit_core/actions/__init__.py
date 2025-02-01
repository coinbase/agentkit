from cdp_agentkit_core.actions.cdp_action import CdpAction  # noqa: I001

from cdp_agentkit_core.actions.address_reputation import AddressReputationAction
from cdp_agentkit_core.actions.deploy_contract import DeployContractAction
from cdp_agentkit_core.actions.deploy_nft import DeployNftAction
from cdp_agentkit_core.actions.deploy_token import DeployTokenAction
from cdp_agentkit_core.actions.get_balance import GetBalanceAction
from cdp_agentkit_core.actions.get_balance_nft import GetBalanceNftAction
from cdp_agentkit_core.actions.get_wallet_details import GetWalletDetailsAction
from cdp_agentkit_core.actions.mint_nft import MintNftAction
from cdp_agentkit_core.actions.morpho.deposit import MorphoDepositAction
from cdp_agentkit_core.actions.morpho.withdraw import MorphoWithdrawAction
from cdp_agentkit_core.actions.pyth.fetch_price import PythFetchPriceAction
from cdp_agentkit_core.actions.pyth.fetch_price_feed_id import PythFetchPriceFeedIDAction
from cdp_agentkit_core.actions.register_basename import RegisterBasenameAction
from cdp_agentkit_core.actions.request_faucet_funds import RequestFaucetFundsAction
from cdp_agentkit_core.actions.superfluid.create_flow import SuperfluidCreateFlowAction
from cdp_agentkit_core.actions.superfluid.delete_flow import SuperfluidDeleteFlowAction
from cdp_agentkit_core.actions.superfluid.update_flow import SuperfluidUpdateFlowAction
from cdp_agentkit_core.actions.trade import TradeAction
from cdp_agentkit_core.actions.transfer import TransferAction
from cdp_agentkit_core.actions.transfer_nft import TransferNftAction
from cdp_agentkit_core.actions.wow.buy_token import WowBuyTokenAction
from cdp_agentkit_core.actions.wow.create_token import WowCreateTokenAction
from cdp_agentkit_core.actions.wow.sell_token import WowSellTokenAction
from cdp_agentkit_core.actions.wrap_eth import WrapEthAction
from cdp_agentkit_core.actions.get_spend_permissions import GetSpendPermissionsAction
from cdp_agentkit_core.actions.use_spend_permission import UseSpendPermissionAction

# WARNING: All new CdpAction subclasses must be imported above, otherwise they will not be discovered
# by get_all_cdp_actions(). The import ensures the class is registered as a subclass of CdpAction.
def get_all_cdp_actions() -> list[type[CdpAction]]:
    """Retrieve all subclasses of CdpAction defined in the package."""
    actions = []
    for action in CdpAction.__subclasses__():
        actions.append(action())
    return actions


CDP_ACTIONS = get_all_cdp_actions()

__all__ = [
    "CDP_ACTIONS",
    "CdpAction",
    "AddressReputationAction",
    "DeployNftAction",
    "DeployTokenAction",
    "DeployContractAction",
    "GetBalanceAction",
    "GetBalanceNftAction",
    "GetWalletDetailsAction",
    "MintNftAction",
    "RegisterBasenameAction",
    "RequestFaucetFundsAction",
    "TradeAction",
    "TransferAction",
    "TransferNftAction",
    "WowBuyTokenAction",
    "WowCreateTokenAction",
    "WowSellTokenAction",
    "WrapEthAction",
    "MorphoDepositAction",
    "MorphoWithdrawAction",
    "PythFetchPriceFeedIDAction",
    "PythFetchPriceAction",
    "SuperfluidCreateFlowAction",
    "SuperfluidUpdateFlowAction",
    "SuperfluidDeleteFlowAction",
    "GetSpendPermissionsAction",
    "UseSpendPermissionAction",
]
