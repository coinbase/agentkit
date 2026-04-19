"""Vaultfire action provider for on-chain trust infrastructure.

Gives any AgentKit agent on-chain trust through the Vaultfire Protocol:
  - ERC-8004 agent identity registration
  - AI Accountability Bonds (single-agent stake)
  - AI Partnership Bonds (mutual agent-to-agent stake)
  - On-chain reputation lookup
  - Vaultfire Name Service (VNS) resolution

Works on Base, Arbitrum, Polygon, and Avalanche.
"""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import (
    ACCOUNTABILITY_BONDS_ABI,
    ACCOUNTABILITY_BONDS_ADDRESSES,
    AGENT_TYPE_MAP,
    EXPLORER_URLS,
    IDENTITY_REGISTRY_ABI,
    IDENTITY_REGISTRY_ADDRESSES,
    PARTNERSHIP_BONDS_ABI,
    PARTNERSHIP_BONDS_ADDRESSES,
    REPUTATION_REGISTRY_ABI,
    REPUTATION_REGISTRY_ADDRESSES,
    SUPPORTED_NETWORKS,
    VNS_ABI,
    VNS_ADDRESSES,
)
from .schemas import (
    CreateAccountabilityBondSchema,
    CreatePartnershipBondSchema,
    GetBondSchema,
    GetReputationSchema,
    GetTrustProfileSchema,
    RegisterAgentSchema,
    ResolveVnsSchema,
)


def _network_id(wallet_provider: EvmWalletProvider) -> str:
    """Extract the network ID from a wallet provider."""
    return wallet_provider.get_network().network_id or ""


def _explorer_link(network_id: str, tx_hash: str) -> str:
    """Build a block explorer link for a transaction hash."""
    base = EXPLORER_URLS.get(network_id, "")
    if not base:
        return tx_hash
    return f"{base}/tx/{tx_hash}"


class VaultfireActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with the Vaultfire Protocol.

    Vaultfire is on-chain trust infrastructure for AI agents, implementing
    ERC-8004 (AI Agent Identity). It enables agents to register identities,
    stake bonds for accountability, build reputation, and discover each
    other through the Vaultfire Name Service (VNS).
    """

    def __init__(self):
        super().__init__("vaultfire", [])

    # ─────────────────────────────────────────────────────
    # WRITE ACTIONS
    # ─────────────────────────────────────────────────────

    @create_action(
        name="register_agent",
        description="""
Register an ERC-8004 on-chain identity for this agent on the Vaultfire Protocol.
This is the first step to establishing trust — it creates a permanent, verifiable
identity on-chain that other agents and protocols can reference.

It takes:
- name: A human-readable name for the agent (e.g. 'trading-bot-alpha')
- agent_type: One of 'autonomous', 'assistant', 'specialized', or 'multi_agent'

