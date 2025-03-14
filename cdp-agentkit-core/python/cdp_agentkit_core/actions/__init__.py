from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.deploy_nft import DeployNftAction
from cdp_agentkit_core.actions.deploy_token import DeployTokenAction
from cdp_agentkit_core.actions.get_balance import GetBalanceAction
from cdp_agentkit_core.actions.get_balance_nft import GetBalanceNftAction
from cdp_agentkit_core.actions.get_wallet_details import GetWalletDetailsAction
from cdp_agentkit_core.actions.hyperbolic.get_available_gpus import GetAvailableGpusAction
from cdp_agentkit_core.actions.hyperbolic.get_current_balance import GetCurrentBalanceAction
from cdp_agentkit_core.actions.hyperbolic.get_gpu_status import GetGpuStatusAction
from cdp_agentkit_core.actions.hyperbolic.get_spend_history import GetSpendHistoryAction
from cdp_agentkit_core.actions.hyperbolic.rent_compute import RentComputeAction
from cdp_agentkit_core.actions.hyperbolic.terminate_compute import TerminateComputeAction
from cdp_agentkit_core.actions.mint_nft import MintNftAction
from cdp_agentkit_core.actions.pyth.fetch_price import PythFetchPriceAction
from cdp_agentkit_core.actions.pyth.fetch_price_feed_id import PythFetchPriceFeedIDAction
from cdp_agentkit_core.actions.register_basename import RegisterBasenameAction
from cdp_agentkit_core.actions.request_faucet_funds import RequestFaucetFundsAction
from cdp_agentkit_core.actions.trade import TradeAction
from cdp_agentkit_core.actions.transfer import TransferAction
from cdp_agentkit_core.actions.transfer_nft import TransferNftAction
from cdp_agentkit_core.actions.wow.buy_token import WowBuyTokenAction
from cdp_agentkit_core.actions.wow.create_token import WowCreateTokenAction
from cdp_agentkit_core.actions.wow.sell_token import WowSellTokenAction
from cdp_agentkit_core.actions.wrap_eth import WrapEthAction


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
    "DeployNftAction",
    "DeployTokenAction",
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
    "PythFetchPriceFeedIDAction",
    "PythFetchPriceAction",
    "GetAvailableGpusAction",
    "GetCurrentBalanceAction",
    "GetGpuStatusAction",
    "GetSpendHistoryAction",
    "RentComputeAction",
    "TerminateComputeAction",
]
