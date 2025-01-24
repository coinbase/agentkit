from cdp import Wallet

from cdp_agentkit_core.actions.constants import ERC20_APPROVE_ABI


def approve(wallet: Wallet, token_address: str, spender: str, amount: int) -> str:
    """Approve a spender to spend a specified amount of tokens.

    Args:
        wallet (Wallet): The wallet to execute the approval from
        token_address (str): The address of the token contract
        spender (str): The address of the spender
        amount (int): The amount of tokens to approve

    Returns:
        str: A success message with transaction hash or error message

    """
    try:
        amount_str = str(amount)

        invocation = wallet.invoke_contract(
            contract_address=token_address,
            method="approve",
            abi=ERC20_APPROVE_ABI,
            args={
                "spender": spender,
                "value": amount_str,
            },
        ).wait()

        return f"Approved {amount} tokens for {spender} with transaction hash: {invocation.transaction_hash} and transaction link: {invocation.transaction_link}"

    except Exception as e:
        return f"Error approving tokens: {e!s}"
