from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.deploy_nft import DeployNftAction
from cdp_agentkit_core.actions.deploy_token import DeployTokenAction
from cdp_agentkit_core.actions.get_balance import GetBalanceAction
from cdp_agentkit_core.actions.get_wallet_details import GetWalletDetailsAction
from cdp_agentkit_core.actions.mint_nft import MintNftAction
from cdp_agentkit_core.actions.register_basename import RegisterBasenameAction
from cdp_agentkit_core.actions.request_faucet_funds import RequestFaucetFundsAction
from cdp_agentkit_core.actions.trade import TradeAction
from cdp_agentkit_core.actions.transfer import TransferAction
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
    "GetWalletDetailsAction",
    "MintNftAction",
    "RegisterBasenameAction",
    "RequestFaucetFundsAction",
    "TradeAction",
    "TransferAction",
    "WowBuyTokenAction",
    "WowCreateTokenAction",
    "WowSellTokenAction",
    "WrapEthAction",
]
