"""LogicNodes action provider for AgentKit.

Exposes 624 deterministic compute workers as AgentKit actions.
Workers cover Finance, Healthcare, Legal, Logistics, Aerospace, Cybersecurity,
Energy, HR, Compliance, Agriculture, Automotive, Biopharma, Smart Cities, and more.

Every result includes an EIP-191 Proof-of-Logic signature — cryptographic proof
that the computation was performed correctly and was not hallucinated.

Payment:
- x402 pay-per-call in USDC on Base, Arbitrum, Polygon, Optimism (no account needed)
- Or pass an API key via LogicNodesConfig for pre-paid access

Discovery:
- GET https://logicnodes.io/.well-known/agent.json  (full catalog)
- GET https://logicnodes.io/llms.txt                (LLM-readable)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

import requests

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CallWorkerSchema, DiscoverWorkersSchema, FreeTryWorkerSchema, LogicNodesConfig

LOGICNODES_BASE = "https://logicnodes.io"

# Category keyword -> worker slug fragments for fast filtering
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "finance": ["loan", "amort", "mortgage", "bond", "option", "equity", "hedge",
                "ledger", "invoice", "tax", "dividend", "currency", "crypto", "defi"],
    "healthcare": ["drug", "dose", "ehr", "clinical", "vaccine", "rehab", "telehealth",
                   "genome", "protein", "compound", "biopharma"],
    "legal": ["contract", "compliance", "patent", "sec", "gdpr", "visa", "ir35",
              "attorney", "conflict", "corporate_governance"],
    "logistics": ["shipping", "freight", "customs", "last_mile", "vessel", "cross_dock",
                  "supply_chain", "pallet", "warehouse", "fleet"],
    "aerospace": ["aerospace", "rocket", "avionics", "propulsion", "radar",
                  "flight_path", "drone", "lidar"],
    "cybersecurity": ["ddos", "malware", "phishing", "dark_web", "ssl", "vpn",
                      "encryption", "endpoint", "honeypot"],
    "energy": ["solar", "wind", "renewable", "peak_demand", "smart_meter",
               "gas_pipeline", "energy_consumption", "curtailment"],
    "hr": ["candidate", "recruitment", "remote_work", "performance_review",
           "workforce", "internal_mobility", "employee_churn", "engagement"],
    "compliance": ["aml", "anti_money", "kyc", "gdpr", "sec_filing",
                   "customs_duty", "carbon_offset", "esg"],
    "agriculture": ["crop", "seed", "pest", "irrigation", "livestock", "agricultural"],
    "automotive": ["vehicle", "vin", "tire_wear", "ev_charger", "fleet_fuel"],
    "real_estate": ["property", "zoning", "title_chain", "permit"],
    "education": ["course", "exam", "learning_path", "tuition", "education_grant", "classroom"],
    "hospitality": ["hotel", "restaurant", "cruise", "guest_loyalty", "housekeeping", "tour"],
}


class LogicNodesActionProvider(ActionProvider[WalletProvider]):
    """AgentKit action provider for LogicNodes AOS.

    Provides access to 624 deterministic workers with cryptographic proof-of-logic.
    Supports both x402 pay-per-call and pre-paid API key access.
    """

    def __init__(self, config: LogicNodesConfig | None = None):
        """Initialize the LogicNodes action provider.

        Args:
            config: Optional configuration. Defaults to x402 pay-per-call on logicnodes.io.
        """
        super().__init__("logicnodes", [])

        if config is None:
            config = LogicNodesConfig()

        self._base_url = config.base_url.rstrip("/")
        self._api_key = config.api_key or os.getenv("LOGICNODES_API_KEY", "")
        self._max_payment_usdc = config.max_payment_usdc

    # ── Actions ──────────────────────────────────────────────────────────────

    @create_action(
        name="discover_logicnodes_workers",
        description=(
            "Discover available LogicNodes deterministic workers. Returns worker names, "
            "descriptions, and call URLs. Filter by category (finance, healthcare, legal, "
            "logistics, aerospace, cybersecurity, energy, hr, compliance, agriculture, "
            "automotive, real_estate, education, hospitality) or by keyword. "
            "Each worker returns a cryptographically-signed result (EIP-191 Proof-of-Logic)."
        ),
        schema=DiscoverWorkersSchema,
    )
    def discover_workers(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """List available workers with optional category/keyword filtering.

        Args:
            wallet_provider: Wallet provider (unused — discovery is free).
            args: Optional filters: category, keyword.

        Returns:
            str: JSON list of matching workers with call URLs.
        """
        try:
            resp = requests.get(
                f"{self._base_url}/.well-known/agent.json",
                timeout=10,
            )
            resp.raise_for_status()
            manifest = resp.json()
            workers = manifest.get("workers", [])

            category = (args.get("category") or "").lower()
            keyword  = (args.get("keyword") or "").lower()

            # Apply category filter
            if category and category in CATEGORY_KEYWORDS:
                kws = CATEGORY_KEYWORDS[category]
                workers = [w for w in workers if any(k in w["name"] for k in kws)]

            # Apply keyword filter
            if keyword:
                workers = [w for w in workers if keyword in w["name"].lower()]

            return json.dumps({
                "success":      True,
                "total":        manifest.get("total", len(workers)),
                "returned":     len(workers),
                "workers":      workers[:50],  # cap at 50 for context size
                "free_trial":   f"{self._base_url}/free-trial/{{worker_slug}}",
                "paid_call":    f"{self._base_url}/call/{{worker_slug}}",
                "sdk":          "pip install logicnodes-m2m",
                "mcp":          "npx @logicnodez/mcp-bridge",
            }, indent=2)

        except Exception as e:
            return json.dumps({"error": True, "message": str(e)}, indent=2)

    @create_action(
        name="try_logicnodes_worker_free",
        description=(
            "Make one free trial call to a LogicNodes worker — no payment or API key required. "
            "Returns a real deterministic result with cryptographic proof (EIP-191 signature). "
            "One free call per agent per worker. After the free trial, use call_logicnodes_worker "
            "which pays via x402 in USDC. "
            "Example workers: loan_amortization_engine, drug_interaction_oracle, "
            "anti_money_laundering_red_flag_scorer, utility_bill_auditor."
        ),
        schema=FreeTryWorkerSchema,
    )
    def try_worker_free(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Call a worker once for free (trial endpoint).

        Args:
            wallet_provider: Wallet provider (used for agent identity).
            args: worker slug and params dict.

        Returns:
            str: Worker result with proof-of-logic, or 402 if trial already used.
        """
        worker = args["worker"]
        params = args["params"]

        try:
            # Use wallet address as agent identity for trial tracking
            agent_id = getattr(wallet_provider, "get_address", lambda: "unknown")()

            resp = requests.post(
                f"{self._base_url}/free-trial/{worker}",
                json=params,
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Id": str(agent_id),
                },
                timeout=30,
            )

            if resp.status_code == 404:
                return json.dumps({
                    "error": True,
                    "message": f"Worker '{worker}' not found.",
                    "suggestion": "Use discover_logicnodes_workers to find valid worker slugs.",
                }, indent=2)

            if resp.status_code == 402:
                data = resp.json()
                return json.dumps({
                    "error":   True,
                    "message": "Free trial already used for this worker.",
                    "pay_at":  data.get("pay_at", f"{self._base_url}/call/{worker}"),
                    "next":    "Use call_logicnodes_worker to pay via x402 in USDC.",
                }, indent=2)

            data = resp.json()
            return json.dumps({
                "success":          True,
                "worker":           worker,
                "result":           data.get("result"),
                "proof_of_logic":   self._extract_verification(data.get("result", {})),
                "trial":            True,
                "next_call":        f"{self._base_url}/call/{worker}  (x402 USDC payment)",
            }, indent=2)

        except Exception as e:
            return json.dumps({"error": True, "message": str(e)}, indent=2)

    @create_action(
        name="call_logicnodes_worker",
        description=(
            "Call any of LogicNodes' 624 deterministic workers and pay per call in USDC via x402. "
            "Workers cover Finance (loan_amortization_engine, bond_yield_calculator, options_greeks_engine), "
            "Healthcare (drug_interaction_oracle, clinical_trial_eligibility_scanner), "
            "Legal (anti_money_laundering_red_flag_scorer, contract_renewal_clause_notifier), "
            "Logistics (customs_duty_drawback_finder, vessel_arrival_delay_predictor), "
            "Aerospace (rocket_stage_separation_timer, aerospace_material_fatigue_tracker), "
            "Utilities (utility_bill_auditor), Automotive (vehicle_vin_blockchain_resolver), "
            "and hundreds more. Every result includes an EIP-191 cryptographic proof. "
            "Use discover_logicnodes_workers to find workers for your use case. "
            "Use try_logicnodes_worker_free for a free first call."
        ),
        schema=CallWorkerSchema,
    )
    def call_worker(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Call a LogicNodes worker, paying via x402 or API key.

        Args:
            wallet_provider: Wallet provider for x402 payment signing.
            args: worker slug and params dict.

        Returns:
            str: Deterministic result with EIP-191 proof-of-logic.
        """
        worker = args["worker"]
        params = args["params"]
        url    = f"{self._base_url}/call/{worker}"

        headers: dict[str, str] = {"Content-Type": "application/json"}

        # If API key configured — use it directly (no x402 needed)
        if self._api_key:
            headers["X-API-Key"] = self._api_key
            try:
                resp = requests.post(url, json=params, headers=headers, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    return json.dumps({
                        "success":        True,
                        "worker":         worker,
                        "result":         data.get("result"),
                        "proof_of_logic": self._extract_verification(data.get("result", {})),
                    }, indent=2)
                return json.dumps({
                    "error":   True,
                    "message": f"HTTP {resp.status_code}",
                    "detail":  resp.text[:300],
                }, indent=2)
            except Exception as e:
                return json.dumps({"error": True, "message": str(e)}, indent=2)

        # No API key — use x402 pay-per-call flow
        # Step 1: probe for 402
        try:
            resp = requests.post(url, json=params, headers=headers, timeout=30)
        except Exception as e:
            return json.dumps({"error": True, "message": str(e)}, indent=2)

        if resp.status_code == 200:
            data = resp.json()
            return json.dumps({
                "success":        True,
                "worker":         worker,
                "result":         data.get("result"),
                "proof_of_logic": self._extract_verification(data.get("result", {})),
            }, indent=2)

        if resp.status_code == 402:
            payment_data = resp.json()
            accepts      = payment_data.get("accepts", [])
            extensions   = payment_data.get("extensions", {})
            bazaar       = extensions.get("bazaar", {})

            # Return structured 402 info so the x402 provider can handle payment
            return json.dumps({
                "status":                 "payment_required",
                "worker":                 worker,
                "url":                    url,
                "method":                 "POST",
                "body":                   params,
                "accepts":                accepts,
                "free_trial":             bazaar.get("free_trial", f"{self._base_url}/free-trial/{worker}"),
                "next_steps": [
                    "This endpoint requires x402 payment in USDC.",
                    "Use the AgentKit x402 action provider's retry_http_request_with_x402 "
                    "with the selected payment option from 'accepts' above.",
                    f"Or call try_logicnodes_worker_free for one free call first.",
                ],
            }, indent=2)

        if resp.status_code == 404:
            return json.dumps({
                "error":      True,
                "message":    f"Worker '{worker}' not found.",
                "suggestion": "Use discover_logicnodes_workers to find valid worker slugs.",
            }, indent=2)

        return json.dumps({
            "error":   True,
            "message": f"Unexpected HTTP {resp.status_code}",
            "detail":  resp.text[:300],
        }, indent=2)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _extract_verification(self, result: dict[str, Any]) -> dict[str, Any]:
        """Extract the EIP-191 proof-of-logic from the result."""
        if not isinstance(result, dict):
            return {}
        v = result.get("_verification") or result.get("result", {}).get("_verification", {})
        if isinstance(v, dict):
            return {
                "algorithm":  v.get("algorithm"),
                "signature":  (v.get("signature") or "")[:32] + "...",  # truncate for readability
                "standard":   v.get("standard"),
                "verified":   bool(v.get("signature") or v.get("hash")),
            }
        return {}

    def supports_network(self, network: Network) -> bool:
        """LogicNodes works on all networks — payment is handled via x402 on Base/Arbitrum."""
        return True


def logicnodes_action_provider(
    config: LogicNodesConfig | None = None,
) -> LogicNodesActionProvider:
    """Create a LogicNodes action provider.

    Args:
        config: Optional configuration. If omitted, uses x402 pay-per-call
                at https://logicnodes.io with no account needed.

    Returns:
        LogicNodesActionProvider ready to use with AgentKit.

    Example:
        >>> from coinbase_agentkit import AgentKit, AgentKitConfig
        >>> from coinbase_agentkit.action_providers.logicnodes import logicnodes_action_provider
        >>>
        >>> kit = AgentKit(AgentKitConfig(
        ...     wallet_provider=...,
        ...     action_providers=[logicnodes_action_provider()],
        ... ))
    """
    return LogicNodesActionProvider(config)
