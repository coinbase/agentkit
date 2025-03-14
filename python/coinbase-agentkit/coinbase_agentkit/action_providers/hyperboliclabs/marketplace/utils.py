"""Utility functions for Hyperbolic Marketplace action provider."""

import os

from .types import (
    AvailableInstance,
    NodeRental,
    RentInstanceResponse,
    TerminateInstanceResponse,
)


def get_api_key() -> str:
    """Get Hyperbolic API key from environment variables.

    Returns:
        str: The API key.

    Raises:
        ValueError: If API key is not configured.

    """
    api_key = os.getenv("HYPERBOLIC_API_KEY")
    if not api_key:
        raise ValueError("HYPERBOLIC_API_KEY is not configured.")
    return api_key


def format_gpu_instance(instance: AvailableInstance) -> str | None:
    """Format a single GPU instance into a readable string.

    Args:
        instance: AvailableInstance object containing instance details.

    Returns:
        str | None: Formatted string if instance has available GPUs, None otherwise.

    """
    if instance.reserved:
        return None

    cluster_name = instance.cluster_name or "Unknown Cluster"
    node_id = instance.id

    gpus = instance.hardware.gpus
    gpu_model = gpus[0].model if gpus else "Unknown Model"

    price_amount = instance.pricing.price.amount / 100 if instance.pricing else 0

    gpus_total = instance.gpus_total or 0
    gpus_reserved = instance.gpus_reserved or 0
    gpus_available = gpus_total - gpus_reserved

    if gpus_available <= 0:
        return None

    return (
        f"Cluster: {cluster_name}\n"
        f"Node ID: {node_id}\n"
        f"GPU Model: {gpu_model}\n"
        f"Available GPUs: {gpus_available}/{gpus_total}\n"
        f"Price: ${price_amount:.2f}/hour per GPU\n"
        f"{'-' * 40}\n\n"
    )


def format_gpu_types(instances: list[AvailableInstance]) -> str:
    """Format a list of available GPU types/models.

    Args:
        instances: List of AvailableInstance objects.

    Returns:
        str: Formatted string with available GPU types.

    """
    gpu_models = set()

    for instance in instances:
        if instance.reserved:
            continue

        gpus_total = instance.gpus_total or 0
        gpus_reserved = instance.gpus_reserved or 0
        gpus_available = gpus_total - gpus_reserved

        if gpus_available <= 0:
            continue

        gpus = instance.hardware.gpus
        if gpus:
            gpu_models.add(gpus[0].model)

    if not gpu_models:
        return "No available GPU types found."

    gpu_models_list = sorted(gpu_models)
    formatted_models = "\n".join([f"- {model}" for model in gpu_models_list])
    return f"Available GPU Types:\n{formatted_models}"


def format_gpu_instances_by_type(instances: list[AvailableInstance], gpu_model: str) -> str:
    """Format a list of available GPU instances of a specific model.

    Args:
        instances: List of AvailableInstance objects.
        gpu_model: The specific GPU model to filter by.

    Returns:
        str: Formatted string with available GPU instances of the specified model.

    """
    formatted_instances = []

    for instance in instances:
        if instance.reserved:
            continue

        gpus = instance.hardware.gpus
        instance_gpu_model = gpus[0].model if gpus else "Unknown Model"

        if instance_gpu_model != gpu_model:
            continue

        gpus_total = instance.gpus_total or 0
        gpus_reserved = instance.gpus_reserved or 0
        gpus_available = gpus_total - gpus_reserved

        if gpus_available <= 0:
            continue

        formatted = format_gpu_instance(instance)
        if formatted is not None:
            formatted_instances.append(formatted)

    if not formatted_instances:
        return f"No available GPU instances with the model '{gpu_model}' found."

    return f"Available {gpu_model} GPU Options:\n\n" + "\n".join(formatted_instances)


def format_all_gpu_instances(instances: list[AvailableInstance]) -> str:
    """Format a list of all available GPU instances.

    Args:
        instances: List of AvailableInstance objects.

    Returns:
        str: Formatted string with all available GPU instances.

    """
    formatted_instances = []

    for instance in instances:
        formatted = format_gpu_instance(instance)
        if formatted is not None:
            formatted_instances.append(formatted)

    if not formatted_instances:
        return "No available GPU instances with free resources found."

    return "Available GPU Options:\n\n" + "\n".join(formatted_instances)


