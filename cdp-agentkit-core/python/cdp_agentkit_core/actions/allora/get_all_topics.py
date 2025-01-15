import json
from collections.abc import Callable

from allora_sdk.v2.api_client import AlloraAPIClient
from pydantic import BaseModel

from cdp_agentkit_core.actions.allora.action import AlloraAction

GET_ALL_TOPICS_PROMPT = """
This tool will get all available topics from Allora Network.
"""


async def get_all_topics(client: AlloraAPIClient) -> str:
    """Get all available topics from Allora Network.

    Args:
        client (AlloraAPIClient): The Allora API client.

    Returns:
        str: A list of available topics from Allora Network in JSON format

    """
    try:
        topics = await client.get_all_topics()
        topics_json = json.dumps(topics, indent=4)
        return f"The available topics at Allora Network are:\n{topics_json}"
    except Exception as e:
        return f"Error getting all topics: {e}"


class GetAllTopicsAction(AlloraAction):
    """Get all topics action."""

    name: str = "get_all_topics"
    description: str = GET_ALL_TOPICS_PROMPT
    args_schema: type[BaseModel] | None = None
    func: Callable[..., str] = get_all_topics
