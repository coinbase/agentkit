"""Schemas for OpenGradient action provider."""

from pydantic import BaseModel, Field


class OpenGradientEthUsdtOneHourVolatilityForecast(BaseModel):
    """Input schema for OpenGradient 1 hour ETH/USDT volatility forecast from real-time workflow.

    More information at https://hub.opengradient.ai/models/OpenGradient/og-1hr-volatility-ethusdt
    """


class OpenGradientBtcOneHourForecast(BaseModel):
    """Input schema for OpenGradient 1 hour BTC price forecast from real-time workflow.

    More information at https://hub.opengradient.ai/models/OpenGradient/og-btc-1hr-forecast
    """


class OpenGradientEthOneHourForecast(BaseModel):
    """Input schema for OpenGradient 1 hour ETH price forecast from real-time workflow.

    More information at https://hub.opengradient.ai/models/OpenGradient/og-eth-1hr-forecast
    """


class OpenGradientSolOneHourForecast(BaseModel):
    """Input schema for OpenGradient 1 hour SOL price forecast from real-time workflow.

    More information at https://hub.opengradient.ai/models/OpenGradient/og-sol-1hr-forecast
    """


class OpenGradientPromptDobby(BaseModel):
    """Input schema for prompting the OpenGradient hosted Dobby-Unhinged LLM."""

    prompt: str = Field(..., description="The prompt that you are asking the Dobby model")


class OpenGradientPromptQwen(BaseModel):
    """Input schema for prompting the OpenGradient hosted Qwen-2.5-70B LLM."""

    prompt: str = Field(..., description="The prompt that you are asking the Qwen model")
