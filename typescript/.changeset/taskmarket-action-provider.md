---
"@coinbase/agentkit": minor
---

Added a Taskmarket action provider integrating the on-chain Taskmarket bounty marketplace. It exposes `list_tasks`, `get_task`, and `my_submissions` for discovering and tracking escrowed bounty work, plus `submit_work` and `create_task` which are gated behind an explicit `confirm` input so no funds move without user authorization. Requires the `taskmarket` CLI to be installed and initialized on the host.
