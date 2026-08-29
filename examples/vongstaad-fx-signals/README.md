# Vongstaad FX Signals with Coinbase AgentKit

This example shows how an AgentKit agent can consume real-time
crypto quant signals from Vongstaad via x402 payments on Base.

## How It Works

1. Agent calls Vongstaad endpoint → receives 402 challenge
2. Agent pays USDC on Base via its CDP wallet
3. Agent retries with payment proof → receives signal
4. Agent uses signal for portfolio decisions

## Available Signals
Correlation, Regime, Momentum, Volatility, Mean Reversion, SMA, Price.
10 crypto instruments. Pay per call via x402 on Base.

Discovery: https://vongstaad.com/.well-known/x402.json
MCP Server: https://github.com/VGSTAAD/vongstaad-mcp
