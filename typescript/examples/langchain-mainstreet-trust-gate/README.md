# MainStreet Trust-Gate Chatbot

This example demonstrates a buyer agent that **refuses to pay any wallet scoring below a configurable MainStreet reputation threshold**.

## What it does

```
user → "send 1 USDC to 0xAbc..."
       ↓
tool: mainstreet_trust_check
       ├── fetch /api/agent/attestation/0xAbc
       ├── verify EIP-712 signature against MainStreet operator (0xAC3c...)
       ├── check freshness (<24h)
       └── check score >= MIN_SCORE (default 30)
       ↓ (only if ok)
tool: CDP erc20 transfer
```

If the wallet's MainStreet score is below threshold (or no attestation exists, or signature invalid), the agent refuses and explains why.

## Why this matters

CDP Bazaar lists 800+ AI agents on Base. Some are legitimate businesses settling thousands of USDC; some are throwaway wallets that drained LPs and disappeared. **Today AgentKit users can pay any of them.** A trust gate prevents users from paying low-rep wallets they wouldn't pay if they could see the score.

MainStreet is an EIP-712 reputation oracle on Base. Free attestation fetch, free off-chain verify, onchain verifier contract live at [`0x7397adb9713934c36d22aa54b4dbbcd70263592b`](https://basescan.org/address/0x7397adb9713934c36d22aa54b4dbbcd70263592b).

## Configuration

```env
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
OPENAI_API_KEY=...
MAINSTREET_MIN_SCORE=30   # default 30/100; raise for stricter gate
```

## Run

```bash
npm install
npm start
```

Try:

```
you: what's the MainStreet score for 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9?
you: send 0.01 USDC to 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9
you: send 0.01 USDC to 0x0000000000000000000000000000000000000001
```

The first known address will pass the gate; the second (no attestation) will be refused with `reason: "no attestation found"`.

## How verification works

MainStreet attestations follow EIP-712 with this schema:

```
Attestation(
  string version,         // "mainstreet-v1"
  string subjectType,     // "agent-onchain"
  bytes32 subject,        // sha256(toLowerCase(address))
  uint8 score,            // 0-100
  uint64 timestamp,       // ≤24h old
  address operator,       // 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9
  uint64 nonce
)
```

Domain: `{ name: "MainStreet", version: "1", chainId: 8453 }`.

For on-chain verification (smart contract gate), call the deployed `MainStreetVerifier.requireMinScore()` instead — see [avisradar.app/integrations.html](https://avisradar.app/integrations.html).

## Resources

- MainStreet oracle landing: <https://avisradar.app/oracle.html>
- Catalog of paid endpoints: <https://avisradar.app/api/agent/catalog>
- Integration recipes for 10+ Base ecosystem platforms: <https://avisradar.app/api/agent/integrate>
- npm package: [`@raskhaaa/mainstreet-oracle`](https://www.npmjs.com/package/@raskhaaa/mainstreet-oracle) (includes `/verifier` helpers)
- Open-source repo: <https://github.com/philpof102-svg/mainstreet>
