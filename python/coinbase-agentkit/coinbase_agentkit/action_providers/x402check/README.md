# X402check Action Provider (Python)

Trust-preflight x402 seller URLs before an agent pays them, using [x402check](https://x402check.dev).

Each check returns `ok | caution | avoid` plus that tool's history (uptime, `payTo` / price drift). Endpoint + history only — not wallet OFAC / drainer / simulation.

x402check is a strong fit for the neutral `beforePayment` seat in [#1454](https://github.com/coinbase/agentkit/pull/1454): it probes the seller's **live 402** (price, network, `payTo`) and compares those against that URL's history, including **payTo-change detection**.

## Usage

```python
from coinbase_agentkit import x402check_action_provider, create_x402check_before_payment

provider = x402check_action_provider(
    # optional; defaults to https://x402check.dev or X402CHECK_URL
    base_url="https://x402check.dev",
    # supply a prior PAYMENT-SIGNATURE for the $0.002 Exact USDC Base charge
    payment_headers={"PAYMENT-SIGNATURE": "..."},
)

# One-line drop-in for the #1454 beforePayment seat:
before_payment = create_x402check_before_payment()
```

`create_x402check_before_payment` returns the exact `#1454` decision shape `{abort, reason?, code?}` (no extra fields). Context/decision types are defined locally so the helper works **before #1454 merges**.

### Policy

| Signal | Default | Override |
| --- | --- | --- |
| verdict `avoid` | abort | — |
| verdict `caution` | allow (code reported) | `abort_on_caution=True` |
| live `payTo` ≠ context | abort (`x402check:payto_mismatch`) | — |
| preflight error | abort (fail closed) | `fail_open=True` |

## Actions

- `preflight_check` — trust-check one seller URL (`ok|caution|avoid` + history)
- `verify_payto` — same billing; focus on receiving wallet + `payToChanges`

## Env

- `X402CHECK_URL` — override origin
- `X402CHECK_SKIP=1` — synthetic ok (tests)

## Links

- https://x402check.dev/docs
- Related: coinbase/agentkit#1402, #1454
