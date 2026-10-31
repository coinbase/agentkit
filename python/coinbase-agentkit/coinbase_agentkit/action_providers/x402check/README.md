# X402check Action Provider (Python)

Trust-preflight x402 seller URLs before an agent pays them, using [x402check](https://x402check.dev).

## Usage

```python
from coinbase_agentkit import x402check_action_provider

provider = x402check_action_provider(
    # optional; defaults to https://x402check.dev or X402CHECK_URL
    base_url="https://x402check.dev",
    # supply a prior PAYMENT-SIGNATURE for the $0.002 Exact USDC Base charge
    payment_headers={"PAYMENT-SIGNATURE": "..."},
)
```

## Actions

- `preflight_check` — trust-check one seller URL (`ok|caution|avoid` + history)
- `verify_payto` — same billing; focus on receiving wallet + `payToChanges`

## Env

- `X402CHECK_URL` — override origin
- `X402CHECK_SKIP=1` — synthetic ok (tests)

## Links

- https://x402check.dev/docs
- Related: coinbase/agentkit#1402, #1454