def format_gpu_status(instance: NodeRental) -> str:
    """Format a rented GPU instance status into a readable string.

    Args:
        instance: NodeRental object containing instance details.

    Returns:
        str: Formatted status string.

    """
    instance_id = instance.id
    status = instance.status
    status_detail = ""

    gpus = instance.instance.hardware.gpus

    gpu_model = "Unknown Model"
    if gpus:
        gpu_model = gpus[0].model

    gpu_count = instance.instance.gpu_count or (len(gpus) if gpus else 1)

    gpu_memory = None
    if gpus and gpus[0].ram:
        ram_gb = gpus[0].ram / 1024
        gpu_memory = f"{ram_gb:.1f} GB"

    ssh_command = instance.ssh_command

    output = [f"Instance ID: {instance_id}"]

    if status.lower() == "running":
        output.append(f"Status: {status} (Ready to use)")
    elif status.lower() == "starting":
        output.append(f"Status: {status} (Still initializing)")
    elif status.lower() == "terminated":
        output.append(f"Status: {status} (No longer available)")
    elif status.lower() == "unknown":
        output.append(f"Status: {status} (Instance is still being provisioned)")
    elif status.lower() == "online":
        output.append("Status: running (Ready to use)")
    else:
        output.append(f"Status: {status}")

    if status_detail:
        output.append(f"Status Detail: {status_detail}")

    output.append(f"GPU Model: {gpu_model}")
    if gpu_count > 0:
        output.append(f"GPU Count: {gpu_count}")
    if gpu_memory:
        output.append(f"GPU Memory: {gpu_memory}")

    if ssh_command:
        output.append(f"SSH Command: {ssh_command}")
    elif instance.ssh_access:
        key_path = instance.ssh_access.key_path or "~/.ssh/id_rsa"
        constructed_ssh_cmd = (
            f"ssh {instance.ssh_access.username}@{instance.ssh_access.host} -i {key_path}"
        )
        output.append(f"SSH Command: {constructed_ssh_cmd}")
    else:
        if status.lower() in ["running", "online"]:
            output.append(
                "SSH Command: Not available yet. Instance is running but SSH details are not provided."
            )
            output.append(
                "Try again in a few seconds or check the Hyperbolic dashboard for SSH details."
            )
        else:
            output.append("SSH Command: Not available yet. Instance is still being provisioned.")

            if status.lower() == "starting":
                output.append("The instance is starting up. Please check again in a few seconds.")
            elif status.lower() == "unknown":
                output.append(
                    "The instance status is unknown. Please check again in 30-60 seconds."
                )
            else:
                output.append(f"Current status: {status}. Check again when status is 'running'.")

    output.append("-" * 40)
    output.append("")

    result = "\n".join(output)

    return result


def format_rent_compute_response(response_data: RentInstanceResponse) -> str:
    """Format compute rental response into a readable string.

    Args:
        response_data: RentInstanceResponse object from compute rental API.

    Returns:
        str: Formatted response string with next steps.

    """
    formatted_response = response_data.model_dump_json(indent=2)

    next_steps = (
        "\nNext Steps:\n"
        "1. Your GPU instance is being provisioned\n"
        "2. Use get_gpu_status to check when it's ready\n"
        "3. Once status is 'running', you can:\n"
        "   - Connect via SSH using the provided command\n"
        "   - Run commands using remote_shell\n"
        "   - Install packages and set up your environment"
    )

    return f"{formatted_response}\n{next_steps}"


def format_terminate_compute_response(response_data: TerminateInstanceResponse) -> str:
    """Format compute termination response into a readable string.

    Args:
        response_data: TerminateInstanceResponse object from compute termination API.

    Returns:
        str: Formatted response string with next steps.

    """
    if response_data.error_code is not None or (
        response_data.status and response_data.status.lower() != "success"
    ):
        error_msg = f"Error terminating compute: {response_data.message}"
        return error_msg

    formatted_response = response_data.model_dump_json(indent=2)

    next_steps = (
        "\nNext Steps:\n"
        "1. Your GPU instance has been terminated\n"
        "2. Any active SSH connections have been closed\n"
        "3. You can check your spend history with get_spend_history\n"
        "4. To rent a new instance, use get_available_gpus and rent_compute"
    )
    return f"{formatted_response}\n{next_steps}"
