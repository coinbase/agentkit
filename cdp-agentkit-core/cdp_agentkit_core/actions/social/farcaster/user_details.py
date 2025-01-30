from pydantic import BaseModel, Field, ConfigDict
from cdp_agentkit_core.actions.social.farcaster.action import FarcasterAction
from typing import Optional


class UserDetailsInput(BaseModel):
    """Input argument schema for Farcaster user details action."""
    model_config = ConfigDict(extra="forbid")

    fid: Optional[str] = Field(
        None,
        description="The FID (Farcaster ID) of the user to get details for. If not provided, uses the authenticated user's FID."
    )


class UserDetailsAction(FarcasterAction):
    """Farcaster user details action."""

    name: str = "user_details"
    description: str = """
    This tool will return user details for a Farcaster user.
    If no FID is provided, it will return details for your own account.
    
    Input:
    - fid (optional): The FID of another user you want to look up
    """
    args_schema: type[BaseModel] = UserDetailsInput
    func = lambda client, fid=None: client.get_user_details(fid)