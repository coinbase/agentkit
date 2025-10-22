"""Utility functions for Hyperbolic billing services.

This module provides utility functions for formatting and processing
billing information from Hyperbolic services.
"""

from collections import defaultdict
from datetime import datetime

from ..marketplace.types import InstanceHistoryResponse
from .types import (
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
    if not start_time or not end_time:
        return 0.0

    start = datetime.fromisoformat(
        start_time.replace("Z", "+00:00") if "Z" in start_time else start_time
    )
    end = datetime.fromisoformat(end_time.replace("Z", "+00:00") if "Z" in end_time else end_time)
    duration = end - start

    return duration.total_seconds()


def format_purchase_history(purchases: BillingPurchaseHistoryResponse, limit: int = 5) -> str:
    """Format purchase history into a readable string.

    Args:
        purchases: Billing purchase history response.
        limit: Maximum number of purchase records to include in the output.

    Returns:
        str: Formatted purchase history string.

    """
    if not purchases.purchase_history:
        return "No previous purchases found"

    output = [f"Purchase History (showing {limit} most recent):"]

    for purchase in purchases.purchase_history[:limit]:
        amount = float(purchase.amount) / 100
        timestamp = datetime.fromisoformat(purchase.timestamp.replace("Z", "+00:00"))
        formatted_date = timestamp.strftime("%B %d, %Y")
        output.append(f"- ${amount:.2f} on {formatted_date}")

    return "\n".join(output)


def format_spend_history(instance_history: InstanceHistoryResponse, limit: int = 5) -> str:
    """Format spend history into a readable analysis.

    Args:
        instance_history: Instance history response with rental records.
        limit: Maximum number of spend records to include in the output.

    Returns:
        str: Formatted analysis string.

    """
    if not instance_history.instance_history:
        return "No rental history found."

    total_cost = 0
    gpu_stats = defaultdict(lambda: {"count": 0, "total_cost": 0, "total_seconds": 0})

    instances_summary = []

    for instance in instance_history.instance_history:
        has_complete_time_data = instance.started_at and instance.terminated_at

        duration_seconds = 0
        duration_hours = 0
        cost = 0

        if has_complete_time_data:
            duration_seconds = calculate_duration_seconds(
                instance.started_at, instance.terminated_at
            )
            duration_hours = duration_seconds / 3600.0
            cost = (duration_hours * instance.price.amount) / 100.0
            total_cost += cost

        gpu_models = []
        if instance.hardware and instance.hardware.gpus and len(instance.hardware.gpus) > 0:
            gpu_models = [gpu.model for gpu in instance.hardware.gpus if gpu.model]

        gpu_model = ", ".join(gpu_models) if gpu_models else "Unknown GPU"
        gpu_count = instance.gpu_count or 0

        if has_complete_time_data:
            if gpu_models:
                gpu_count_per_model = gpu_count / len(gpu_models) if len(gpu_models) > 0 else 0
                cost_per_model = cost / len(gpu_models) if len(gpu_models) > 0 else 0

                for model in gpu_models:
                    gpu_stats[model]["count"] += gpu_count_per_model
                    gpu_stats[model]["total_cost"] += cost_per_model
                    gpu_stats[model]["total_seconds"] += duration_seconds
            else:
                gpu_stats["Unknown GPU"]["count"] += gpu_count
                gpu_stats["Unknown GPU"]["total_cost"] += cost
                gpu_stats["Unknown GPU"]["total_seconds"] += duration_seconds

        summary = {
            "name": instance.instance_name or "unnamed-instance",
            "gpu_model": gpu_model,
            "gpu_count": gpu_count,
            "duration_seconds": int(duration_seconds) if has_complete_time_data else None,
            "cost": round(cost, 2) if has_complete_time_data else None,
            "has_complete_time_data": has_complete_time_data,
        }
        instances_summary.append(summary)

    output = ["=== GPU Rental Spending Analysis ===\n"]

    output.append(f"Instance Rentals (showing {min(len(instances_summary), limit)} most recent):")
    for instance in instances_summary[:limit]:
        output.append(f"- {instance['name']}:")
        output.append(f"  GPU: {instance['gpu_model']} (Count: {instance['gpu_count']})")

        if instance["has_complete_time_data"]:
            output.append(f"  Duration: {instance['duration_seconds']} seconds")
            output.append(f"  Cost: ${instance['cost']:.2f}")
        else:
            output.append("  Duration: Unavailable (missing timestamp data)")
            output.append("  Cost: Unavailable")

    if gpu_stats:
        output.append(f"\nGPU Type Statistics (showing {min(len(gpu_stats), limit)} most recent):")
        for gpu_model, stats in list(gpu_stats.items())[:limit]:
            output.append(f"\n{gpu_model}:")
            output.append(f"  Total Rentals: {stats['count']}")
            output.append(f"  Total Time: {int(stats['total_seconds'])} seconds")
            output.append(f"  Total Cost: ${stats['total_cost']:.2f}")

        output.append(f"\nTotal Spending: ${total_cost:.2f}")
    else:
        output.append("\nNo complete rental data available to calculate statistics.")

    return "\n".join(output)
