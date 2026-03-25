#!/usr/bin/env python3.11
"""End-to-end test for X402SearchActionProvider with real wallet and live payment."""

import json
import os
import sys
import time
from urllib.parse import urlparse

from eth_account import Account
from web3 import Web3

# ── config ──────────────────────────────────────────────────────────────────
PRIVATE_KEY = os.environ.get("TEST_WALLET_PRIVATE_KEY")
if not PRIVATE_KEY:
    sys.exit("ERROR: TEST_WALLET_PRIVATE_KEY env var not set")

WALLET_ADDRESS = "0xfb286b0Cc7F33F1fb8A977c5c798A00Ce19D42Aa"
BASE_RPC = "https://base-mainnet.public.blastapi.io"
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base mainnet

QUERIES = [
    "crypto price feed",
    "whale alerts",
    "btc price",
    "sentiment analysis",
    "defi lending rates",
]

# Keywords that signal an irrelevant result for financial/price queries
# (LLM wrappers, generic AI tools that aren't price data sources)
LLM_WRAPPER_DOMAINS = {
    "openai.com", "anthropic.com", "huggingface.co", "langchain.com",
    "replicate.com", "together.ai", "perplexity.ai",
}

DEV_STAGING_INDICATORS = ["dev.", "staging.", "localhost", "127.0.0.1", ".local", "-staging.", "-dev."]

# ERC-20 balanceOf ABI
BALANCE_ABI = [{"inputs":[{"name":"account","type":"address"}],"name":"balanceOf",
                "outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]

# ── helpers ──────────────────────────────────────────────────────────────────

def get_usdc_balance(w3: Web3, address: str) -> float:
    usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC_ADDRESS), abi=BALANCE_ABI)
    raw = usdc.functions.balanceOf(Web3.to_checksum_address(address)).call()
    return raw / 1e6  # USDC has 6 decimals


def extract_results(result: dict) -> list[dict]:
    """Return a flat list of result dicts with 'url' and 'rank' keys."""
    # Try common shapes the provider might return
    if "results" in result:
        return result["results"]
    if "apis" in result:
        return result["apis"]
    if "data" in result:
        return result["data"]
    return []


def domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return url


def check_query(query: str, result: dict) -> tuple[bool, list[str]]:
    """
    Run quality checks on a single query result.
    Returns (passed: bool, issues: list[str]).
    """
    issues = []
    results = extract_results(result)
    count = len(results)

    print(f"  Results count : {count}")

    # Show top-3 URLs with ranks
    top3 = results[:3]
    for i, r in enumerate(top3):
        url = r.get("url") or r.get("endpoint") or r.get("api_url") or ""
        rank = r.get("rank") or r.get("score") or r.get("relevance") or 0
        print(f"  [{i+1}] rank={rank:.4f}  {url}")

    if count == 0:
        issues.append("no results returned")
        return False, issues

    # --- Check 1: no dev/staging URLs ---
    for r in results:
        url = r.get("url") or r.get("endpoint") or r.get("api_url") or ""
        for indicator in DEV_STAGING_INDICATORS:
            if indicator in url.lower():
                issues.append(f"dev/staging URL found: {url}")
                break

    # --- Check 2: no single domain takes more than 2 slots ---
    from collections import Counter
    domains = [domain_of(r.get("url") or r.get("endpoint") or r.get("api_url") or "") for r in results]
    for dom, cnt in Counter(domains).items():
        if dom and cnt > 2:
            issues.append(f"domain '{dom}' appears {cnt} times (max 2)")

    # --- Check 3: top result rank > 0.10 ---
    top_rank = top3[0].get("rank") or top3[0].get("score") or top3[0].get("relevance") or 0
    if top_rank <= 0.10:
        issues.append(f"top result rank {top_rank:.4f} ≤ 0.10")

    # --- Check 4: no LLM wrapper domains in results (for price/financial queries) ---
    price_queries = {"crypto price feed", "btc price", "defi lending rates"}
    if query in price_queries:
        for r in results:
            url = r.get("url") or r.get("endpoint") or r.get("api_url") or ""
            dom = domain_of(url)
            if dom in LLM_WRAPPER_DOMAINS:
                issues.append(f"LLM wrapper domain in price query results: {url}")

    passed = len(issues) == 0
    return passed, issues


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    # Verify private key matches expected address
    local_account = Account.from_key(PRIVATE_KEY)
    if local_account.address.lower() != WALLET_ADDRESS.lower():
        sys.exit(
            f"ERROR: private key yields {local_account.address}, "
            f"expected {WALLET_ADDRESS}"
        )
    print(f"Wallet: {local_account.address}")

    # Check USDC balance before
    w3 = Web3(Web3.HTTPProvider(BASE_RPC))
    balance_before = get_usdc_balance(w3, WALLET_ADDRESS)
    print(f"USDC balance before: ${balance_before:.6f}")
    min_required = 0.01 * len(QUERIES)
    if balance_before < min_required:
        sys.exit(
            f"ERROR: insufficient USDC balance "
            f"(need ≥${min_required:.2f} for {len(QUERIES)} queries, have ${balance_before:.6f})"
        )

    # Build wallet provider and action provider
    from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import (
        EthAccountWalletProvider,
        EthAccountWalletProviderConfig,
    )
    from coinbase_agentkit.action_providers.x402search import x402search_action_provider

    wallet_provider = EthAccountWalletProvider(
        EthAccountWalletProviderConfig(
            account=local_account,
            chain_id="8453",  # Base mainnet
        )
    )

    provider = x402search_action_provider()

    verdicts: list[tuple[str, bool, list[str]]] = []

    for i, query in enumerate(QUERIES):
        if i > 0:
            print("  (waiting 3s to avoid rate limiting...)")
            time.sleep(3)

        print(f"\n{'='*60}")
        print(f"QUERY: '{query}'")
        print(f"{'='*60}")
        print("(charging ~$0.01 USDC via x402 payment ...)")

        bal_before_q = get_usdc_balance(w3, WALLET_ADDRESS)
        result_str = provider.search_apis(wallet_provider, {"query": query})
        result = json.loads(result_str)
        bal_after_q = get_usdc_balance(w3, WALLET_ADDRESS)
        deducted = bal_before_q - bal_after_q

        if not result.get("success"):
            print(f"  ERROR: search failed — {result.get('error')}")
            verdicts.append((query, False, [f"search failed: {result.get('error')}"]))
            continue

        print(f"  Payment: ${deducted:.6f} USDC deducted")

        passed, issues = check_query(query, result)

        if issues:
            for issue in issues:
                print(f"  ISSUE: {issue}")

        verdict = "PASS" if passed else "FAIL"
        print(f"  --> {verdict}")
        verdicts.append((query, passed, issues))

    # ── summary ──────────────────────────────────────────────────────────────
    balance_after = get_usdc_balance(w3, WALLET_ADDRESS)
    total_deducted = balance_before - balance_after

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total USDC spent: ${total_deducted:.6f}")
    print()

    all_passed = True
    for query, passed, issues in verdicts:
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {query}")
        if not passed:
            all_passed = False
            for issue in issues:
                print(f"         - {issue}")

    print()
    print("OVERALL:", "PASS" if all_passed else "FAIL")
    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
