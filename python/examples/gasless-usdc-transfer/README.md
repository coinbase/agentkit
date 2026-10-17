# Base USDC Gasless Transfer Example (EIP-3009)

This example demonstrates how to implement gasless USDC transfers on Base using [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) (`transferWithAuthorization`).

## Architecture

In an EIP-3009 transfer:
1. **User (Token Owner)**: Signs an EIP-712 authorization completely offline. The private key never touches the RPC node or the network.
2. **Relayer / Sponsor**: Receives the signed authorization payload and calls `transferWithAuthorization` on the USDC contract, paying the gas fee on behalf of the user.

```
+---------------+     Signs EIP-712 Auth (Offline)     +-------------------+
|  Token Owner  | -----------------------------------> | Relayer / Sponsor |
+---------------+                                      +-------------------+
                                                                 |
                                                                 | Broadcasts transferWithAuthorization
                                                                 | (Pays Gas)
                                                                 v
                                                       +-------------------+
                                                       | Base USDC Contract|
                                                       +-------------------+
```

## Contract Addresses

| Network | Chain ID | USDC Contract Address |
| :--- | :---: | :--- |
| **Base Mainnet** | `8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Base Sepolia** | `84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Prerequisites

- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) or pip

## Installation

Using `uv`:
```bash
make install
# or
uv sync
```

Using standard `pip`:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

## Running Unit Tests (100% Offline)

The unit tests use mock RPC contracts and verify cryptographic signatures offline without making any network calls or requiring a funded account:

```bash
make test
# or
uv run pytest -v
```

## Usage

Set your private key in an environment variable and sign an authorization offline:

```bash
export OWNER_PRIVATE_KEY="0x..."

# Base Mainnet (Default):
uv run python main.py \
  --recipient 0x000000000000000000000000000000000000dEaD \
  --amount 1000000 \
  --chain-id 8453

# Base Sepolia Testnet:
uv run python main.py \
  --recipient 0x000000000000000000000000000000000000dEaD \
  --amount 1000000 \
  --token 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  --chain-id 84532
```

## Security & Verification

- **Offline Signatures**: The signer performs purely mathematical operations and does not require an active RPC connection to produce valid authorization signatures.
- **Gas Safety**: Broadcast is opt-in and handled via `broadcast()`; the default execution path only constructs parameters.
- **Reference CI**: A standalone verification build is continuously tested at [420358249q-hub/base-usdc-gasless](https://github.com/420358249q-hub/base-usdc-gasless).
