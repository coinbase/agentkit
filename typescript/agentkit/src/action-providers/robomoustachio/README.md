# Robomoustachio Action Provider

This provider adds trust-check actions for [Robomoustachio](https://robomoustach.io), an ERC-8004 trust oracle on Base.

## Actions

1. `get_agent_trust_score`
- Returns an agent's trust score and confidence.

2. `get_agent_trust_report`
- Returns score plus report metadata (flags, risk factors, trend, feedback summary).

3. `evaluate_agent_risk`
- Returns `APPROVED` / `REJECTED` using a configurable score threshold and report flags.

## Defaults

- `baseUrl`: `https://robomoustach.io`
- `defaultDemo`: `true`
- `requestTimeoutMs`: `10000`
- `defaultScoreThreshold`: `500`

By default, requests use `?demo=true` so agents can evaluate trust without requiring x402 payment setup.

## Network support

This provider is enabled on Base mainnet (`chainId=8453`, `networkId=base-mainnet`).

