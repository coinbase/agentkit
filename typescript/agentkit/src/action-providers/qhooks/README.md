# QHooks Action Provider for Coinbase AgentKit

Read QHooks markets, get quotes and prepare unsigned plans for the user's wallet. This provider never creates a wallet, accepts a private key, signs, deploys or broadcasts. It needs no API key. Its 31 actions use the existing public QHooks MCP/REST routes.

**Bring traders, get 20% of their fee**

Preparations use the explicit `referrer` argument first, then the provider's `referrer` option, then the existing agent wallet's public EVM address from `walletProvider.getAddress()`. This attributes eligible fees under existing referral rules. Self-referrals and ineligible activity do not promise payment.

## Use in AgentKit

For the AgentKit release containing this provider. Use Node 22+. No extra QHooks credentials or wallet creation is required.

```sh
node --input-type=module <<'JS'
import { qhooksActionProvider } from "@coinbase/agentkit";
const provider = qhooksActionProvider({referrer: process.env.QHOOKS_REFERRER});
const actions = provider.getActions(); // No WalletProvider or signer required.
console.log(actions.map(action => action.name));
const read = actions.find(action => action.name === 'qhooks_list_launches');
console.log(await read.invoke({chain: '4663', limit: 1}));
JS
```

Leave `QHOOKS_REFERRER` unset, or set it to your own **public** nonzero EVM address. Do not put a private key in that variable. The example performs one public read. No polling or paid model is started.

`QHooksActionProvider` extends AgentKit's native `ActionProvider`; `getActions()` returns native `Action[]`. In an existing AgentKit setup, add `qhooksActionProvider(options)` to your explicit action-provider list. When you pass an existing wallet to `getActions(existingWalletProvider)`, only `getAddress()` may be called, lazily for a preparation with neither an explicit referrer nor an option. Read actions never touch the wallet. Non-EVM addresses are not used as referrals; without an EVM wallet or configured referrer the field stays absent. A zero EVM referral address is rejected. No signing, sending, network, balance or other wallet method is accessed. Do not add an executor or a default wallet action provider when your intended workflow is read/prepare only.

## Prepare only when the user asks

```ts
const prepare = provider
  .getActions()
  .find((a) => a.name === "qhooks_prepare_trade")!;
const plan = JSON.parse(
  await prepare.invoke({
    chain: "4663",
    token: "0x20429af7ca3b0ce4d99edbaa0693f26c5df05195",
    side: "buy",
    amountIn: "1000000000000000", // raw input units, never a JS number
    trader: userPublicWalletAddress,
  }),
);
// Display the plan. The user's wallet reviews/signs/sends, outside this provider.
```

