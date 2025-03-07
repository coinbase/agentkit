"""Constants for Hyperbolic API integration."""

# API Configuration
API_BASE_URL = "https://api.hyperbolic.xyz"
API_VERSION = "v1"

# Default request headers
DEFAULT_HEADERS = {
    "Content-Type": "application/json",
}

# Base URLs for services
MARKETPLACE_BASE_URL = f"{API_BASE_URL}/{API_VERSION}/marketplace"
AI_SERVICES_BASE_URL = f"{API_BASE_URL}/{API_VERSION}"
BILLING_BASE_URL = f"{API_BASE_URL}/billing"
SETTINGS_BASE_URL = f"{API_BASE_URL}/settings"

# API Endpoint paths
MARKETPLACE_ENDPOINTS = {
    "LIST_INSTANCES": "",
    "CREATE_INSTANCE": "/instances/create",
    "LIST_USER_INSTANCES": "/instances",
    "INSTANCE_HISTORY": "/instances/history",
    "TERMINATE_INSTANCE": "/instances/terminate",
}

AI_SERVICES_ENDPOINTS = {
    "TEXT_GENERATION": "/chat/completions",
    "IMAGE_GENERATION": "/image/generation",
    "AUDIO_GENERATION": "/audio/generation",
}

BILLING_ENDPOINTS = {
    "GET_BALANCE": "/get_current_balance",
    "PURCHASE_HISTORY": "/purchase_history",
}

SETTINGS_ENDPOINTS = {
    "LINK_WALLET": "/crypto-address",
}

# Supported image models
SUPPORTED_IMAGE_MODELS = [
    "SDXL1.0-base",  # Stable Diffusion XL 1.0
    "SD2",  # Stable Diffusion v2
    "SD1.5",  # Stable Diffusion v1-5
    "SSD",  # Segmind Stable Diffusion 1B
    "SDXL-turbo",  # SDXL-Turbo
    "SDXL-ControlNet",  # SDXL1.0-base + ControlNet
    "SD1.5-ControlNet",  # SD1.5 + ControlNet
]

# Supported message roles
SUPPORTED_MESSAGE_ROLES = ["system", "assistant", "user"]

# Supported audio languages
SUPPORTED_AUDIO_LANGUAGES = ["EN", "ES", "FR", "ZH", "JP", "KR"]

# Audio speakers by language
SUPPORTED_AUDIO_SPEAKERS = {
    "EN": ["EN-US", "EN-BR", "EN-INDIA", "EN-AU"],
    "ES": ["ES"],
    "FR": ["FR"],
    "ZH": ["ZH"],
    "JP": ["JP"],
    "KR": ["KR"],
}
