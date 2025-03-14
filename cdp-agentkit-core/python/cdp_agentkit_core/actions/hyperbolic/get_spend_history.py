from collections import defaultdict
from collections.abc import Callable
from datetime import datetime

import requests
from pydantic import BaseModel

from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.hyperbolic.utils import get_api_key

GET_SPEND_HISTORY_PROMPT = """
This tool retrieves and analyzes your GPU rental spending history from the Hyperbolic platform.
It provides information about:
- List of all instances rented
- Duration of each rental in seconds
- Cost per rental
- Total spending per GPU type
- Overall total spending
No input parameters required.
"""


class GetSpendHistoryInput(BaseModel):
    """Input argument schema for getting spend history."""

    pass


def calculate_duration_seconds(start_time: str, end_time: str) -> float:
    """Calculate duration in seconds between two timestamps."""
    start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    duration = end - start
    return duration.total_seconds()


def get_spend_history() -> str:
    """Retrieve and analyze instance rental spending history.

    Returns:
        str: Formatted analysis of GPU rental spending

    """
    api_key = get_api_key()

    url = "https://api.hyperbolic.xyz/v1/marketplace/instances/history"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

        if not data.get("instance_history"):
            return "No rental history found."

        # Initialize analysis variables
        total_cost = 0
        gpu_stats = defaultdict(lambda: {"count": 0, "total_cost": 0, "total_seconds": 0})
        instances_summary = []

        # Analyze each instance
        for instance in data["instance_history"]:
            duration_seconds = calculate_duration_seconds(
                instance["started_at"], instance["terminated_at"]
            )
            # Convert seconds to hours for cost calculation
            duration_hours = duration_seconds / 3600.0
            # Calculate cost: (hours) * (cents/hour) / (100 cents/dollar)
            cost = (duration_hours * instance["price"]["amount"]) / 100.0
            total_cost += cost

            # Get GPU model and count from this instance - with validation
            gpus = instance["hardware"].get("gpus", [])

            gpu_model = "Unknown GPU" if not gpus else gpus[0].get("model", "Unknown GPU") # Safely get GPU model

            gpu_count = instance["gpu_count"]
            gpu_stats[gpu_model]["count"] += gpu_count
            gpu_stats[gpu_model]["total_cost"] += cost
            gpu_stats[gpu_model]["total_seconds"] += duration_seconds

            # Create instance summary
            instances_summary.append(
                {
                    "name": instance["instance_name"],
                    "gpu_model": gpu_model,
                    "gpu_count": gpu_count,
                    "duration_seconds": int(duration_seconds),
                    "cost": round(cost, 2),
                }
            )

        # Format the output
        output = ["=== GPU Rental Spending Analysis ===\n"]

        output.append("Instance Rentals:")
        for instance in instances_summary:
            output.append(f"- {instance['name']}:")
            output.append(f"  GPU: {instance['gpu_model']} (Count: {instance['gpu_count']})")
            output.append(f"  Duration: {instance['duration_seconds']} seconds")
            output.append(f"  Cost: ${instance['cost']:.2f}")

        output.append("\nGPU Type Statistics:")
        for gpu_model, stats in gpu_stats.items():
            output.append(f"\n{gpu_model}:")
            output.append(f"  Total Rentals: {stats['count']}")
            output.append(f"  Total Time: {int(stats['total_seconds'])} seconds")
            output.append(f"  Total Cost: ${stats['total_cost']:.2f}")

        output.append(f"\nTotal Spending: ${total_cost:.2f}")

        return "\n".join(output)

    except requests.exceptions.RequestException as e:
        return f"Error retrieving spend history: {e!s}"


class GetSpendHistoryAction(CdpAction):
    """Get spend history action."""

    name: str = "get_spend_history"
    description: str = GET_SPEND_HISTORY_PROMPT
    args_schema: type[BaseModel] | None = GetSpendHistoryInput
    func: Callable[..., str] = get_spend_history
