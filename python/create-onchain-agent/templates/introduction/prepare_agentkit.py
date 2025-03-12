import os
import json
import secrets
from dotenv import load_dotenv

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    SmartWalletProvider,
    SmartWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    wallet_action_provider,
    weth_action_provider,
)

load_dotenv()

# Configure a file to persist wallet data based on network
network_id = os.getenv("NETWORK_ID", "base-sepolia")
wallet_data_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

def prepare_agentkit():
    """Initialize CDP Smart Wallet Agentkit and return tools."""

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
        print(f"Created new private key and saved to {wallet_data_file}")
        print("We recommend you save this private key to your .env file and delete the wallet data file afterwards.")

    signer = Account.from_key(private_key)

    # Initialize Smart Wallet Provider
    wallet_provider = SmartWalletProvider(SmartWalletProviderConfig(
        network_id=network_id,  # Use the network_id variable instead of direct env access
        signer=signer,
        smart_wallet_address=wallet_data.get("smart_wallet_address"),
        paymaster_url=None, # Place your paymaster URL here: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    ))
    
    # Save both private key and smart wallet address
    wallet_data = {
        "private_key": private_key,
        "smart_wallet_address": wallet_provider.get_address()
    }
    with open(wallet_data_file, "w") as f:
        json.dump(wallet_data, f, indent=2)

    # Initialize AgentKit
    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[
            cdp_api_action_provider(),
            erc20_action_provider(),
            wallet_action_provider(),
            weth_action_provider(),
        ]
    ))

    # Save wallet to file for reuse
    wallet_data_json = json.dumps(wallet_provider.export_wallet().to_dict())
    with open(wallet_data_file, "w") as f:
        f.write(wallet_data_json)

    return agentkit