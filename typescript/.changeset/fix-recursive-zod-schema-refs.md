---
"@coinbase/agentkit": patch
"@coinbase/agentkit-model-context-protocol": patch
---

fix: resolve $ref pointers from recursive Zod schemas for LLM function-calling APIs

Added `resolveJsonSchemaRefs()` utility that inlines `$ref` pointers produced by `zodToJsonSchema()` and `z.toJSONSchema()` when converting recursive or shared Zod types. Integrated into the MCP framework extension so schemas are resolved transparently. Also exported from `@coinbase/agentkit` for use with LangChain and Vercel AI SDK extensions.
