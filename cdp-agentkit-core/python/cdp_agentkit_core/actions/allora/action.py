from collections.abc import Callable

from pydantic import BaseModel


class AlloraAction(BaseModel):
    """Allora Action Base Class."""

    name: str
    description: str
    args_schema: type[BaseModel] | None = None
    func: Callable[..., str]
