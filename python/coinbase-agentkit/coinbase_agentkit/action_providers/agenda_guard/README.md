# Agenda Financial Guard Action Provider

Optional review of caller-supplied evidence for proposed EVM transactions. This
provider exposes an AgentKit action; applications must explicitly invoke it and
enforce their own signing policy. It does not intercept other providers.

## Findings and review boundary

- A legacy local risk denylist, approval patterns and suspicious intent can produce
  `reject`. The list is not a current authoritative sanctions dataset.
- Caller-reported USD amounts are compared with configured limits. Optional
  `velocity_24h_usd` is unverified history, not a wallet ledger.
- All other proposals return `step_up_human_required`, with `is_safe: false`.
  A remote `allow`, missing evidence, malformed response or network failure never
  provides permission to sign or broadcast.
- No signing, transaction submission, automatic payments or escrow payouts occur.
  Current sanctions screening and actual wallet spending require separate checks.

## Offline usage

```python
import json
from coinbase_agentkit.action_providers.agenda_guard import agenda_guard_action_provider

provider = agenda_guard_action_provider(endpoint=None, max_single_limit_usd=500.0)
findings = json.loads(provider.check_transaction_safety({
    "recipient": "0x2222222222222222222222222222222222222222",
    "amount_usd": 75.0,
    "network": "base",
    "intent": "Pay for dataset analysis",
}))
# Inspect findings; do not automatically sign based on this result.
assert findings["is_safe"] is False
```

To expose the action in AgentKit, include the provider in `AgentKitConfig`'s
`action_providers` alongside your existing wallet provider.

## Optional remote evidence

The default endpoint receives the supplied recipient, amount, calldata, intent,
network and policy values in an HTTP POST. Use `endpoint=None` to keep evidence
local, or configure an endpoint you trust. No wallet keys are sent.

The hosted endpoint may require payment (HTTP 402). This provider does not attach
payment proofs or perform paid retries: it records `remote_status: payment_required`
and keeps human review required. HTTP redirects are not followed. A successful
remote rejection can tighten the result; a successful remote allowance cannot
relax the review boundary.
