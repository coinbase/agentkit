# SpendPreflight Action Provider

Maintained by the operator of [SpendPreflight](https://spendpreflight.com). Screens merchants and reviews x402 spending decisions before an agent pays. Screening is informational, not legal advice or a compliance certification.

```typescript
import { AgentKit, spendpreflightActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider: existingBaseWallet,
  actionProviders: [spendpreflightActionProvider()],
});
```

No SpendPreflight account, API key or OAuth is required. Reuse the existing Base-mainnet AgentKit wallet with USDC. Do not add a new credential for this provider.

| Action | Inputs | Output | Screening fee |
|---|---|---|---|
| `check_payee` | At least one wallet `address`, payee `name` or `domain` | Risk and sanctions/domain flags | $0.01 Base USDC |
| `preflight_payment` | Original x402 `challenge`, `resource_url`, optional `rules` and `context.spent_today_usd` | allow/hold/block, reasons and receipt | $0.02 Base USDC |

Names are prefixed by AgentKit's normal action registration. The provider uses fixed HTTPS API routes, rejects redirects and accepts only the exact disclosed Base USDC fee to SpendPreflight's published wallet. Caller-supplied merchant URLs are screening input, never fetch or payment destinations in this provider. The provider signs payment for its own screening fee only; it never signs or executes the merchant payment under review.

Use `spendpreflightActionProvider({ trial: true })` to opt into the shared three-call daily HTTP/MCP trial per IP. It uses plain fetch and does not access the signer. Exhausted quota returns a hold/error and does not silently fall back to a paid call.

Treat `success: false`, unavailable screening and hold/block as denial until your explicit policy or human review resolves them. A model choosing to use this tool is not itself an enforcement gate; apply decisions in the actual merchant-payment path. Per-request rules and spend context belong to the caller. Receipt history and request bodies are not persisted by SpendPreflight.

Official API references: [OpenAPI](https://api.spendpreflight.com/openapi.json), [default rules](https://api.spendpreflight.com/v1/rules/default), [privacy](https://api.spendpreflight.com/privacy), [status](https://status.spendpreflight.com).

## Development verification

From `typescript/agentkit`: `pnpm test --runTestsByPath src/action-providers/spendpreflight/spendpreflightActionProvider.test.ts --coverage=false`, `pnpm check`, and lint/format the changed files. Tests use mocked HTTP, wallets and analytics; no real credentials, LLM call or paid settlement is needed.
