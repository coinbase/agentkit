# OSF Action Provider

This directory contains the **OsfActionProvider** implementation, which provides actions to interact with **OSF (Open Source Filings)** — a marketplace of verifiable, provenance-stamped public-record data, paid per call over **x402** (USDC on Base mainnet).

Every result carries a provenance URL to its authoritative primary U.S. government or public source, so an agent can independently verify each fact.

## Directory Structure

```
osf/
├── osf_action_provider.py    # Main provider with OSF functionality
├── schemas.py                # Action schemas
├── __init__.py               # Main exports
└── README.md                 # This file

# From python/coinbase-agentkit/
tests/action_providers/osf/
├── conftest.py                    # Test configuration and fixtures
└── test_osf_action_provider.py    # Tests for the OSF action provider
```

## Actions

- `lookup_entity`: Resolve and verify a company or person against authoritative public registries (CMS NPI, GLEIF LEI, FDIC, SEC EDGAR). For KYC, KYB, counterparty due-diligence, and onboarding. ($0.05 per call)
- `screen_entity`: Screen a name against eleven sanctions and exclusion lists from ten authorities, including OFAC SDN, OFAC Consolidated, the EU consolidated list, UK OFSI, the UN Security Council list, the Trade.gov Consolidated Screening List, World Bank debarments, HHS OIG LEIE and SAM.gov exclusions. Returns hit / no-hit, the matched list, and an audit receipt. For AML, KYC, and watchlist checks. ($0.05 per call)
- `check_cve_exploited`: Check whether a CVE is actively exploited (CISA KEV), with its EPSS exploit-probability and CVSS severity. For vulnerability management and patch prioritization. ($0.05 per call)

Prices are quoted live in the HTTP 402 response from each endpoint; the values above were verified against the live server on 2026-07-27.

Each action returns a JSON string containing the result, the HTTP status, and — on a successful paid call — the on-chain payment proof (transaction, network, payer).

## Payment

Calls are settled with USDC on Base mainnet via x402. The wallet provided to the agent must hold USDC on Base. Each action enforces a per-call maximum spend (via the x402 `max_amount` policy) set above the list price, so a small pricing change will not break calls while still capping spend per call.

## Adding New Actions

To add new OSF actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `osf_action_provider.py`.
3. Implement tests in `tests/action_providers/osf/test_osf_action_provider.py`.

## Network Support

OSF settles payments on **Base mainnet** only.

For more information, visit the OSF data marketplace at [api.osf-master-server.com/mcp](https://api.osf-master-server.com/mcp).