The agent's wallet address becomes its on-chain identity. This action is free
(gas only, no token payment required).
""",
        schema=RegisterAgentSchema,
    )
    def register_agent(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Register an ERC-8004 agent identity on the Vaultfire Protocol.

        Args:
            wallet_provider: The wallet to use for the registration.
            args: The input arguments for the registration.

        Returns:
            str: A message containing the result of the registration.

        """
        try:
            validated = RegisterAgentSchema(**args)
            net_id = _network_id(wallet_provider)
            address = Web3.to_checksum_address(wallet_provider.get_address())

            registry_address = IDENTITY_REGISTRY_ADDRESSES.get(net_id)
            if not registry_address:
                return (
                    f"Error: Vaultfire Identity Registry not deployed on {net_id}. "
                    f"Supported networks: {', '.join(IDENTITY_REGISTRY_ADDRESSES.keys())}"
                )

            registry_address = Web3.to_checksum_address(registry_address)

            # Check if already registered
            try:
                is_registered = wallet_provider.read_contract(
                    contract_address=registry_address,
                    abi=IDENTITY_REGISTRY_ABI,
                    function_name="isRegistered",
                    args=[address],
                )
                if is_registered:
                    return (
                        f"Agent {address} is already registered on Vaultfire ({net_id}). "
                        f"No action needed."
                    )
            except Exception:
                pass  # If read fails, proceed with registration attempt

            agent_type_uint8 = AGENT_TYPE_MAP.get(validated.agent_type, 0)

            w3 = Web3()
            contract = w3.eth.contract(
                address=registry_address, abi=IDENTITY_REGISTRY_ABI
            )
            data = contract.encode_abi(
                "registerAgent",
                args=[validated.name, agent_type_uint8, address],
            )

            tx_hash = wallet_provider.send_transaction(
                {"to": registry_address, "data": data}
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            explorer_link = _explorer_link(net_id, tx_hash)
            return (
                f"Successfully registered agent '{validated.name}' "
                f"(type: {validated.agent_type}) on Vaultfire ({net_id}).\n"
                f"Address: {address}\n"
                f"Transaction: {explorer_link}"
            )
        except Exception as e:
            return f"Error registering agent: {e!s}"

    @create_action(
        name="create_accountability_bond",
        description="""
Create an AI Accountability Bond on the Vaultfire Protocol.
This stakes native tokens (ETH on Base/Arbitrum, AVAX on Avalanche, POL on Polygon)
as a guarantee of the agent's good behavior. If the agent acts maliciously,
the bond can be slashed. This is the core trust mechanism of Vaultfire.

It takes:
- amount: Amount of native token to stake (e.g. '0.01' for 0.01 ETH)

The agent must be registered first (use register_agent).
The minimum stake is determined by the contract's MIN_VERIFICATION_STAKE.
""",
        schema=CreateAccountabilityBondSchema,
    )
    def create_accountability_bond(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Create a stake-backed accountability bond.

        Args:
            wallet_provider: The wallet to use for the bond creation.
            args: The input arguments for the bond creation.

        Returns:
            str: A message containing the result of the bond creation.

        """
        try:
            validated = CreateAccountabilityBondSchema(**args)
            net_id = _network_id(wallet_provider)

            bond_address = ACCOUNTABILITY_BONDS_ADDRESSES.get(net_id)
            if not bond_address:
                return (
                    f"Error: Vaultfire Accountability Bonds not deployed on {net_id}. "
                    f"Supported: {', '.join(ACCOUNTABILITY_BONDS_ADDRESSES.keys())}"
                )

            bond_address = Web3.to_checksum_address(bond_address)
            stake_wei = Web3.to_wei(validated.amount, "ether")

            w3 = Web3()
            contract = w3.eth.contract(address=bond_address, abi=ACCOUNTABILITY_BONDS_ABI)
            data = contract.encode_abi("createAccountabilityBond")

            tx_hash = wallet_provider.send_transaction(
                {"to": bond_address, "data": data, "value": stake_wei}
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            explorer_link = _explorer_link(net_id, tx_hash)
            return (
                f"Successfully created Accountability Bond on Vaultfire ({net_id}).\n"
                f"Staked: {validated.amount} native token\n"
                f"Transaction: {explorer_link}"
            )
        except Exception as e:
            return f"Error creating accountability bond: {e!s}"

    @create_action(
        name="create_partnership_bond",
        description="""
Create an AI Partnership Bond between this agent and another agent on Vaultfire.
This is a mutual trust mechanism — both agents stake native tokens to guarantee
their partnership. It creates a verifiable on-chain record of agent collaboration.

It takes:
- partner_address: The 0x address of the partner agent
- amount: Amount of native token to stake (e.g. '0.01')

Both agents should be registered first. The partner can also stake into the bond
separately to make it mutual.
""",
        schema=CreatePartnershipBondSchema,
    )
    def create_partnership_bond(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Create a mutual trust bond between two agents.

        Args:
            wallet_provider: The wallet to use for the bond creation.
            args: The input arguments for the bond creation.

        Returns:
            str: A message containing the result of the bond creation.

        """
        try:
            validated = CreatePartnershipBondSchema(**args)
            net_id = _network_id(wallet_provider)

            bond_address = PARTNERSHIP_BONDS_ADDRESSES.get(net_id)
            if not bond_address:
                return (
                    f"Error: Vaultfire Partnership Bonds not deployed on {net_id}. "
                    f"Supported: {', '.join(PARTNERSHIP_BONDS_ADDRESSES.keys())}"
                )

            bond_address = Web3.to_checksum_address(bond_address)
            partner = Web3.to_checksum_address(validated.partner_address)
            stake_wei = Web3.to_wei(validated.amount, "ether")

            w3 = Web3()
            contract = w3.eth.contract(address=bond_address, abi=PARTNERSHIP_BONDS_ABI)
            data = contract.encode_abi("createPartnershipBond", args=[partner])

            tx_hash = wallet_provider.send_transaction(
                {"to": bond_address, "data": data, "value": stake_wei}
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            explorer_link = _explorer_link(net_id, tx_hash)
            return (
                f"Successfully created Partnership Bond on Vaultfire ({net_id}).\n"
                f"Partner: {partner}\n"
                f"Staked: {validated.amount} native token\n"
                f"Transaction: {explorer_link}"
            )
        except Exception as e:
            return f"Error creating partnership bond: {e!s}"

    # ─────────────────────────────────────────────────────
    # READ ACTIONS
    # ─────────────────────────────────────────────────────

    @create_action(
        name="get_trust_profile",
        description="""
Look up the full trust profile of any agent on the Vaultfire Protocol.
Returns whether the agent is registered, its identity details, reputation score,
and VNS name if one exists. Use this to verify an agent before interacting with it.

It takes:
- agent_address: The 0x address to look up
""",
        schema=GetTrustProfileSchema,
    )
    def get_trust_profile(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Read the full on-chain trust profile of an agent.

        Args:
            wallet_provider: The wallet to use for reading.
            args: The input arguments for the profile lookup.

        Returns:
            str: A formatted string with the agent's trust profile.

        """
        try:
            validated = GetTrustProfileSchema(**args)
            net_id = _network_id(wallet_provider)
            agent = Web3.to_checksum_address(validated.agent_address)

            registry_address = IDENTITY_REGISTRY_ADDRESSES.get(net_id)
            if not registry_address:
                return f"Error: Vaultfire not deployed on {net_id}."

            registry_address = Web3.to_checksum_address(registry_address)

            # Check registration
            is_registered = wallet_provider.read_contract(
                contract_address=registry_address,
                abi=IDENTITY_REGISTRY_ABI,
                function_name="isRegistered",
                args=[agent],
            )

            if not is_registered:
                return (
                    f"Agent {agent} is NOT registered on Vaultfire ({net_id}). "
                    f"No trust profile exists."
                )

            # Get identity details
            identity = wallet_provider.read_contract(
                contract_address=registry_address,
                abi=IDENTITY_REGISTRY_ABI,
                function_name="getAgentIdentity",
                args=[agent],
            )

            agent_type_names = {
                0: "autonomous",
                1: "assistant",
                2: "specialized",
                3: "multi_agent",
            }
            type_name = agent_type_names.get(identity[1], "unknown")

            result = (
                f"Vaultfire Trust Profile for {agent} ({net_id}):\n"
                f"  Registered: Yes\n"
                f"  Name: {identity[0]}\n"
                f"  Type: {type_name}\n"
                f"  Operator: {identity[2]}\n"
                f"  Active: {identity[3]}\n"
                f"  Registered At: block {identity[4]}\n"
            )

            # Try reputation
            rep_address = REPUTATION_REGISTRY_ADDRESSES.get(net_id)
            if rep_address:
                try:
                    rep = wallet_provider.read_contract(
                        contract_address=Web3.to_checksum_address(rep_address),
                        abi=REPUTATION_REGISTRY_ABI,
                        function_name="getReputation",
                        args=[agent],
                    )
                    result += (
                        f"  Reputation Score: {rep[0]}/100\n"
                        f"  Total Ratings: {rep[1]}\n"
                    )
                except Exception:
                    result += "  Reputation: Not yet rated\n"

            # Try VNS
            vns_address = VNS_ADDRESSES.get(net_id)
            if vns_address:
                try:
                    vns_name = wallet_provider.read_contract(
                        contract_address=Web3.to_checksum_address(vns_address),
                        abi=VNS_ABI,
                        function_name="reverseResolve",
                        args=[agent],
                    )
                    if vns_name:
                        result += f"  VNS Name: {vns_name}\n"
                except Exception:
                    pass

            explorer = EXPLORER_URLS.get(net_id, "")
            if explorer:
                result += f"  Explorer: {explorer}/address/{agent}"

            return result
        except Exception as e:
            return f"Error reading trust profile: {e!s}"

    @create_action(
        name="get_reputation",
        description="""
Check the on-chain reputation score of an agent on the Vaultfire Protocol.
Returns the average rating (0-100), total number of ratings, and last update time.

It takes:
- agent_address: The 0x address of the agent to check
""",
        schema=GetReputationSchema,
    )
    def get_reputation(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Read an agent's on-chain reputation.

        Args:
            wallet_provider: The wallet to use for reading.
            args: The input arguments for the reputation lookup.

        Returns:
            str: A formatted string with the agent's reputation data.

        """
        try:
            validated = GetReputationSchema(**args)
            net_id = _network_id(wallet_provider)
            agent = Web3.to_checksum_address(validated.agent_address)

            rep_address = REPUTATION_REGISTRY_ADDRESSES.get(net_id)
            if not rep_address:
                return f"Error: Vaultfire Reputation Registry not deployed on {net_id}."

            rep = wallet_provider.read_contract(
                contract_address=Web3.to_checksum_address(rep_address),
                abi=REPUTATION_REGISTRY_ABI,
                function_name="getReputation",
                args=[agent],
            )

            return (
                f"Vaultfire Reputation for {agent} ({net_id}):\n"
                f"  Average Rating: {rep[0]}/100\n"
                f"  Total Ratings: {rep[1]}\n"
                f"  Last Updated: block {rep[2]}"
            )
        except Exception as e:
            return f"Error reading reputation: {e!s}"

    @create_action(
        name="resolve_vns",
        description="""
Resolve a Vaultfire Name Service (VNS) name to an on-chain address,
or reverse-resolve an address to its VNS name.

VNS names are the agent-facing naming system on Vaultfire (like ENS but for AI agents).

It takes:
- query: A .vns name (e.g. 'trading-bot.vns') or a 0x address
""",
        schema=ResolveVnsSchema,
    )
    def resolve_vns(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Resolve a VNS name or reverse-resolve an address.

        Args:
            wallet_provider: The wallet to use for reading.
            args: The input arguments for the VNS resolution.

        Returns:
            str: A message with the resolved name or address.

        """
        try:
            validated = ResolveVnsSchema(**args)
            net_id = _network_id(wallet_provider)

            vns_address = VNS_ADDRESSES.get(net_id)
            if not vns_address:
                return (
                    f"Error: VNS not deployed on {net_id}. "
                    f"Supported: {', '.join(VNS_ADDRESSES.keys())}"
                )

            vns_address = Web3.to_checksum_address(vns_address)
            query = validated.query.strip()

            if query.startswith("0x") and len(query) == 42:
                # Reverse resolve: address → name
                agent = Web3.to_checksum_address(query)
                name = wallet_provider.read_contract(
                    contract_address=vns_address,
                    abi=VNS_ABI,
                    function_name="reverseResolve",
                    args=[agent],
                )
                if name:
                    return f"VNS reverse lookup: {agent} → {name}"
                else:
                    return f"No VNS name registered for {agent} on {net_id}."
            else:
                # Forward resolve: name → address
                resolved = wallet_provider.read_contract(
                    contract_address=vns_address,
                    abi=VNS_ABI,
                    function_name="resolveName",
                    args=[query],
                )
                zero = "0x" + "0" * 40
                if resolved and resolved != zero:
                    return f"VNS lookup: {query} → {resolved}"
                else:
                    return f"VNS name '{query}' is not registered on {net_id}."
        except Exception as e:
            return f"Error resolving VNS: {e!s}"

    @create_action(
        name="get_bond",
        description="""
Look up the details of a specific bond on the Vaultfire Protocol by its bond ID.

It takes:
- bond_id: The numeric ID of the bond
- bond_type: Either 'partnership' or 'accountability'
""",
        schema=GetBondSchema,
    )
    def get_bond(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Read the details of a specific bond.

        Args:
            wallet_provider: The wallet to use for reading.
            args: The input arguments for the bond lookup.

        Returns:
            str: A formatted string with the bond details.

        """
        try:
            validated = GetBondSchema(**args)
            net_id = _network_id(wallet_provider)

            if validated.bond_type == "partnership":
                address = PARTNERSHIP_BONDS_ADDRESSES.get(net_id)
                abi = PARTNERSHIP_BONDS_ABI
                label = "Partnership Bond"
            else:
                address = ACCOUNTABILITY_BONDS_ADDRESSES.get(net_id)
                abi = ACCOUNTABILITY_BONDS_ABI
                label = "Accountability Bond"

            if not address:
                return f"Error: {label} contract not deployed on {net_id}."

            bond = wallet_provider.read_contract(
                contract_address=Web3.to_checksum_address(address),
                abi=abi,
                function_name="getBond",
                args=[validated.bond_id],
            )

            stake_eth = Web3.from_wei(
                bond[1] if validated.bond_type == "accountability" else bond[2],
                "ether",
            )

            if validated.bond_type == "partnership":
                return (
                    f"Vaultfire {label} #{validated.bond_id} ({net_id}):\n"
                    f"  Creator: {bond[0]}\n"
                    f"  Partner: {bond[1]}\n"
                    f"  Stake: {stake_eth} native token\n"
                    f"  Created At: block {bond[3]}\n"
                    f"  Active: {bond[4]}"
                )
            else:
                return (
                    f"Vaultfire {label} #{validated.bond_id} ({net_id}):\n"
                    f"  Creator: {bond[0]}\n"
                    f"  Stake: {stake_eth} native token\n"
                    f"  Created At: block {bond[2]}\n"
                    f"  Active: {bond[3]}"
                )
        except Exception as e:
            return f"Error reading bond: {e!s}"

    # ─────────────────────────────────────────────────────
    # NETWORK SUPPORT
    # ─────────────────────────────────────────────────────

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Vaultfire."""
        return (
            network.protocol_family == "evm"
            and network.network_id in SUPPORTED_NETWORKS
        )


def vaultfire_action_provider() -> VaultfireActionProvider:
    """Create a new VaultfireActionProvider instance."""
    return VaultfireActionProvider()
