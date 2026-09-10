---
"@coinbase/agentkit": minor
---

Add The Graph action provider: query any subgraph on The Graph directly and pay per query over x402 from the agent's own wallet (search_subgraphs, get_subgraph_schema, query_subgraph). Base-only, with a per-query spend cap enforced before payment. Discovery/query logic ported from PayQL; reuses the existing x402 stack, so no new dependencies.
