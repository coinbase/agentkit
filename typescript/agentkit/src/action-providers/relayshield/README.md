# RelayShield Action Provider

Counterparty and content screening for agents, paid per call over x402.

An agent about to send funds to an address, swap into a token, buy an NFT, or follow a link
has a question it cannot answer from onchain data alone: is the thing on the other side known
to be malicious? This provider answers that question, and the agent pays for the answer out of
its own wallet.

## Why this needs no API key

Every action calls a RelayShield pay-as-you-go endpoint, which replies with an HTTP 402
challenge. The agent's wallet settles the payment in USDC and the call proceeds in the same
request cycle. There is no account to create, no key to store and no key to rotate, which is
the only shape that works when the buyer is software.

## Actions

| Action | Answers | Price |
|---|---|---|
| `screen_wallet` | Is this counterparty address associated with scams, exploits, drainers or sanctions? | $0.05 |
| `check_token_security` | Is this token a honeypot, mintable, blacklistable or otherwise restricted? | $0.05 |
| `check_nft_security` | Is this NFT collection fake, copied or transfer-restricted? | $0.10 |
| `screen_url` | Is this link phishing or malware? | $0.05 |

`screen_wallet` detects the chain from the address format and covers EVM, Solana, TON and
Bitcoin, so the agent does not have to know or ask which chain an address belongs to.

## Supported networks

Payment settles on **Base mainnet** and **Solana mainnet**.

Note that this is narrower than what the screening itself covers. `supportsNetwork` reflects
where a payment can settle, not which chains can be screened, and an address on any supported
chain can be screened from a wallet on either of these two.

## Setup

```typescript
import { AgentKit, relayshieldActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [relayshieldActionProvider()],
});
```

The wallet needs a small USDC balance on Base or Solana to pay for calls.

## A clean result is not a guarantee

These checks report what is currently known. Absence of a risk flag means nothing is known
against the item, not that it is safe, and the action descriptions instruct the model to say
so when reporting results.

For the same reason, a failed check is never reported as a clean one. If the endpoint errors
or the payment fails, the action returns a message stating plainly that the check did not
complete and the item should be treated as unverified. A screening tool that looks like it
found nothing when it actually failed is worse than one that admits it could not answer.

## Links

- [API reference](https://api.relayshield.net/docs)
- [OpenAPI specification](https://api.relayshield.net/openapi.json)
- [Developer portal](https://api.relayshield.net/developers)
