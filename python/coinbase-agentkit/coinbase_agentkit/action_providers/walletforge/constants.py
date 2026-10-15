"""Constants for the WalletForge x402 action provider."""

DEFAULT_BASE_URL = "https://api.walletforge.app"
DEFAULT_NETWORK = "eip155:8453"
DEFAULT_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
DEFAULT_PAY_TO = "0xb5F5a86Df5F78ed78920f74a1D7f26368F708E94"
DEFAULT_FACILITATOR = "https://facilitator.payai.network"

# Atomic USDC amounts (6 decimals)
AMOUNT_NORMALIZE = "10000"  # 0.01 USDC
AMOUNT_FETCH_MARKDOWN = "50000"  # 0.05 USDC

FETCH_MARKDOWN_PATH = "/v1/fetch-markdown"
NORMALIZE_PATH = "/v1/normalize"

SUPPORTED_NETWORK_IDS = {"base-mainnet", "base"}
SUPPORTED_CHAIN_IDS = {"8453"}
