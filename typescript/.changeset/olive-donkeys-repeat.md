---
"@coinbase/agentkit": patch
---

Removed local filesystem reads from the flaunch and zora action providers. The `image` parameter now accepts only remote URLs (`http(s)://` for flaunch, `https://`/`ipfs://` for zora) or a `data:` URI. Previously any non-URL string was treated as a local file path, read off the agent host, and uploaded to a third-party IPFS pinning service. To publish a local file, read it yourself and pass a data URI.
