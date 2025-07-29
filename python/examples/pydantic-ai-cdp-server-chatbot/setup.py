import json
import os
import time

from coinbase_agentkit import CdpEvmWalletProviderConfig

from initialize_agent import initialize_agent


async def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        tuple[Agent, dict]: The initialized agent and its configuration

    """
    # Configure network and file path
    network_id = os.getenv("NETWORK_ID", "base-sepolia")
    wallet_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load existing wallet data if available
    wallet_data = {}
    if os.path.exists(wallet_file):
        try:
            with open(wallet_file) as f:
                wallet_data = json.load(f)
                print(f"Loading existing wallet from {wallet_file}")
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data in {wallet_file}")
            wallet_data = {}

    # Get required CDP credentials
    api_key_id = os.getenv("CDP_API_KEY_ID")
    api_key_secret = os.getenv("CDP_API_KEY_SECRET")
    wallet_secret = os.getenv("CDP_WALLET_SECRET")

    if not all([api_key_id, api_key_secret, wallet_secret]):
        raise ValueError("CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET are required")

    # Create server wallet config
    config = CdpEvmWalletProviderConfig(
        api_key_id=api_key_id,
        api_key_secret=api_key_secret,
        wallet_secret=wallet_secret,
        network_id=network_id,
        address=wallet_data.get("address") or os.getenv("ADDRESS"),
        idempotency_key=os.getenv("IDEMPOTENCY_KEY"),
    )

    # Initialize the agent
    agent_executor, wallet_provider = await initialize_agent(config)

    # Save the wallet data after successful initialization
    new_wallet_data = {
        "address": wallet_provider.get_address(),
        "network_id": network_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        if not wallet_data
        else wallet_data.get("created_at"),
    }

    with open(wallet_file, "w") as f:
        json.dump(new_wallet_data, f, indent=2)
        print(f"Wallet data saved to {wallet_file}")

    return agent_executor
