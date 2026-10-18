# HirePulse company data

```python
from coinbase_agentkit import hirepulse_action_provider

provider = hirepulse_action_provider()
provider.company_lookup({"tool": "company-intent", "domain": "linear.app"})
```

Add the provider to `AgentKitConfig(action_providers=[...])`.
`company_lookup` covers tech stack, open jobs, hiring intent, Google Ads,
company profiles and company footprint. `company_scan` creates free batch or
hot-buyer quotes for 2–25 domains. No API key or additional dependency is needed.

Five successful lookups per UTC day per IP are shared across lookup tools.
Scans have separate limits. Empty results are not charged. Paid lookups cost
$0.005–$0.03 USDC on Base; hot-buyer profiles cost $0.25 per hot company.
Quotes expire in 15 minutes. This provider does not sign payments or purchase
quotes: HTTP 402 and the x402 challenge are returned in the action result.
Payment can be handled separately with AgentKit's existing x402 provider.

[Live catalog and schemas](https://gethirepulse.xyz/v1/catalog).
Returned information is public company data; it does not identify individuals.
Disclosure: the contributor maintains HirePulse.
