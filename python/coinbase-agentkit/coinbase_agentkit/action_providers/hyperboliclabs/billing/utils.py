"""Utility functions for Hyperbolic billing services.

This module provides utility functions for formatting and processing
billing information from Hyperbolic services.
"""

from collections import defaultdict
from datetime import datetime

from ..marketplace.models import InstanceHistoryResponse
from .models import (
    BillingPurchaseHistoryResponse,
)


def calculate_duration_seconds(start_time: str, end_time: str) -> float:
    """Calculate duration in seconds between two timestamps.

    Args:
        start_time: ISO format timestamp string.
        end_time: ISO format timestamp string.

    Returns:
        float: Duration in seconds.

    """
    start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    duration = end - start
    return duration.total_seconds()


def format_spend_history(instance_history: InstanceHistoryResponse) -> str:
    """Format spend history into a readable analysis.

    Args:
        instance_history: Instance history response with rental records.

    Returns:
        str: Formatted analysis string.

    """
    if not instance_history.instance_history:
        return "No rental history found."

    # Initialize analysis variables
    total_cost = 0
    gpu_stats = defaultdict(lambda: {"count": 0, "total_cost": 0, "total_seconds": 0})
    instances_summary = []

    # Analyze each instance
    for instance in instance_history.instance_history:
        duration_seconds = calculate_duration_seconds(instance.started_at, instance.terminated_at)
        # Convert seconds to hours for cost calculation
        duration_hours = duration_seconds / 3600.0
        # Calculate cost: (hours) * (cents/hour) / (100 cents/dollar)
        cost = (duration_hours * instance.price.amount) / 100.0
        total_cost += cost

        # Get GPU model and count
        gpu_model = instance.hardware.gpus[0].model if instance.hardware.gpus else "Unknown GPU"
        gpu_count = instance.gpu_count

        # Update GPU stats
        gpu_stats[gpu_model]["count"] += gpu_count
        gpu_stats[gpu_model]["total_cost"] += cost
        gpu_stats[gpu_model]["total_seconds"] += duration_seconds

        # Create instance summary
        instances_summary.append(
            {
                "name": instance.instance_name,
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


def format_purchase_history(purchases: BillingPurchaseHistoryResponse) -> str:
    """Format purchase history into a readable string.

    Args:
        purchases: Billing purchase history response.

    Returns:
        str: Formatted purchase history string.

    """
    if not purchases.purchase_history:
        return "No previous purchases found"

    output = ["Purchase History:"]
    for purchase in purchases.purchase_history:
        amount = float(purchase.amount) / 100  # Convert cents to dollars
        timestamp = datetime.fromisoformat(purchase.timestamp.replace("Z", "+00:00"))
        formatted_date = timestamp.strftime("%B %d, %Y")
        output.append(f"- ${amount:.2f} on {formatted_date}")

    return "\n".join(output)
