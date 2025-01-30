from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from cdp_agentkit_core.actions.social.farcaster.action import FarcasterAction


class CastInput(BaseModel):
    """Input for casting to Farcaster."""
    model_config = ConfigDict(extra="forbid")
    text: str = Field(..., description="The text content to cast")
    channel_id: Optional[str] = Field(None, description="Optional channel to post in")
    embeds: Optional[List[str]] = Field(None, description="Optional list of URLs to embed")


class CastAction(FarcasterAction):
    """Farcaster cast action."""

    name: str = "cast"
    description: str = """
    Use this tool to post a cast (message) to Farcaster.
    Input should be the text you want to cast.
    You can also specify a channel_id for posting in a specific channel,
    and embeds for including URLs.
    """
    args_schema: type[BaseModel] = CastInput
    func = lambda client, text, channel_id=None, embeds=None: client.cast(text=text, channel_id=channel_id, embeds=embeds)


# FARCASTER_ACTIONS = [CastAction()] 