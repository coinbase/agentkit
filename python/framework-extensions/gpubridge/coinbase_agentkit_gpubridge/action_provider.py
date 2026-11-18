"""GPU-Bridge action provider for AgentKit.

Gives AgentKit agents access to GPU-Bridge's 30 AI services:
LLM inference, image generation, embeddings, STT, TTS, PDF parsing, and more.
"""

import time
import requests
from pydantic import BaseModel, Field
from coinbase_agentkit.action_providers.action_provider import Action, ActionProvider
from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.wallet_providers import WalletProvider

GPUBRIDGE_BASE = "https://api.gpubridge.io"


class LLMInput(BaseModel):
    prompt: str = Field(..., description="Prompt to send to the LLM")
    max_tokens: int = Field(default=512, description="Maximum tokens to generate")


class ImageInput(BaseModel):
    prompt: str = Field(..., description="Image generation prompt")
    width: int = Field(default=512, description="Image width in pixels")
    height: int = Field(default=512, description="Image height in pixels")


class EmbedInput(BaseModel):
    text: str = Field(..., description="Text to embed")


class TranscribeInput(BaseModel):
    audio_url: str = Field(..., description="URL of audio file to transcribe")


class GPUBridgeActionProvider(ActionProvider):
    """AgentKit action provider for GPU-Bridge GPU inference."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key
        super().__init__("gpu-bridge", [])

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def _run(self, service: str, input_data: dict) -> dict:
        resp = requests.post(
            f"{GPUBRIDGE_BASE}/run",
            json={"service": service, "input": input_data},
            headers=self._headers(),
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("error"):
            raise ValueError(f"GPU-Bridge error: {data['error']}")
        # Poll if async
        if data.get("status") == "pending" and data.get("status_url"):
            for _ in range(30):
                time.sleep(1)
                r2 = requests.get(
                    f"{GPUBRIDGE_BASE}{data['status_url']}",
                    headers=self._headers(), timeout=10
                )
                d2 = r2.json()
                if d2.get("status") == "completed":
                    return d2
            raise TimeoutError("GPU-Bridge job timed out")
        return data

    @create_action(
        name="gpu_bridge_llm",
        description="Run LLM inference on GPU-Bridge. Use for text generation, summarization, Q&A, and reasoning tasks.",
        args_schema=LLMInput,
    )
    def run_llm(self, wallet_provider: WalletProvider, args: dict) -> str:
        data = self._run("llm-4090", {"prompt": args["prompt"], "max_tokens": args.get("max_tokens", 512)})
        return data.get("output", {}).get("text", str(data))

    @create_action(
        name="gpu_bridge_image",
        description="Generate an image from a text prompt using GPU-Bridge (FLUX/Stable Diffusion).",
        args_schema=ImageInput,
    )
    def generate_image(self, wallet_provider: WalletProvider, args: dict) -> str:
        data = self._run("image-4090", {
            "prompt": args["prompt"],
            "width": args.get("width", 512),
            "height": args.get("height", 512),
        })
        url = data.get("output", {}).get("url", "")
        return f"Image generated: {url}" if url else str(data)

    @create_action(
        name="gpu_bridge_embed",
        description="Get text embeddings from GPU-Bridge for semantic search or similarity.",
        args_schema=EmbedInput,
    )
    def get_embedding(self, wallet_provider: WalletProvider, args: dict) -> str:
        data = self._run("embedding-l4", {"texts": [args["text"]]})
        embedding = data.get("output", {}).get("embedding", [])
        return f"Embedding generated: {len(embedding)} dimensions"

    @create_action(
        name="gpu_bridge_transcribe",
        description="Transcribe audio to text using Whisper on GPU-Bridge.",
        args_schema=TranscribeInput,
    )
    def transcribe(self, wallet_provider: WalletProvider, args: dict) -> str:
        data = self._run("whisper-l4", {"audio_url": args["audio_url"]})
        return data.get("output", {}).get("text", str(data))

    def get_actions(self, wallet_provider: WalletProvider) -> list[Action]:
        return super().get_actions(wallet_provider)


def gpu_bridge_action_provider(api_key: str | None = None) -> GPUBridgeActionProvider:
    """Create a GPU-Bridge action provider instance."""
    return GPUBridgeActionProvider(api_key=api_key)
