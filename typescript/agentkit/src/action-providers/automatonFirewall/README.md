# Automaton Firewall Action Provider

This directory contains the **AutomatonFirewallActionProvider** implementation, which provides a pre-flight check an agent runs **before** it sends a transaction on Base, using the **Automaton Pre-Flight AI Firewall** (a paid x402 service).

## Directory Structure

```
automatonFirewall/
├── automatonFirewallActionProvider.ts         # Main provider: pre-flight check, x402 payment guards
├── automatonFirewallActionProvider.test.ts    # Test file for the provider
├── schemas.ts                                 # Input schema of the action
├── index.ts                                   # Main exports
└── README.md                                  # This file
```

## Actions

- `simulate_and_guard_transaction`: Simulates a transaction before execution and returns a verdict (`SAFE`, `WARNING`, `REJECT`) with a risk score, the simulation result (revert, gas), token safety (honeypot, buy/sell tax) and a safe slippage bound.

This complements transport-level revert guards (an RPC middleware in front of `eth_sendRawTransaction`): those answer "will this revert?", this action also answers "should the agent send money into this token or path?".

## Payment

Each call costs **0.02 USDC** on Base (`eip155:8453`), paid via x402 with an EIP-3009 `TransferWithAuthorization` signed by the agent wallet. The agent needs USDC, not ETH.

Before anything is signed, the provider checks the 402 challenge and refuses to pay unless it offers `scheme: exact` on Base, native USDC, an amount at or below `maxAmountUnits`, and the Automaton treasury as `payTo`. A refused challenge returns `status: "payment_refused"`; nothing is signed.

The paid retry carries the FLAT envelope `{ x402Version: 2, scheme: "exact", network, payload: { from, to, value, validAfter, validBefore, nonce }, signature }`, base64-encoded, in `X-PAYMENT-AUTH` (and the same value in `X-PAYMENT`).

Use an EOA wallet provider (for example `ViemWalletProvider` or `CdpEvmWalletProvider`): the service verifies a 65-byte ECDSA signature.

## Results That Are Not a Verdict

- `status: "payment_refused"`: the challenge failed a guard (`amount_above_cap`, `no_supported_requirement`, `payto_not_allowed`, `bad_amount`, `bad_cap`).
- `status: "unavailable"`: the service could not be reached. This is **not** a `REJECT`; `verdict` and `riskScore` are `null`.

## Usage Examples

```typescript
import { AgentKit, automatonFirewallActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    automatonFirewallActionProvider({
      maxAmountUnits: 20000, // optional; USDC base units (6 decimals), default 20000 = 0.02 USDC
    }),
  ],
});
```

## Network Support

Base mainnet only (`base-mainnet`), where the service settles payments.
