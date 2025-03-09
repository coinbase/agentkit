"""Pydantic models for Hyperbolic API requests and responses."""

from typing import Any

from pydantic import BaseModel, Field, field_validator

from .constants import (
    SUPPORTED_AUDIO_LANGUAGES,
    SUPPORTED_AUDIO_SPEAKERS,
    SUPPORTED_MESSAGE_ROLES,
)


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., description="The role of the message sender")
    content: str = Field(..., description="The content of the message")

    @classmethod
    @field_validator("role")
    def validate_role(cls, v):
        """Validate that the role is supported."""
        if v not in SUPPORTED_MESSAGE_ROLES:
            raise ValueError(f"Role must be one of {SUPPORTED_MESSAGE_ROLES}")
        return v


class ChatCompletionRequest(BaseModel):
    """Request model for chat completion API."""

    messages: list[ChatMessage] = Field(..., description="List of chat messages")
    model: str = Field(..., description="The model to use for completion")
    frequency_penalty: float | None = Field(
        None, description="Penalty for token frequency", ge=0.0, le=1.0
    )
    logit_bias: dict[str, float] | None = Field(None, description="Token bias mapping")
    logprobs: int | None = Field(None, description="Number of log probabilities to return")
    top_logprobs: int | None = Field(
        None, description="Number of most likely tokens to return", ge=0, le=20
    )
    max_tokens: int | None = Field(None, description="Maximum number of tokens to generate")
    n: int | None = Field(None, description="Number of completions to generate")
    presence_penalty: float | None = Field(
        None, description="Penalty for token presence", ge=0.0, le=1.0
    )
    seed: int | None = Field(None, description="Random seed for generation")
    stop: list[str] | None = Field(None, description="Sequences where the API will stop generating")
    stream: bool | None = Field(False, description="Whether to stream the response")
    temperature: float | None = Field(None, description="Sampling temperature", ge=0.0, le=2.0)
    top_p: float | None = Field(None, description="Nucleus sampling threshold", ge=0.0, le=1.0)
    user: str | None = Field(None, description="Unique identifier for the end-user")
    top_k: int | None = Field(None, description="Number of top tokens to consider")
    min_p: float | None = Field(
        None, description="Minimum token probability threshold", ge=0.0, le=1.0
    )
    repetition_penalty: float | None = Field(
        None, description="Penalty for token repetition", ge=0.0
    )


class ChatCompletionResponseMessage(BaseModel):
    """A message in the chat completion response."""

    role: str = Field(..., description="The role of the message sender")
    content: str = Field(..., description="The content of the message")

    @classmethod
    @field_validator("role")
    def validate_role(cls, v):
        """Validate that the role is supported."""
        if v != "assistant":
            raise ValueError("Role must be 'assistant'")
        return v


class ChatCompletionResponseChoice(BaseModel):
    """A single choice in the chat completion response."""

    index: int = Field(..., description="Index of this choice")
    message: ChatCompletionResponseMessage = Field(..., description="The message content")
    finish_reason: str | None = Field(None, description="Reason for finishing")


class ChatCompletionResponseUsage(BaseModel):
    """Token usage information."""

    prompt_tokens: int = Field(..., description="Number of tokens in the prompt")
    completion_tokens: int = Field(..., description="Number of tokens in the completion")
    total_tokens: int = Field(..., description="Total number of tokens used")


class ChatCompletionResponse(BaseModel):
    """Response model for chat completion API."""

    id: str = Field(..., description="Unique identifier for this completion")
    object: str = Field(..., description="Object type")
    created: int = Field(..., description="Unix timestamp of creation")
    model: str = Field(..., description="Model used for completion")
    choices: list[ChatCompletionResponseChoice] = Field(
        ..., description="List of completion choices"
    )
    usage: ChatCompletionResponseUsage | None = Field(None, description="Token usage information")


class ImageGenerationRequest(BaseModel):
    """Request model for image generation API."""

    prompt: str = Field(..., description="The text description of the image to generate")
    model_name: str = Field(..., description="The name of Stable Diffusion model to use")
    height: int = Field(..., description="Height of the image to generate")
    width: int = Field(..., description="Width of the image to generate")
    backend: str = Field("auto", description="Computational backend for the model")
    negative_prompt: str | None = Field(
        None, description="Text specifying what the model should not generate"
    )
    num_images: int = Field(1, description="Number of images to generate")
    steps: int = Field(30, description="Number of inference steps")
    seed: int | None = Field(None, description="Random seed for reproducibility")
    cfg_scale: float | None = Field(
        None, description="Guidance scale for image relevance to prompt"
    )
    style_preset: str | None = Field(
        None, description="Topic to guide the image model towards a particular style"
    )
    enable_refiner: bool = Field(False, description="Enable Stable Diffusion XL-refiner")
    controlnet_name: str | None = Field(None, description="Name of ControlNet to use")
    controlnet_image: str | None = Field(
        None, description="Base64 encoded image for ControlNet input"
    )
    loras: dict[str, float] | None = Field(None, description="Pairs of lora name and weight")


