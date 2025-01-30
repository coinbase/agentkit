from cdp_agentkit_core.actions.social.farcaster.action import FarcasterAction
from cdp_agentkit_core.actions.social.farcaster.cast import CastAction
from cdp_agentkit_core.actions.social.farcaster.user_details import UserDetailsAction
from cdp_agentkit_core.actions.social.farcaster.notifications import NotificationsAction

def get_all_farcaster_actions() -> list[FarcasterAction]:
    """Get all Farcaster actions."""
    actions = []
    for action in FarcasterAction.__subclasses__():
        actions.append(action())
    return actions


FARCASTER_ACTIONS = get_all_farcaster_actions()

__all__ = [
    "FARCASTER_ACTIONS",
    "FarcasterAction",
    "CastAction",
    "UserDetailsAction",
    "NotificationsAction",
] 