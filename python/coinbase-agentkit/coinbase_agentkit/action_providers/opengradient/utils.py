from coinbase_agentkit.action_providers.opengradient.constants import BLOCK_EXPLORER_URL


def create_block_explorer_link_smart_contract(transaction_hash: str) -> str:
    """Create block explorer link for smart contract."""
    block_explorer_url = BLOCK_EXPLORER_URL + "address/" + transaction_hash
    return block_explorer_url


def create_block_explorer_link_transaction(transaction_hash: str) -> str:
    """Create block explorer link for transaction."""
    block_explorer_url = BLOCK_EXPLORER_URL + "tx/" + transaction_hash
    return block_explorer_url
