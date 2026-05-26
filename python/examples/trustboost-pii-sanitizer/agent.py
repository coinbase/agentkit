"""
TrustBoost PII Sanitizer — AgentKit x402 Example

Demonstrates an AgentKit agent autonomously paying for PII sanitization
via the x402 protocol on Solana — no human intervention required.

The agent:
1. Discovers TrustBoost via /.well-known/agent-card.json
2. Calls /sanitize without payment → receives HTTP 402
3. Reads x402 payment instructions
4. Pays 149 USDC autonomously from its CDP wallet
5. Retries with tx_hash → receives sanitized text + on-chain proof
"""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

TRUSTBOOST_URL = "https://api.trustboost.dev"
TRIAL_MODE = os.getenv("TRUSTBOOST_TRIAL", "true").lower() == "true"


def discover_trustboost() -> dict:
    """Discover TrustBoost capabilities via agent-card.json."""
    r = requests.get(f"{TRUSTBOOST_URL}/.well-known/agent-card.json", timeout=10)
    r.raise_for_status()
    card = r.json()
    print(f"[TrustBoost] Discovered: {card['name']} v{card['version']}")
    print(f"[TrustBoost] Capabilities: {list(card['capabilities'].keys())}")
    print(f"[TrustBoost] Languages: {card['languages']}")
    return card


def sanitize_pii(text: str, wallet_address: str = "agentkit-agent") -> dict:
    """
    Sanitize PII from text using TrustBoost.

    In TRIAL mode: uses tx_hash=TRIAL for 50 free sanitizations.
    In PAID mode: agent pays 149 USDC via x402 on Solana autonomously.

    Args:
        text: Text containing potential PII to sanitize
        wallet_address: Agent wallet identifier for quota tracking

    Returns:
        dict with sanitized_content, safety_score, risk_category,
        and proof_of_sanitization (paid mode only)
    """
    if TRIAL_MODE:
        # Use TRIAL mode — 50 free sanitizations per wallet
        print(f"[TrustBoost] Using TRIAL mode (50 free sanitizations)")
        r = requests.post(
            f"{TRUSTBOOST_URL}/sanitize",
            json={
                "text": text,
                "tx_hash": "TRIAL",
                "wallet_address": wallet_address,
                "context": "general"
            },
            timeout=30
        )
        r.raise_for_status()
        return r.json()["data"]

    else:
        # PAID mode — x402 autonomous payment flow
        print("[TrustBoost] Attempting request without payment (x402 flow)...")

        # Step 1: Call without payment → expect 402
        r = requests.post(
            f"{TRUSTBOOST_URL}/sanitize",
            json={"text": text, "wallet_address": wallet_address},
            timeout=30
        )

        if r.status_code == 402:
            # Step 2: Read x402 payment instructions
            payment_info = r.json()
            x402 = payment_info.get("x402", {})
            accepts = x402.get("accepts", [{}])[0]

            amount_usdc = int(accepts.get("amount", 149000000)) / 1_000_000
            payment_address = accepts.get("payment_address")
            network = accepts.get("network")

            print(f"[TrustBoost] HTTP 402 received — payment required")
            print(f"[TrustBoost] Amount: {amount_usdc} USDC on {network}")
            print(f"[TrustBoost] Address: {payment_address}")

            # Step 3: Pay autonomously with AgentKit CDP wallet
            # In a real AgentKit agent, replace this with:
            # tx_hash = agent_kit.send_usdc(
            #     to=payment_address,
            #     amount=amount_usdc,
            #     network="solana-mainnet"
            # )
            print("[TrustBoost] Agent paying autonomously via CDP wallet...")
            print("[TrustBoost] NOTE: Replace this section with your AgentKit payment code")
            raise NotImplementedError(
                "Set TRUSTBOOST_TRIAL=true for testing, or implement "
                "AgentKit CDP wallet payment to complete x402 flow. "
                f"Send {amount_usdc} USDC to {payment_address} on {network}"
            )

        r.raise_for_status()
        return r.json()["data"]


def verify_proof(anchor_tx: str) -> dict:
    """Verify a proof of sanitization on Solana."""
    r = requests.get(f"{TRUSTBOOST_URL}/verify/{anchor_tx}", timeout=10)
    return r.json()


def main():
    print("=" * 60)
    print("TrustBoost PII Sanitizer — AgentKit x402 Example")
    print("=" * 60)

    # Step 1: Discover TrustBoost
    card = discover_trustboost()

    # Step 2: Example texts with PII in multiple languages
    test_cases = [
        {
            "language": "English",
            "text": "Contact John at john@example.com, SSN: 123-45-6789, API key: sk-abc123"
        },
        {
            "language": "Spanish LATAM",
            "text": "Cliente Juan Lopez, RFC: LOPJ850101ABC, Tel: +52-55-1234-5678"
        },
        {
            "language": "Portuguese BR",
            "text": "CPF do cliente: 123.456.789-09, email: cliente@empresa.com.br"
        },
        {
            "language": "Japanese",
            "text": "田中太郎、マイナンバー：123456789012、電話：090-1234-5678"
        },
    ]

    print(f"\n[Mode] {'TRIAL (50 free)' if TRIAL_MODE else 'PAID (x402 on Solana)'}")
    print("=" * 60)

    for case in test_cases:
        print(f"\n[{case['language']}]")
        print(f"Input:  {case['text']}")

        try:
            result = sanitize_pii(case["text"])

            print(f"Output: {result.get('sanitized_content', result.get('sanitized_text', ''))}")
            print(f"Score:  {result.get('safety_score', 'N/A')} | Risk: {result.get('risk_category', 'N/A')}")

            # Check for on-chain proof (paid mode only)
            proof = result.get("proof_of_sanitization")
            if proof:
                print(f"Proof:  {proof.get('verify_url', '')}")
                # Verify on-chain
                verification = verify_proof(proof["solana_tx"])
                print(f"Verified: {verification.get('status', 'unknown')}")

        except Exception as e:
            print(f"Error: {e}")

    print("\n" + "=" * 60)
    print("Done. Sanitized text is safe to send to any LLM.")
    print(f"Upgrade to paid mode for on-chain proof: {TRUSTBOOST_URL}")
    print("=" * 60)


if __name__ == "__main__":
    main()
