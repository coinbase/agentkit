from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from cdp_agentkit_core.actions.social.farcaster.action import FarcasterAction


class NotificationsInput(BaseModel):
    """Input for getting Farcaster notifications."""
    model_config = ConfigDict(extra="forbid")
    
    types: Optional[List[str]] = Field(
        None,
        description="Optional list of notification types to fetch (follows, recasts, likes, mentions, replies)"
    )
    fid: Optional[str] = Field(
        None,
        description="The FID of the user to get notifications for. If not provided, uses the authenticated user's FID."
    )


class NotificationsAction(FarcasterAction):
    """Farcaster notifications action."""

    name: str = "notifications"
    description: str = """
    Get notifications for a Farcaster user.
    If no FID is provided, it will show notifications for your own account.
    You can specify types of notifications to fetch (follows, recasts, likes, mentions, replies).
    If no types are specified, all types will be fetched.

    Examples:
    - "Show my notifications"
    - "Check my mentions"
    - "Show my recent replies"
    """
    args_schema: type[BaseModel] = NotificationsInput
    func = lambda client, types=None, fid=None: client.get_notifications(fid, types) 