class ImageMetadata(BaseModel):
    """Metadata for a generated image."""

    seed: int | None = Field(None, description="The seed used for generation")
    prompt: str | None = Field(None, description="The prompt used for generation")
    negative_prompt: str | None = Field(None, description="The negative prompt used")
    cfg_scale: float | None = Field(None, description="The guidance scale used")
    steps: int | None = Field(None, description="Number of inference steps used")


class GeneratedImage(BaseModel):
    """A single generated image with its metadata."""

    image: str = Field(..., description="Base64 encoded image data")
    random_seed: int = Field(..., description="Random seed used for generation")
    index: int = Field(..., description="Index of the image in batch")


class ImageGenerationResponse(BaseModel):
    """Response model for image generation API."""

    images: list[GeneratedImage] = Field(..., description="List of generated images")
    inference_time: float | None = Field(None, description="Time taken for inference in seconds")


class AudioGenerationRequest(BaseModel):
    """Request model for audio generation API."""

    text: str = Field(..., description="Text input to convert to speech")
    language: str | None = Field(None, description="Language code for text-to-speech")
    speaker: str | None = Field(
        None, description="Specific speaker voice for the selected language"
    )
    sdp_ratio: float | None = Field(None, description="SDP ratio parameter", ge=0.0, le=1.0)
    noise_scale: float | None = Field(None, description="Noise scale parameter", ge=0.0, le=1.0)
    noise_scale_w: float | None = Field(None, description="Noise scale w parameter", ge=0.0, le=1.0)
    speed: float | None = Field(None, description="Speech speed multiplier", ge=0.1, le=5.0)

    @classmethod
    @field_validator("language")
    def validate_language(cls, v):
        """Validate that the language is supported."""
        if v is not None and v not in SUPPORTED_AUDIO_LANGUAGES:
            raise ValueError(f"Language must be one of {SUPPORTED_AUDIO_LANGUAGES}")
        return v

    @classmethod
    @field_validator("speaker")
    def validate_speaker(cls, v, values):
        """Validate that the speaker is valid for the selected language."""
        if v is None or "language" not in values:
            return v

        language = values["language"]
        valid_speakers = SUPPORTED_AUDIO_SPEAKERS

        if language in valid_speakers and v not in valid_speakers[language]:
            raise ValueError(
                f"Invalid speaker '{v}' for language '{language}'. Valid speakers: {valid_speakers[language]}"
            )

        return v


class AudioGenerationResponse(BaseModel):
    """Response model for audio generation API."""

    audio: str = Field(..., description="Base64 encoded audio data in MP3 format")
    duration: float | None = Field(None, description="Duration of the generated audio in seconds")


# Marketplace Models
class GpuHardware(BaseModel):
    """GPU hardware information."""

    hardware_type: str = Field("gpu", description="Type of hardware")
    model: str = Field(..., description="GPU model name")
    clock_speed: float | None = Field(None, description="GPU clock speed")
    compute_power: float | None = Field(None, description="GPU compute power")
    ram: float | None = Field(None, description="GPU RAM in GB")
    interface: str | None = Field(None, description="GPU interface type")


class CpuHardware(BaseModel):
    """CPU hardware information."""

    hardware_type: str = Field("cpu", description="Type of hardware")
    model: str = Field(..., description="CPU model name")
    cores: int | None = Field(None, description="Number of physical cores")
    virtual_cores: int = Field(..., description="Number of virtual cores")


class StorageHardware(BaseModel):
    """Storage hardware information."""

    hardware_type: str = Field(
        None, description="Type of hardware"
    )  # Can be "storage" or "hardwaretype_unknown"
    capacity: float = Field(..., description="Storage capacity")


class RamHardware(BaseModel):
    """RAM hardware information."""

    hardware_type: str = Field("ram", description="Type of hardware")
    capacity: float = Field(..., description="RAM capacity")


class HardwareInfo(BaseModel):
    """Complete hardware information."""

    cpus: list[CpuHardware] | None = Field(None, description="List of CPU specifications")
    gpus: list[GpuHardware] = Field(..., description="List of GPU specifications")
    storage: list[StorageHardware] | None = Field(
        None, description="List of storage specifications"
    )
    ram: list[RamHardware] | None = Field(None, description="List of RAM specifications")


class NestedGpuHardware(BaseModel):
    """GPU hardware information for nested instances."""

    hardware_type: str = Field("gpu", description="Type of hardware")
    model: str = Field(..., description="GPU model name")
    ram: float | None = Field(None, description="GPU RAM in GB")


class NestedStorageHardware(BaseModel):
    """Storage hardware information for nested instances."""

    hardware_type: str = Field(None, description="Type of hardware")
    capacity: float = Field(..., description="Storage capacity")


class NestedHardwareComponent(BaseModel):
    """A single hardware component in the nested structure."""

    gpu: NestedGpuHardware | None = Field(None, description="GPU hardware if present")
    storage: NestedStorageHardware | None = Field(None, description="Storage hardware if present")


