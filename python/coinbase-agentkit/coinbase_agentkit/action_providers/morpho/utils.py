from coinbase_agentkit.wallet_providers import EvmWalletProvider

ERC20_APPROVE_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    }
]


def approve(wallet: EvmWalletProvider, token_address: str, spender_address: str, amount: int):
    """Approve a spender to spend tokens on behalf of the owner."""
    try:
        contract = wallet.provider().eth.contract(address=token_address, abi=ERC20_APPROVE_ABI)
        encoded_data = contract.encode_abi("approve", args=[spender_address, amount])

        approve_tx = {
            "to": token_address,
            "data": encoded_data,
            "gas": 1000000,
            "gasPrice": 1000000000,
            "nonce": wallet.provider().eth.get_transaction_count(wallet.get_address()),
        }

        approve_tx_hash = wallet.send_transaction(approve_tx)
        approve_receipt = wallet.wait_for_transaction_receipt(approve_tx_hash)

        return approve_receipt
    except Exception as e:
        return f"Error approving tokens: {e!s}"
