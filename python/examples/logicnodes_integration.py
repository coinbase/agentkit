"""
LogicNodes On-Chain Compliance Integration for Coinbase AgentKit
=================================================================
Demonstrates how to integrate LogicNodes deterministic compute workers into
a Coinbase AgentKit agent for on-chain compliance, gas estimation, identity
verification, and ZK attestation.

LogicNodes provides 2,300+ cryptographically-signed microservices callable
via REST or MCP — zero subscriptions, pay-per-call via USDC x402 on Base.

Install:
    pip install coinbase-agentkit requests

Usage:
    export CDP_API_KEY_NAME="..."
    export CDP_API_KEY_PRIVATE_KEY="..."
    export OPENAI_API_KEY="sk-..."
    export LOGICNODES_API_KEY="your_key_from_https://logicnodes.io/checkout"
    python python/examples/logicnodes_integration.py
"""

import asyncio
import os
from typing import Any

import requests
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpWalletProvider,
    CdpWalletProviderConfig,
)
from coinbase_agentkit_langchain import get_langchain_tools
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

LOGICNODES_API_KEY = os.environ.get("LOGICNODES_API_KEY", "")
LOGICNODES_BASE = "https://logicnodes.io"


def _ln_headers() -> dict:
    """Return authorization headers for LogicNodes API."""
    if LOGICNODES_API_KEY:
        return {"Authorization": f"Bearer {LOGICNODES_API_KEY}"}
    return {}


def _call_worker(worker_name: str, payload: dict | None = None) -> dict:
    """Generic LogicNodes worker call via REST."""
    if payload:
        resp = requests.post(
            f"{LOGICNODES_BASE}/call/{worker_name}",
            json=payload,
            headers=_ln_headers(),
            timeout=15,
        )
    else:
        resp = requests.get(
            f"{LOGICNODES_BASE}/call/{worker_name}",
            headers=_ln_headers(),
            timeout=15,
        )
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# LogicNodes tool functions (compatible with LangChain/AgentKit tool format)
# ---------------------------------------------------------------------------

from langchain.tools import StructuredTool
from pydantic import BaseModel, Field


class GasOracleInput(BaseModel):
    chain: str = Field(
        default="base",
        description="Chain name: base, ethereum, polygon, arbitrum",
    )


class ComplianceSentryInput(BaseModel):
    agent_id: str = Field(description="Agent wallet address or DID.")
    action: str = Field(description="Description of the action to check.")
    context: str = Field(default="", description="Optional JSON context string.")


class EthPriceInput(BaseModel):
    pass


class ZkAttestInput(BaseModel):
    content: str = Field(description="Text or JSON content to anchor on-chain.")


class GraphScoreInput(BaseModel):
    agent_id: str = Field(description="Agent wallet address or DID.")


def gas_oracle(chain: str = "base") -> str:
    """
    Query the LogicNodes gas oracle for deterministic EIP-1559 gas estimates.
    Returns a cryptographically-signed payload suitable for on-chain verification.
    """
    try:
        data = _call_worker("gas-oracle", {"chain": chain})
        return (
            f"Gas oracle ({chain}): "
            f"base_fee={data.get('base_fee_gwei', 'N/A')} gwei, "
            f"priority_fee={data.get('priority_fee_gwei', 'N/A')} gwei, "
            f"max_fee={data.get('max_fee_gwei', 'N/A')} gwei. "
            f"Signature: {data.get('signature', 'N/A')[:16]}..."
        )
    except Exception as e:
        return f"Gas oracle error: {e}"


def compliance_sentry(agent_id: str, action: str, context: str = "") -> str:
    """
    Run an on-chain compliance check for an autonomous agent action via LogicNodes.
    Returns a verifiable attestation of whether the action is permitted.
    """
    try:
        data = _call_worker(
            "compliance-sentry",
            {"agent_id": agent_id, "action": action, "context": context},
        )
        permitted = data.get("permitted", "unknown")
        reason = data.get("reason", "")
        attestation = data.get("attestation_hash", "")[:16]
        return (
            f"Compliance check for '{action}' by {agent_id}: "
            f"permitted={permitted}. Reason: {reason}. "
            f"Attestation: {attestation}..."
        )
    except Exception as e:
        return f"Compliance sentry error: {e}"