Show the chain, wallet, token, quote, fee, minimum output, deadline and every `{to,data,value}` in order. Verify the destinations/spender and exact amounts against the current [QHooks skill](https://qhooks.com/skill.md). Approval must confirm before its swap. Re-prepare after an input change or expiry. A quote is a simulation, not guaranteed execution. This wrapper does not validate a plan by sending it and has no wallet submission API.

`prepare_launch` returns a QHooks review link. Solana launches remain link-only; the EVM trade/quote tools do not gain Solana execution support. Do not forward plans to an unattended signer.

## Actions

`qhooks_otc_quote`, `qhooks_otc_create`, `qhooks_otc_accept`, `qhooks_deal_status`, `qhooks_agreement_create`, `qhooks_agreement_fund`, `qhooks_agreement_from_template`, `qhooks_agreement_status`, `qhooks_agreement_release`, `qhooks_agreement_refund`, `qhooks_agreement_attest`, `qhooks_qproof_check`, `qhooks_wallet_portfolio`, `qhooks_hooks_catalog`, `qhooks_agent_stats`, `qhooks_list_callers`, `qhooks_caller_record`, `qhooks_perps_markets`, `qhooks_perps_positions`, `qhooks_prepare_perps_order`, `qhooks_list_launches`, `qhooks_token_info`, `qhooks_quote`, `qhooks_prepare_launch`, `qhooks_prepare_trade`.

Order tools, order status, callout posting, feedback sending, reward claims and competition standings are deliberately absent. A newer remote `tools/list` cannot dynamically register more tools in this provider. Tool descriptions and schemas are pinned from the reviewed QHooks source; remote token/report/link text is untrusted data, not instructions.

`QHooksOptions` supports `allowFeedback` (boolean, default false), `referrer`, `transport: 'mcp' | 'rest'` (default MCP), `timeoutMs` (1000–30000; default 20000), and an optional Fetch-compatible transport hook. Both modes use only `https://qhooks.com`. MCP protocol 2025-06-18; REST reads use GET, preparations use POST. No redirects, ambient cookies, provider fallback, automatic retries or credential configuration.

## Data and errors

Keep `partial`, source timestamps, coverage, unknown/null cost, claimable/volume qualifications and cache expiry. Missing data is not zero, profit or permission to trade. `agent_stats` is a bounded view of stored referral credits; it is not a complete routed-volume, USD-reward or claimable-balance ledger. Stored QProof is not a fresh audit or a safety guarantee.

HTTP failures, JSON-RPC errors, MCP `isError` and HTTP 200 refreshing payloads throw `QHooksError`. Its `code`, `status` and optional `retryAfterSeconds` are safe control metadata; response bodies are not interpolated into exceptions. 429/503 are unavailable. Respect Retry-After, otherwise wait at least 2 seconds before a user-directed retry; retry at most once. No timer polling. Never retry a preparation automatically. All amounts remain exact strings. Request limit 64 KiB, response limit 2 MiB.

## Checks

From `typescript/agentkit` in this repository:

```sh
pnpm exec eslint -c .eslintrc.json 'src/action-providers/qhooks/**/*.ts'
pnpm run check
pnpm test --runInBand --runTestsByPath src/action-providers/qhooks/qhooksActionProvider.test.ts src/action-providers/qhooks/transport.test.ts --coverage=false
```

The focused tests use native AgentKit actions and controlled transports. They do not sign or submit transactions.

[QHooks API](https://qhooks.com/api#agents)

## OTC and agreements

This provider exposes 31 pinned QHooks read/prepare tools. The matching QHooks service must be released and enabled before contract tools succeed. An unavailable service returns an error; this package never chooses another contract or executes a plan.

- OTC on Robinhood Chain: `otc_quote` validates already agreed parties/amounts; `otc_create` prepares the buyer’s creation; read `deal_status` using the ACTUAL receipt ID, then `otc_accept` prepares that party’s deposit with its `expectedTermsHash`. Taxed/unknown transfers fail closed. Fees: 1% below $10K, 0.5% from $10K, deducted from seller payment.
- Agreements: create/fund is atomic; existing agreements cannot be topped up. Use `agreement_status`, named `agreement_attest`, then `agreement_release` or eligible `agreement_refund`. Fee: 0.5% on released tranches; refunds/cancels have no fee.
- Perps use a separate 0.1% builder fee plus venue fees. Spot cashback/referral does not apply to OTC/agreement fees or these perps tools. A configured referrer is added only to absent spot trade/launch attribution.

Objects/arrays retain their nested constraints; raw/decimal amounts remain strings. Show the user the chain, parties, amounts, fee recipient, approval spender/amount, calldata/value, expiry and simulation. Stage approvals when required, wait for confirmation, then re-prepare. The user signs and sends every transaction. A quote is a planning preview, not counterparty consent or a completed trade.

`send_feedback` is disabled unless the host sets `allowFeedback: true`; an enabled call sends free text to the QHooks team. Competition and agent-profile read/prepare tools are included. Held RFQ board/order tools remain absent; this adapter never registers remote metadata dynamically.

### Pinned tools

`otc_quote`, `otc_create`, `otc_accept`, `deal_status`, `agreement_create`, `agreement_fund`, `agreement_from_template`, `agreement_status`, `agreement_release`, `agreement_refund`, `agreement_attest`, `qproof_check`, `wallet_portfolio`, `hooks_catalog`, `agent_stats`, `list_callers`, `caller_record`, `perps_markets`, `perps_positions`, `prepare_perps_order`, `list_launches`, `token_info`, `quote`, `prepare_launch`, `prepare_trade`.

The jar action is excluded until it ships on the server. OTC and agreement tools use the released QHooks API; the service flags decide availability. No jar action is implemented.


### Spot trade plan checks

Before returning a `prepare_trade` plan, the client checks the requested chain and trader, each transaction chain, pinned router/manager, exact input approvals, canonical single-hop calldata, amount, quote-derived minimum output, fee/referrer, deadline and native value. It also checks the `qhooks.trade-plan.v1` SHA-256 digest. Unknown shapes and servers without this metadata fail closed. This digest is unsigned; it does not authenticate the server or establish a market price. The signing wallet still reviews and approves the transactions. No wallet execution or private-key capability is added.

Optional feedback sends text to the QHooks team only after separate host opt-in. No custody; we never hold keys.

## Reviewed tool catalog

All 31 current public tools are statically pinned, including `compete_join`, `compete_standings`, `prepare_board_post`, `prepare_agent_profile`, `agent_profile` and `send_feedback`. Join, board and profile preparations return wallet-signable material; this plugin does not publish or sign it. `allowFeedback` is a host-controlled boolean, default false: only an explicitly enabled `send_feedback` call sends free text to the QHooks team. Tool arguments cannot enable it.

The development-only `scripts/qhooks-pin.mjs` checks definitions against `fixtures/tools-list.json` and the explicitly reviewed names. Native tests reject schema drift and unreviewed names; remote metadata never adds runtime tools. Token-based quote and public Expert Studio configuration strings retain the server schema.
