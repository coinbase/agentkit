# Etherscan Action Provider

The Etherscan action provider enables AI agents to verify and publish smart contract source code on [Etherscan](https://etherscan.io) and compatible block explorers (Basescan, Arbiscan, Optimism Explorer, PolygonScan).

## Actions

### `verify_smart_contract`

Submits a deployed contract's Solidity source code for on-chain verification.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `contract_address` | `str` | ✅ | The on-chain address of the deployed contract |
| `source_code` | `str` | ✅ | Full Solidity source code (or Standard JSON input) |
| `contract_name` | `str` | ✅ | Contract name (e.g. `MyToken`); for Standard JSON include the file path (e.g. `contracts/MyToken.sol:MyToken`) |
| `compiler_version` | `str` | ✅ | Exact compiler version string (e.g. `v0.8.20+commit.a1b79de6`) |
| `optimization_used` | `bool` | ❌ | Whether the optimizer was enabled (default: `False`) |
| `runs` | `int` | ❌ | Optimizer runs — only relevant when `optimization_used` is `True` (default: `200`) |
| `constructor_arguments` | `str` | ❌ | ABI-encoded constructor arguments without `0x` prefix (default: `""`) |
| `evm_version` | `str` | ❌ | Target EVM version, e.g. `london` or `paris` (default: compiler default) |
| `license_type` | `int` | ❌ | SPDX license type 1–14 (default: `1` = No License) |
| `code_format` | `str` | ❌ | `solidity-single-file` or `solidity-standard-json-input` (default: `solidity-single-file`) |

On success the action returns the **GUID** issued by Etherscan which you can pass to `get_verification_status` to poll for the result.

---

### `get_verification_status`

Polls for the result of a previously submitted verification request.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `guid` | `str` | ✅ | The GUID returned by `verify_smart_contract` |

Common status values returned by Etherscan:

- **"Pending in queue"** — queued, not yet processed
- **"Pass - Verified"** — source code verified successfully ✅
- **"Fail - Unable to verify"** — verification failed; check compiler settings
- **"Already Verified"** — contract is already verified on this explorer

---

## Setup

### API Key

An Etherscan (or compatible explorer) API key is required.  Obtain one at [https://etherscan.io/myapikey](https://etherscan.io/myapikey).

Set it as an environment variable:

```bash
export ETHERSCAN_API_KEY="your_api_key_here"
```

Or pass it explicitly when initialising the provider:

```python
from coinbase_agentkit import etherscan_action_provider

provider = etherscan_action_provider(api_key="your_api_key_here")
```

### Supported Networks

All EVM-compatible networks configured in AgentKit are supported, including:

- Ethereum Mainnet & Sepolia
- Base & Base Sepolia
- Arbitrum One & Arbitrum Sepolia
- Optimism Mainnet & OP Sepolia
- Polygon & Polygon Amoy

---

## Usage Example

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, etherscan_action_provider
from coinbase_agentkit.wallet_providers import EthAccountWalletProvider, EthAccountWalletProviderConfig

wallet_provider = EthAccountWalletProvider(
    EthAccountWalletProviderConfig(private_key="0x...", chain_id="1")
)

agentkit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[etherscan_action_provider()],
    )
)
```
