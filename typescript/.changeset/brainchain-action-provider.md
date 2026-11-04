---
"@coinbase/agentkit": minor
---

Added a BrainChain action provider: `post_task` pays 1 USDC on Base over x402 for a task that a frontier model does and Jev grades, with work that is not accepted refunded, and `get_task` reads the order until the result arrives. Spending is capped per task and in total.
