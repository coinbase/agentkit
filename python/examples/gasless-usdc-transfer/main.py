"""CLI and example runner for Base USDC gasless transfer (EIP-3009)."""

from __future__ import annotations

import argparse
import os

from transfer import DEFAULT_BASE_USDC, DEFAULT_CHAIN_ID, GaslessTransfer


def main() -> None:
    parser = argparse.ArgumentParser(description="Sign Base USDC EIP-3009 transfer authorization offline")
    parser.add_argument("--rpc-url", default=os.getenv("BASE_RPC_URL", "https://mainnet.base.org"), help="Base RPC endpoint")
    parser.add_argument("--token", default=os.getenv("USDC_TOKEN_ADDRESS", DEFAULT_BASE_USDC), help="Base USDC contract address")
    parser.add_argument("--chain-id", type=int, default=int(os.getenv("CHAIN_ID", str(DEFAULT_CHAIN_ID))), help="EVM chain ID (8453 for Base Mainnet, 84532 for Base Sepolia)")
    parser.add_argument("--recipient", required=True, help="Recipient checksum address")
    parser.add_argument("--amount", type=int, required=True, help="USDC atomic amount (1 USDC = 1,000,000)")
    parser.add_argument("--valid-seconds", type=int, default=900, help="Validity window in seconds")
    args = parser.parse_args()

    private_key = os.getenv("OWNER_PRIVATE_KEY")
    if not private_key:
        raise SystemExit("Error: OWNER_PRIVATE_KEY environment variable is required")

    transfer = GaslessTransfer(args.rpc_url, args.token, args.chain_id)
    auth = transfer.sign(private_key, args.recipient, args.amount, valid_for_seconds=args.valid_seconds)

    print("=== EIP-3009 Authorization Signed Offline ===")
    print(f"Owner:        {auth.owner}")
    print(f"Recipient:    {auth.recipient}")
    print(f"Value:        {auth.value} (atomic units)")
    print(f"Valid After:  {auth.valid_after}")
    print(f"Valid Before: {auth.valid_before}")
    print(f"Nonce:        0x{auth.nonce.hex()}")
    print(f"v:            {auth.v}")
    print(f"r:            0x{auth.r.hex()}")
    print(f"s:            0x{auth.s.hex()}")
    print("\nAuthorization payload is ready for a relayer to broadcast via transferWithAuthorization.")


if __name__ == "__main__":
    main()