class Location(BaseModel):
    """Location information."""

    region: str | None = Field(None, description="Geographic region")


class Price(BaseModel):
    """Price information."""

    amount: float = Field(..., description="Price amount")
    period: str = Field(..., description="Pricing period (e.g., 'hourly')")
    agent: str | None = Field(None, description="Pricing agent")


class PricingInfo(BaseModel):
    """Pricing information for an instance."""

    price: Price = Field(..., description="Price details")


class NestedInstance(BaseModel):
    """Instance information in nested format."""

    id: str = Field(..., description="Instance identifier")
    status: str = Field(..., description="Instance status")
    hardware: list[NestedHardwareComponent] = Field(..., description="List of hardware components")


class NodeInstance(BaseModel):
    """Top-level node information."""

    id: str = Field(..., description="Instance identifier")
    status: str = Field(..., description="Instance status")
    hardware: HardwareInfo = Field(..., description="Hardware specifications")
    location: Location | None = Field(None, description="Location information")
    instances: list[NestedInstance] = Field(
        default_factory=list, description="List of nested instances"
    )
    network: dict[str, Any] = Field(default_factory=dict, description="Network configuration")
    gpus_total: int | None = Field(None, description="Total number of GPUs")
    gpus_reserved: int | None = Field(None, description="Number of reserved GPUs")
    has_persistent_storage: bool | None = Field(
        None, description="Whether persistent storage is available"
    )
    supplier_id: str | None = Field(None, description="Supplier identifier")
    pricing: PricingInfo | None = Field(None, description="Pricing information")
    reserved: bool | None = Field(None, description="Whether the instance is reserved")
    cluster_name: str | None = Field(None, description="Cluster name")
    owner: str | None = Field(None, description="Owner identifier")
    gpu_count: int | None = Field(None, description="Number of GPUs allocated")


class AvailableInstance(NodeInstance):
    """Available instance information."""

    pass


class AvailableInstancesResponse(BaseModel):
    """Response for available instances."""

    instances: list[AvailableInstance] = Field(..., description="List of available instances")


class NodeRental(BaseModel):
    """Record of a rented compute node."""

    id: str = Field(..., description="Instance identifier")
    start: str | None = Field(None, description="Start time of the rental")
    end: str | None = Field(None, description="End time of the rental")
    instance: NodeInstance = Field(..., description="Full node details")
    ssh_command: str | None = Field(None, description="SSH command to access the node")

    @property
    def status(self) -> str:
        """Get the node status from the nested instance."""
        return self.instance.status


class TerminateInstanceRequest(BaseModel):
    """Request to terminate an instance."""

    id: str = Field(..., description="ID of the instance to terminate")


class TerminateInstanceResponse(BaseModel):
    """Response from terminate instance API endpoint."""

    status: str = Field(..., description="Response status")
    message: str | None = Field(None, description="Optional response message")


class InstanceHistoryEntry(BaseModel):
    """Instance history entry."""

    instance_name: str = Field(..., description="Name of the instance")
    started_at: str = Field(..., description="Start time in ISO format")
    terminated_at: str = Field(..., description="Termination time in ISO format")
    price: Price = Field(..., description="Price information")
    hardware: HardwareInfo = Field(..., description="Hardware specifications")
    gpu_count: int = Field(..., description="Number of GPUs")


class InstanceHistoryResponse(BaseModel):
    """Response for instance history."""

    instance_history: list[InstanceHistoryEntry] = Field(
        ..., description="List of instance history entries"
    )


class ContainerImage(BaseModel):
    """Container image configuration."""

    name: str = Field(..., description="Name of the container image")
    tag: str = Field(..., description="Tag of the container image")
    port: int = Field(..., description="Port to expose")


class RentInstanceRequest(BaseModel):
    """Request to rent an instance."""

    cluster_name: str = Field(..., description="Name of the cluster to create instance in")
    node_name: str = Field(..., description="Name of the node")
    gpu_count: int = Field(..., description="Number of GPUs to allocate")
    image: ContainerImage | None = Field(None, description="Optional container configuration")


class RentInstanceResponse(BaseModel):
    """Response from rent instance API endpoint."""

    status: str = Field(..., description="Response status")
    instance_name: str | None = Field(None, description="Instance name (e.g. 'actual-bonsai-frog')")


class RentedInstancesResponse(BaseModel):
    """Response for rented instances."""

    instances: list[NodeRental] = Field(..., description="List of rented nodes")


class BillingBalanceResponse(BaseModel):
    """Response model for billing balance API."""

    credits: int | str = Field(..., description="Current balance in credits/USD")


class BillingPurchaseHistoryEntry(BaseModel):
    """A single entry in the purchase history."""

    amount: str = Field(..., description="Purchase amount in USD")
    timestamp: str = Field(..., description="ISO format timestamp of the purchase")
    source: str = Field(..., description="Source of the purchase")


class BillingPurchaseHistoryResponse(BaseModel):
    """Response model for billing purchase history API."""

    purchase_history: list[BillingPurchaseHistoryEntry] = Field(
        ..., description="List of purchase history entries"
    )
