"""Pydantic input schemas for Vaultfire AgentKit actions."""

from typing import Literal

from pydantic import BaseModel, Field


class RegisterAgentSchema(BaseModel):
    """Input schema for registering an ERC-8004 agent identity on-chain."""

    name: str = Field(
        ...,
        description="A human-readable name for the agent, e.g. 'trading-bot-alpha' or 'research-agent-v2'.",
    )
    agent_type: Literal["autonomous", "assistant", "specialized", "multi_agent"] = Field(
        default="autonomous",
        description="The category of agent: 'autonomous' (fully self-directed), 'assistant' (human-guided), 'specialized' (single-domain), or 'multi_agent' (part of a swarm).",
    )


class CreateAccountabilityBondSchema(BaseModel):
    """Input schema for creating a single-agent accountability bond."""

    amount: str = Field(
        ...,
        description="Amount of native token to stake in the bond, in human-readable format (e.g. '0.01' for 0.01 ETH on Base).",
    )


class CreatePartnershipBondSchema(BaseModel):
    """Input schema for creating a partnership bond between two agents."""

    partner_address: str = Field(
        ...,
        description="The on-chain address of the partner agent to bond with.",
    )
    amount: str = Field(
        ...,
        description="Amount of native token to stake in the partnership bond, in human-readable format (e.g. '0.01').",
    )


class GetTrustProfileSchema(BaseModel):
    """Input schema for reading an agent's full trust profile."""

    agent_address: str = Field(
        ...,
        description="The on-chain address of the agent to look up.",
    )


class GetReputationSchema(BaseModel):
    """Input schema for reading an agent's reputation score."""

    agent_address: str = Field(
        ...,
        description="The on-chain address of the agent whose reputation to check.",
    )


class ResolveVnsSchema(BaseModel):
    """Input schema for resolving a VNS name to an address, or reverse-resolving an address to a name."""

    query: str = Field(
        ...,
        description="Either a .vns name (e.g. 'trading-bot.vns') to resolve to an address, or an 0x address to reverse-resolve to a name.",
    )


class GetBondSchema(BaseModel):
    """Input schema for reading the details of a specific bond."""

    bond_id: int = Field(
        ...,
        description="The numeric ID of the bond to look up.",
    )
    bond_type: Literal["partnership", "accountability"] = Field(
        default="accountability",
        description="Whether to look up a partnership bond or an accountability bond.",
    )
