---
"@coinbase/agentkit": minor
---

Added the SBOR action provider, a read-only benchmark of lending rates. `get_sbor_rate`, `compare_rate_to_sbor` and `list_sbor_markets` let an agent check an offered borrow or supply rate against the SBOR indices on Stacks, or against the cost of borrowing USDC against bitcoin on Base and Ethereum, before acting. It needs no key and never sends a transaction.
