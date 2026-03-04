"""Spraay Action Provider for Coinbase AgentKit.

Enables AI agents to batch-send ETH or ERC-20 tokens to multiple recipients
in a single transaction via the Spraay protocol on Base.

Contract: 0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC (Base Mainnet)
Website: https://spraay.app
"""

from typing import Any

from pydantic import BaseModel, Field

from coinbase_agentkit import ActionProvider, WalletProvider, create_action
from coinbase_agentkit.network import Network

# ── Constants ──────────────────────────────────────────────────────────────────

SPRAAY_CONTRACT_ADDRESS = "0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC"
SPRAAY_PROTOCOL_FEE_BPS = 30  # 0.3%
SPRAAY_MAX_RECIPIENTS = 200

SPRAAY_ABI = [
    {
        "name": "sprayETH",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [
            {"name": "recipients", "type": "address[]"},
            {"name": "amounts", "type": "uint256[]"},
        ],
        "outputs": [],
    },
    {
        "name": "sprayToken",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "token", "type": "address"},
            {"name": "recipients", "type": "address[]"},
            {"name": "amounts", "type": "uint256[]"},
        ],
        "outputs": [],
    },
]

ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "allowance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint8"}],
    },
    {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "string"}],
    },
]


# ── Schemas ────────────────────────────────────────────────────────────────────


class SprayEthInput(BaseModel):
    """Input schema for spraying ETH to multiple recipients."""

    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses (e.g. ['0xABC...', '0xDEF...'])",
        min_length=1,
        max_length=200,
    )
    amount_per_recipient: str = Field(
        ...,
        description="Amount of ETH to send to each recipient in whole units (e.g. '0.01')",
    )


class SprayTokenInput(BaseModel):
    """Input schema for spraying ERC-20 tokens to multiple recipients."""

    token_address: str = Field(..., description="The ERC-20 token contract address")
    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses",
        min_length=1,
        max_length=200,
    )
    amount_per_recipient: str = Field(
        ...,
        description="Amount of tokens to send to each recipient in whole units (e.g. '100')",
    )


class SprayEthVariableInput(BaseModel):
    """Input schema for spraying variable ETH amounts to multiple recipients."""

    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses",
        min_length=1,
        max_length=200,
    )
    amounts: list[str] = Field(
        ...,
        description="Array of ETH amounts corresponding to each recipient (e.g. ['0.01', '0.05'])",
        min_length=1,
    )


