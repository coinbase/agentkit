"""Constants for Token Verdict action provider."""

# The live Token Verdict service (https://github.com/QuincyGB/token-verdict).
TOKEN_VERDICT_BASE_URL = "https://token-verdict-production.up.railway.app"
TOKEN_VERDICT_PATH = "/v1/verdict"

# The service's known price. Also the default spend-guard cap: the provider
# never signs a payment above this amount for a single verdict.
TOKEN_VERDICT_PRICE = "$0.02"

# Payment always settles in USDC on Base, whichever chain's token is analyzed.
BASE_NETWORK = "eip155:8453"
BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
USDC_DECIMALS = 6
