---
"@coinbase/agentkit": minor
---

Added a Taskmarket action provider that lets agents delegate and request onchain work on the Taskmarket marketplace (USDC on Base): `list_tasks` (browse open work), `get_task` (track a task's live status), `list_submissions` (present submissions for human review), and `create_task` (create and fund a task with a hard max-spend cap and explicit user authorization, delegating the funded write to the first-party Taskmarket CLI).
