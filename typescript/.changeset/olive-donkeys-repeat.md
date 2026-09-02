---
"@coinbase/agentkit": minor
---

Removed local filesystem reads from the flaunch and zora action providers. The `image` parameter previously treated any non-URL string as a local file path, read it off the agent host, and uploaded the contents to a third-party IPFS pinning service. It now accepts only remote URLs (`http(s)://` for flaunch, `https://` or `ipfs://` for zora) or a `data:` URI. To publish a local file, read it yourself and pass a data URI: `` image: `data:image/png;base64,${fs.readFileSync(path, "base64")}` ``
