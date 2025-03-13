import json
import os
import secrets

from eth_account import Account

"""
Wallet Functions

This file contains functions for managing wallets and their signers.
It provides functionality to get a wallet signer and save wallet data to a file.
"""

def get_wallet_signer(network_id):
    """Get or create a wallet signer and persist wallet data.

    Args:
        network_id (str): Network identifier (e.g. 'base-sepolia')

    Returns:
        Account: Ethereum account signer
        str: Smart wallet address

    """
    wallet_data_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load wallet data from JSON file
    wallet_data = {
        "private_key": None,
        "smart_wallet_address": None
    }
    if os.path.exists(wallet_data_file):
        try:
            with open(wallet_data_file) as f:
                wallet_data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data file format for {network_id}. Creating new wallet.")

    # Use private key from env if not in wallet data
    private_key = wallet_data.get("private_key") or os.getenv("PRIVATE_KEY")

    if not private_key:
        # Generate new private key if none exists
        private_key = "0x" + secrets.token_hex(32)
        # Save the new private key to the wallet data file
        wallet_data = {
            "private_key": private_key,
            "smart_wallet_address": None
        }
        with open(wallet_data_file, "w") as f:
            json.dump(wallet_data, f, indent=2)
        print(f"Created new private key and saved to {wallet_data_file}")
        print("We recommend you save this private key to your .env file.")

    # Create signer from private key
    signer = Account.from_key(private_key)

    return signer, wallet_data.get("smart_wallet_address")

def save_wallet(wallet_provider, network_id):
    """Save wallet data to file for reuse.

    Args:
        wallet_provider: The wallet provider instance
        network_id (str): Network identifier (e.g. 'base-sepolia')

    """
    wallet_data_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load wallet data from JSON file
    wallet_data = {
        "private_key": None,
        "smart_wallet_address": None
    }
    if os.path.exists(wallet_data_file):
        try:
            with open(wallet_data_file) as f:
                wallet_data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data file format for {network_id}. Creating new wallet.")

    # Use private key from env if not in wallet data
    private_key = wallet_data.get("private_key") or os.getenv("PRIVATE_KEY")

    # Save both private key and smart wallet address
    wallet_data = {
        "private_key": private_key,
        "smart_wallet_address": wallet_provider.get_address()
    }
    with open(wallet_data_file, "w") as f:
        json.dump(wallet_data, f, indent=2)
