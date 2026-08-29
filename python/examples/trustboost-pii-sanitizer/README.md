# TrustBoost PII Sanitizer — AgentKit Example

This example demonstrates how an AgentKit agent autonomously pays for
PII sanitization using the x402 protocol on Solana — no human intervention.

## What this example shows

- Agent discovers TrustBoost via `/.well-known/agent-card.json`
- Agent calls `/sanitize` without payment → receives HTTP 402
- Agent reads x402 payment instructions and pays 149 USDC on Solana
- TrustBoost sanitizes PII and anchors proof on Solana blockchain
- Agent receives sanitized text + verifiable on-chain proof

## Why this matters

AI agents process user data containing PII before sending to LLMs.
Without sanitization, this PII reaches external LLM providers in violation
of GDPR, LGPD, and the EU AI Act (enforcement: August 2, 2026).

TrustBoost is the only PII sanitizer that:
- Accepts autonomous x402 payment on Solana
- Anchors proof of sanitization on-chain
- Supports 8 languages including LATAM (RFC, CPF, CUIT)
- Returns HTTP 402 with payment instructions — no human needed

## Prerequisites

- Python 3.10+
- CDP API Key (https://portal.cdp.coinbase.com)
- Or use tx_hash=TRIAL for 50 free sanitizations

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

```bash
export CDP_API_KEY_ID="your-cdp-api-key-id"
export CDP_API_KEY_SECRET="your-cdp-api-key-secret"
export NETWORK_ID="solana-mainnet"
```

## Usage

```bash
python agent.py
```

## Resources

- GitHub: https://github.com/teodorofodocrispin-cmyk/TrustBoost-PII-Sanitizer
- Agent Card: https://api.trustboost.dev/.well-known/agent-card.json
- Health: https://api.trustboost.dev/health
- Verify proof: https://api.trustboost.dev/verify/{anchor_tx}
- Live Demo: https://huggingface.co/spaces/TrustBoost/pii-sanitizer
