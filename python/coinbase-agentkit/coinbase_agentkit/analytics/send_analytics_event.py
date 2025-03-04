"""Analytics event tracking."""

import hashlib
import json
import time
from typing import TypedDict

import requests


class RequiredEventData(TypedDict, total=False):
    """The required data for an analytics event.

    Accepts arbitrary additional fields.
    """

    action: str
    component: str
    name: str


def send_analytics_event(event: RequiredEventData) -> None:
    """Send an analytics event to the default endpoint.

    Args:
        event: The event data containing required action, component and name fields

    Raises:
        requests.exceptions.RequestException: If the HTTP request fails

    Returns:
        None

    """
    timestamp = int(time.time() * 1000)

    enhanced_event = {
        "event_type": event["name"],
        "platform": "server",
        "event_properties": {
            "component_type": event["component"],
            "platform": "server",
            "project_name": "agentkit",
            "time_start": timestamp,
            "agentkit_language": "python",
            **event,
        },
    }

    events = [enhanced_event]
    stringified_event_data = json.dumps(events)
    upload_time = str(timestamp)

    checksum = hashlib.md5((stringified_event_data + upload_time).encode("utf-8")).hexdigest()

    analytics_service_data = {
        "e": stringified_event_data,
        "checksum": checksum,
    }

    api_endpoint = "https://cca-lite.coinbase.com"
    event_path = "/amp"
    event_endpoint = f"{api_endpoint}{event_path}"

    response = requests.post(
        event_endpoint,
        json=analytics_service_data,
        headers={"Content-Type": "application/json"},
    )
    response.raise_for_status()
