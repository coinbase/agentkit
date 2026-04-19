"""Tests for Vaultfire input schemas — validation and field constraints."""

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.vaultfire.schemas import (
    CreateAccountabilityBondSchema,
    CreatePartnershipBondSchema,
    GetBondSchema,
    GetReputationSchema,
    GetTrustProfileSchema,
    RegisterAgentSchema,
    ResolveVnsSchema,
)


# ──────────────────────────────────────────────────
# RegisterAgentSchema
# ──────────────────────────────────────────────────

def test_register_agent_valid():
    """Test valid registration schema."""
    schema = RegisterAgentSchema(name="test-agent", agent_type="autonomous")
    assert schema.name == "test-agent"
    assert schema.agent_type == "autonomous"


def test_register_agent_default_type():
    """Test that agent_type defaults to 'autonomous'."""
    schema = RegisterAgentSchema(name="test-agent")
    assert schema.agent_type == "autonomous"


def test_register_agent_all_types():
    """Test all valid agent types."""
    for agent_type in ["autonomous", "assistant", "specialized", "multi_agent"]:
        schema = RegisterAgentSchema(name="test", agent_type=agent_type)
        assert schema.agent_type == agent_type


def test_register_agent_invalid_type():
    """Test that an invalid agent type is rejected."""
    with pytest.raises(ValidationError):
        RegisterAgentSchema(name="test", agent_type="invalid")


def test_register_agent_name_required():
    """Test that name is required."""
    with pytest.raises(ValidationError):
        RegisterAgentSchema()


# ──────────────────────────────────────────────────
# CreateAccountabilityBondSchema
# ──────────────────────────────────────────────────

def test_accountability_bond_valid():
    """Test valid accountability bond schema."""
    schema = CreateAccountabilityBondSchema(amount="0.01")
    assert schema.amount == "0.01"


def test_accountability_bond_amount_required():
    """Test that amount is required."""
    with pytest.raises(ValidationError):
        CreateAccountabilityBondSchema()


# ──────────────────────────────────────────────────
# CreatePartnershipBondSchema
# ──────────────────────────────────────────────────

def test_partnership_bond_valid():
    """Test valid partnership bond schema."""
    schema = CreatePartnershipBondSchema(
        partner_address="0x1234567890123456789012345678901234567890",
        amount="0.05",
    )
    assert schema.partner_address == "0x1234567890123456789012345678901234567890"
    assert schema.amount == "0.05"


def test_partnership_bond_both_fields_required():
    """Test that both fields are required."""
    with pytest.raises(ValidationError):
        CreatePartnershipBondSchema(amount="0.01")
    with pytest.raises(ValidationError):
        CreatePartnershipBondSchema(partner_address="0x1234")


# ──────────────────────────────────────────────────
# GetTrustProfileSchema
# ──────────────────────────────────────────────────

def test_trust_profile_valid():
    """Test valid trust profile schema."""
    schema = GetTrustProfileSchema(
        agent_address="0x1234567890123456789012345678901234567890"
    )
    assert schema.agent_address == "0x1234567890123456789012345678901234567890"


# ──────────────────────────────────────────────────
# GetReputationSchema
# ──────────────────────────────────────────────────

def test_reputation_valid():
    """Test valid reputation schema."""
    schema = GetReputationSchema(
        agent_address="0x1234567890123456789012345678901234567890"
    )
    assert schema.agent_address == "0x1234567890123456789012345678901234567890"


# ──────────────────────────────────────────────────
# ResolveVnsSchema
# ──────────────────────────────────────────────────

def test_vns_resolve_name():
    """Test VNS name resolution schema."""
    schema = ResolveVnsSchema(query="trading-bot.vns")
    assert schema.query == "trading-bot.vns"


def test_vns_resolve_address():
    """Test VNS reverse resolution schema."""
    schema = ResolveVnsSchema(
        query="0x1234567890123456789012345678901234567890"
    )
    assert schema.query.startswith("0x")


# ──────────────────────────────────────────────────
# GetBondSchema
# ──────────────────────────────────────────────────

def test_bond_schema_valid():
    """Test valid bond schema."""
    schema = GetBondSchema(bond_id=1, bond_type="accountability")
    assert schema.bond_id == 1
    assert schema.bond_type == "accountability"


def test_bond_schema_partnership():
    """Test partnership bond type."""
    schema = GetBondSchema(bond_id=5, bond_type="partnership")
    assert schema.bond_type == "partnership"


def test_bond_schema_default_type():
    """Test that bond_type defaults to 'accountability'."""
    schema = GetBondSchema(bond_id=1)
    assert schema.bond_type == "accountability"


def test_bond_schema_invalid_type():
    """Test that an invalid bond type is rejected."""
    with pytest.raises(ValidationError):
        GetBondSchema(bond_id=1, bond_type="invalid")
