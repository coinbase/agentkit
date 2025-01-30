from collections.abc import Callable
from typing import Optional, Type

from pydantic import BaseModel

class FarcasterAction(BaseModel):
    """Farcaster Action Base Class."""

    name: str
    description: str
    args_schema: Optional[Type[BaseModel]] = None
    func: Callable[..., str]

    class Config:
        """Pydantic config."""
        arbitrary_types_allowed = True
        extra = "forbid" 