class SprayTokenVariableInput(BaseModel):
    """Input schema for spraying variable token amounts to multiple recipients."""

    token_address: str = Field(..., description="The ERC-20 token contract address")
    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses",
        min_length=1,
        max_length=200,
    )
    amounts: list[str] = Field(
        ...,
        description="Array of token amounts corresponding to each recipient (e.g. ['100', '50'])",
        min_length=1,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_units(value: str, decimals: int) -> int:
    """Convert a human-readable number string to an integer with the given decimals."""
    parts = value.split(".")
    if len(parts) == 1:
        return int(parts[0]) * (10**decimals)
    integer_part = parts[0]
    decimal_part = parts[1][:decimals].ljust(decimals, "0")
    return int(integer_part) * (10**decimals) + int(decimal_part)


def _format_units(value: int, decimals: int) -> str:
    """Convert a wei-like integer back to human-readable format."""
    whole = value // (10**decimals)
    fraction = value % (10**decimals)
    if fraction == 0:
        return str(whole)
    frac_str = str(fraction).zfill(decimals).rstrip("0")
    return f"{whole}.{frac_str}"


# ── Action Provider ────────────────────────────────────────────────────────────


class SpraayActionProvider(ActionProvider[WalletProvider]):
    """Spraay Action Provider — batch crypto payments on Base via the Spraay protocol."""

    def __init__(self) -> None:
        super().__init__("spraay", [])

    def supports_network(self, network: Network) -> bool:
        """Spraay is currently deployed only on Base mainnet."""
        return network.protocol_family == "evm" and network.network_id == "base-mainnet"

    # ── ETH (equal amounts) ────────────────────────────────────────────────

    @create_action(
        name="spraay_eth",
        description=(
            "Send equal amounts of ETH to multiple recipients in a single transaction "
            "via the Spraay protocol. Up to 200 recipients, ~80% gas savings. "
            "0.3% protocol fee. Deployed on Base mainnet."
        ),
        schema=SprayEthInput,
    )
    def spraay_eth(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        try:
            recipients = args["recipients"]
            amount_wei = _parse_units(args["amount_per_recipient"], 18)
            amounts = [amount_wei] * len(recipients)

            subtotal = amount_wei * len(recipients)
            fee = (subtotal * SPRAAY_PROTOCOL_FEE_BPS) // 10000
            total_value = subtotal + fee

            tx_hash = wallet_provider.send_transaction(
                to=SPRAAY_CONTRACT_ADDRESS,
                abi=SPRAAY_ABI,
                function_name="sprayETH",
                args=[recipients, amounts],
                value=total_value,
            )

            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return "\n".join([
                f"Successfully sprayed {args['amount_per_recipient']} ETH to {len(recipients)} recipients via Spraay.",
                f"Total sent: {_format_units(subtotal, 18)} ETH",
                f"Protocol fee (0.3%): {_format_units(fee, 18)} ETH",
                f"Transaction hash: {tx_hash}",
                f"Block: {receipt.get('blockNumber', 'pending')}",
                f"View on BaseScan: https://basescan.org/tx/{tx_hash}",
            ])
        except Exception as e:
            return f"Error spraying ETH via Spraay: {e}"

    # ── Token (equal amounts) ──────────────────────────────────────────────

    @create_action(
        name="spraay_token",
        description=(
            "Send equal amounts of an ERC-20 token to multiple recipients in a single "
            "transaction via the Spraay protocol. Requires token approval before first use. "
            "Up to 200 recipients. 0.3% protocol fee. Deployed on Base mainnet."
        ),
        schema=SprayTokenInput,
    )
    def spraay_token(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        try:
            token_address = args["token_address"]
            recipients = args["recipients"]

            decimals = self._get_token_decimals(wallet_provider, token_address)
            symbol = self._get_token_symbol(wallet_provider, token_address)

            amount_wei = _parse_units(args["amount_per_recipient"], decimals)
            amounts = [amount_wei] * len(recipients)

            subtotal = amount_wei * len(recipients)
            fee = (subtotal * SPRAAY_PROTOCOL_FEE_BPS) // 10000
            total_amount = subtotal + fee

            approval_msg = self._ensure_token_approval(
                wallet_provider, token_address, total_amount
            )

            tx_hash = wallet_provider.send_transaction(
                to=SPRAAY_CONTRACT_ADDRESS,
                abi=SPRAAY_ABI,
                function_name="sprayToken",
                args=[token_address, recipients, amounts],
            )

            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            lines = []
            if approval_msg:
                lines.append(approval_msg)
            lines.extend([
                f"Successfully sprayed {args['amount_per_recipient']} {symbol} to {len(recipients)} recipients via Spraay.",
                f"Total sent: {_format_units(subtotal, decimals)} {symbol}",
                f"Protocol fee (0.3%): {_format_units(fee, decimals)} {symbol}",
                f"Transaction hash: {tx_hash}",
                f"Block: {receipt.get('blockNumber', 'pending')}",
                f"View on BaseScan: https://basescan.org/tx/{tx_hash}",
            ])
            return "\n".join(lines)
        except Exception as e:
            return f"Error spraying tokens via Spraay: {e}"

    # ── ETH (variable amounts) ─────────────────────────────────────────────

    @create_action(
        name="spraay_eth_variable",
        description=(
            "Send different amounts of ETH to multiple recipients in a single transaction "
            "via the Spraay protocol. Each recipient gets a different specified amount. "
            "Up to 200 recipients. 0.3% protocol fee. Deployed on Base mainnet."
        ),
        schema=SprayEthVariableInput,
    )
    def spraay_eth_variable(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        recipients = args["recipients"]
        amount_strs = args["amounts"]

        if len(recipients) != len(amount_strs):
            return (
                f"Error: recipients length ({len(recipients)}) must match "
                f"amounts length ({len(amount_strs)})."
            )

        try:
            amounts = [_parse_units(a, 18) for a in amount_strs]
            subtotal = sum(amounts)
            fee = (subtotal * SPRAAY_PROTOCOL_FEE_BPS) // 10000
            total_value = subtotal + fee

            tx_hash = wallet_provider.send_transaction(
                to=SPRAAY_CONTRACT_ADDRESS,
                abi=SPRAAY_ABI,
                function_name="sprayETH",
                args=[recipients, amounts],
                value=total_value,
            )

            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            return "\n".join([
                f"Successfully sprayed variable ETH amounts to {len(recipients)} recipients via Spraay.",
                f"Total sent: {_format_units(subtotal, 18)} ETH",
                f"Protocol fee (0.3%): {_format_units(fee, 18)} ETH",
                f"Transaction hash: {tx_hash}",
                f"Block: {receipt.get('blockNumber', 'pending')}",
                f"View on BaseScan: https://basescan.org/tx/{tx_hash}",
            ])
        except Exception as e:
            return f"Error spraying variable ETH via Spraay: {e}"

    # ── Token (variable amounts) ───────────────────────────────────────────

    @create_action(
        name="spraay_token_variable",
        description=(
            "Send different amounts of an ERC-20 token to multiple recipients in a single "
            "transaction via the Spraay protocol. Requires token approval. "
            "Up to 200 recipients. 0.3% protocol fee. Deployed on Base mainnet."
        ),
        schema=SprayTokenVariableInput,
    )
    def spraay_token_variable(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        recipients = args["recipients"]
        amount_strs = args["amounts"]
        token_address = args["token_address"]

        if len(recipients) != len(amount_strs):
            return (
                f"Error: recipients length ({len(recipients)}) must match "
                f"amounts length ({len(amount_strs)})."
            )

        try:
            decimals = self._get_token_decimals(wallet_provider, token_address)
            symbol = self._get_token_symbol(wallet_provider, token_address)

            amounts = [_parse_units(a, decimals) for a in amount_strs]
            subtotal = sum(amounts)
            fee = (subtotal * SPRAAY_PROTOCOL_FEE_BPS) // 10000
            total_amount = subtotal + fee

            approval_msg = self._ensure_token_approval(
                wallet_provider, token_address, total_amount
            )

            tx_hash = wallet_provider.send_transaction(
                to=SPRAAY_CONTRACT_ADDRESS,
                abi=SPRAAY_ABI,
                function_name="sprayToken",
                args=[token_address, recipients, amounts],
            )

            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

            lines = []
            if approval_msg:
                lines.append(approval_msg)
            lines.extend([
                f"Successfully sprayed variable {symbol} amounts to {len(recipients)} recipients via Spraay.",
                f"Total sent: {_format_units(subtotal, decimals)} {symbol}",
                f"Protocol fee (0.3%): {_format_units(fee, decimals)} {symbol}",
                f"Transaction hash: {tx_hash}",
                f"Block: {receipt.get('blockNumber', 'pending')}",
                f"View on BaseScan: https://basescan.org/tx/{tx_hash}",
            ])
            return "\n".join(lines)
        except Exception as e:
            return f"Error spraying variable tokens via Spraay: {e}"

    # ── Private helpers ────────────────────────────────────────────────────

    def _ensure_token_approval(
        self, wallet_provider: WalletProvider, token_address: str, required: int
    ) -> str | None:
        wallet_address = wallet_provider.get_address()
        current_allowance = int(
            wallet_provider.read_contract(
                token_address, ERC20_ABI, "allowance", [wallet_address, SPRAAY_CONTRACT_ADDRESS]
            )
        )
        if current_allowance >= required:
            return None

        tx_hash = wallet_provider.send_transaction(
            to=token_address,
            abi=ERC20_ABI,
            function_name="approve",
            args=[SPRAAY_CONTRACT_ADDRESS, required],
        )
        wallet_provider.wait_for_transaction_receipt(tx_hash)
        return f"Token approval granted to Spraay contract. Approval tx: {tx_hash}"

    def _get_token_decimals(self, wallet_provider: WalletProvider, token_address: str) -> int:
        try:
            return int(wallet_provider.read_contract(token_address, ERC20_ABI, "decimals", []))
        except Exception:
            return 18

    def _get_token_symbol(self, wallet_provider: WalletProvider, token_address: str) -> str:
        try:
            return str(wallet_provider.read_contract(token_address, ERC20_ABI, "symbol", []))
        except Exception:
            return "TOKEN"


def spraay_action_provider() -> SpraayActionProvider:
    """Factory function to create a new SpraayActionProvider instance.

    Example::

        from spraay_action_provider import spraay_action_provider

        agent_kit = AgentKit(AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[spraay_action_provider()],
        ))
    """
    return SpraayActionProvider()
