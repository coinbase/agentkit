from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field
from web3 import Web3
from web3.exceptions import ContractLogicError

from cdp_agentkit_core.actions import CdpAction

# Constants
REGISTER_BASENAME_PROMPT = """
This tool will register a Basename for the agent. The agent should have a wallet associated to register a Basename.
When your network ID is 'base-mainnet' (also sometimes known simply as 'base'), the name must end with .base.eth, and when your network ID is 'base-sepolia', it must ends with .basetest.eth.
Do not suggest any alternatives and never try to register a Basename with another postfix. The prefix of the name must be unique so if the registration of the
Basename fails, you should prompt to try again with a more unique name.
"""

# Contract addresses
BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET = "0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5"
BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET = "0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581"
L2_RESOLVER_ADDRESS_MAINNET = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD"
L2_RESOLVER_ADDRESS_TESTNET = "0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA"

# Default registration duration (1 year in seconds)
REGISTRATION_DURATION = "31557600"


class RegisterBasenameInput(BaseModel):
    """Input argument schema for registering a Basename."""

    basename: str = Field(
        ...,
        description="The Basename to assign to the agent (e.g., `example.base.eth` or `example.basetest.eth`)",
    )
    amount: str = Field(
        ..., description="The amount of Eth to pay for registration. The default is set to 0.002."
    )


def register_basename(wallet: Wallet, basename: str, amount: str = "0.002") -> str:
    """Register a Basename for the agent.

    Args:
        wallet (Wallet): The wallet to register the Basename with.
        basename (str): The Basename to assign to the agent.
        amount (str): The amount of ETH to pay for the registration. The default is set to 0.002.

    Returns:
        str: Confirmation message with the basename.

    """
    address_id = wallet.default_address.address_id
    is_mainnet = wallet.network_id == "base-mainnet"

    suffix = ".base.eth" if is_mainnet else ".basetest.eth"
    if not basename.endswith(suffix):
        basename += suffix

    register_args = create_register_contract_method_args(basename, address_id, is_mainnet)

    try:
        contract_address = (
            BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET
            if is_mainnet
            else BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET
        )

        invocation = wallet.invoke_contract(
            contract_address=contract_address,
            method="register",
            args=register_args,
            abi=registrar_abi,
            amount=amount,
            asset_id="eth",
        )
        invocation.wait()
        return f"Successfully registered basename {basename} for address {address_id}"
    except ContractLogicError as e:
        return f"Error registering basename: {e!s}"
    except Exception as e:
        return f"Unexpected error registering basename: {e!s}"


# Function to create registration arguments for Basenames
def create_register_contract_method_args(base_name: str, address_id: str, is_mainnet: bool) -> dict:
    """Create registration arguments for Basenames.

    Args:
        base_name (str): The Basename (e.g., "example.base.eth" or "example.basetest.eth")
        address_id (str): The Ethereum address
        is_mainnet (bool): True if on mainnet, False if on testnet

    Returns:
        dict: Formatted arguments for the register contract method

    """
    w3 = Web3()

    resolver_contract = w3.eth.contract(abi=l2_resolver_abi)

    name_hash = w3.ens.namehash(base_name)

    address_data = resolver_contract.encode_abi("setAddr", args=[name_hash, address_id])

    name_data = resolver_contract.encode_abi("setName", args=[name_hash, base_name])

    register_args = {
        "request": [
            base_name.replace(".base.eth" if is_mainnet else ".basetest.eth", ""),
            address_id,
            REGISTRATION_DURATION,
            L2_RESOLVER_ADDRESS_MAINNET if is_mainnet else L2_RESOLVER_ADDRESS_TESTNET,
            [address_data, name_data],
            True,
        ]
    }

    return register_args


# ABIs for smart contracts (used in basename registration)
l2_resolver_abi = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "node", "type": "bytes32"},
            {"internalType": "address", "name": "a", "type": "address"},
        ],
        "name": "setAddr",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "node", "type": "bytes32"},
            {"internalType": "string", "name": "newName", "type": "string"},
        ],
        "name": "setName",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

registrar_abi = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "string", "name": "name", "type": "string"},
                    {"internalType": "address", "name": "owner", "type": "address"},
                    {"internalType": "uint256", "name": "duration", "type": "uint256"},
                    {"internalType": "address", "name": "resolver", "type": "address"},
                    {"internalType": "bytes[]", "name": "data", "type": "bytes[]"},
                    {"internalType": "bool", "name": "reverseRecord", "type": "bool"},
                ],
                "internalType": "struct RegistrarController.RegisterRequest",
                "name": "request",
                "type": "tuple",
            }
        ],
        "name": "register",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    }
]


class RegisterBasenameAction(CdpAction):
    """Register Basename action."""

    name: str = "register_basename"
    description: str = REGISTER_BASENAME_PROMPT
    args_schema: type[BaseModel] | None = RegisterBasenameInput
    func: Callable[..., str] = register_basename