def eth_price_logicnodes() -> str:
    """
    Fetch the current ETH/USD price from LogicNodes (cryptographically signed).
    Suitable for on-chain price verification and autonomous agent decisions.
    """
    try:
        resp = requests.get(
            f"{LOGICNODES_BASE}/call/eth-price",
            headers=_ln_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return (
            f"ETH price: ${data.get('price_usd', 'N/A')} USD "
            f"(timestamp: {data.get('timestamp', 'N/A')}, "
            f"signature: {data.get('signature', 'N/A')[:16]}...)"
        )
    except Exception as e:
        return f"ETH price error: {e}"


def zk_attest_content(content: str) -> str:
    """
    Anchor content on-chain via LogicNodes ZK attestation (Base L2, USDC x402).
    Returns a verifiable proof-of-existence for audit trails and compliance.
    """
    try:
        resp = requests.post(
            f"{LOGICNODES_BASE}/x402/zk-attest",
            json={"content": content},
            headers=_ln_headers(),
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return (
            f"ZK attestation created: "
            f"content_hash={data.get('content_hash', 'N/A')[:24]}..., "
            f"tx_hash={data.get('tx_hash', 'N/A')[:24]}..., "
            f"proof_url={data.get('proof_url', 'N/A')}"
        )
    except Exception as e:
        return f"ZK attestation error: {e}"


def graph_score_lookup(agent_id: str) -> str:
    """
    Retrieve the LogicNodes trust graph score for an agent.
    Returns reputation score and risk tier based on on-chain history.
    """
    try:
        resp = requests.get(
            f"{LOGICNODES_BASE}/graph/score/{agent_id}",
            headers=_ln_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return (
            f"Trust graph score for {agent_id}: "
            f"score={data.get('score', 'N/A')}, "
            f"risk_tier={data.get('risk_tier', 'N/A')}"
        )
    except Exception as e:
        return f"Graph score error: {e}"


# Build LangChain StructuredTools
LOGICNODES_LANGCHAIN_TOOLS = [
    StructuredTool.from_function(
        func=gas_oracle,
        name="logicnodes_gas_oracle",
        description=(
            "Query LogicNodes gas oracle for deterministic EIP-1559 gas estimates "
            "on Base, Ethereum, Polygon, or Arbitrum. Output is cryptographically signed."
        ),
        args_schema=GasOracleInput,
    ),
    StructuredTool.from_function(
        func=compliance_sentry,
        name="logicnodes_compliance_sentry",
        description=(
            "Run on-chain compliance check for an agent action via LogicNodes. "
            "Returns verifiable attestation of whether action is permitted."
        ),
        args_schema=ComplianceSentryInput,
    ),
    StructuredTool.from_function(
        func=eth_price_logicnodes,
        name="logicnodes_eth_price",
        description=(
            "Fetch the current ETH/USD price from LogicNodes (cryptographically signed). "
            "Use for on-chain price decisions."
        ),
        args_schema=EthPriceInput,
    ),
    StructuredTool.from_function(
        func=zk_attest_content,
        name="logicnodes_zk_attest",
        description=(
            "Anchor content on-chain via LogicNodes ZK attestation on Base L2. "
            "Returns verifiable proof-of-existence for audit trails."
        ),
        args_schema=ZkAttestInput,
    ),
    StructuredTool.from_function(
        func=graph_score_lookup,
        name="logicnodes_graph_score",
        description=(
            "Get the LogicNodes trust graph score for an agent's wallet address or DID. "
            "Returns reputation score and risk tier."
        ),
        args_schema=GraphScoreInput,
    ),
]


# ---------------------------------------------------------------------------
# Main demo: AgentKit + LogicNodes
# ---------------------------------------------------------------------------

def build_agentkit_agent():
    """Build a Coinbase AgentKit agent augmented with LogicNodes tools."""
    # Initialize wallet provider
    wallet_provider = CdpWalletProvider(
        CdpWalletProviderConfig(
            api_key_name=os.environ.get("CDP_API_KEY_NAME", ""),
            api_key_private_key=os.environ.get("CDP_API_KEY_PRIVATE_KEY", ""),
        )
    )

    # Initialize AgentKit
    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
        )
    )

    # Combine AgentKit tools with LogicNodes tools
    agentkit_tools = get_langchain_tools(agentkit)
    all_tools = agentkit_tools + LOGICNODES_LANGCHAIN_TOOLS

    # Build LangGraph ReAct agent
    llm = ChatOpenAI(model="gpt-4o")
    agent = create_react_agent(
        llm,
        all_tools,
        state_modifier=(
            "You are an autonomous on-chain agent powered by Coinbase AgentKit "
            "and LogicNodes deterministic compute. Before executing any transaction:\n"
            "1. Call logicnodes_compliance_sentry to verify the action is permitted.\n"
            "2. Call logicnodes_gas_oracle to get accurate gas estimates on Base.\n"
            "3. Call logicnodes_eth_price for current ETH value.\n"
            "4. After execution, call logicnodes_zk_attest to anchor the decision.\n"
            "All LogicNodes outputs are cryptographically signed and verifiable on-chain."
        ),
    )
    return agent


def main():
    print("=== LogicNodes + Coinbase AgentKit Integration Demo ===\n")

    agent = build_agentkit_agent()

    events = agent.stream(
        {
            "messages": [
                (
                    "user",
                    "Check the current ETH price and gas estimate on Base. "
                    "Then verify compliance for agent 'agentkit-demo' performing "
                    "'transfer 0.01 ETH to 0xRecipient'. "
                    "Should I proceed with the transaction?",
                )
            ]
        },
        stream_mode="values",
    )

    for event in events:
        if "messages" in event:
            event["messages"][-1].pretty_print()


if __name__ == "__main__":
    main()
