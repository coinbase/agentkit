import pytest
from datetime import datetime, timedelta
import re
import json
from typing import Dict, Any

from artist_manager_agent.agent import (
    ArtistManagerAgent,
    ArtistProfile,
    Contract,
    Event,
    Task,
    FinancialRecord
)

@pytest.fixture
def agent():
    """Create a test agent."""
    profile = ArtistProfile(
        name="Test Artist",
        genre="Pop",
        career_stage="emerging",
        goals=["Release album"],
        strengths=["Vocals"],
        areas_for_improvement=["Marketing"],
        achievements=[],
        social_media={},
        streaming_profiles={},
        health_notes=[],
        brand_guidelines={},
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    return ArtistManagerAgent(
        artist_profile=profile,
        openai_api_key="test_key"
    )

def contains_sensitive_info(text: str) -> bool:
    """Check if text contains sensitive information patterns."""
    patterns = [
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
        r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone number
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN
        r"\b(?:\d[ -]*?){13,16}\b",  # Credit card
        r"password|secret|key|token|credential",  # Sensitive keywords
        r"api[_-]?key|access[_-]?token|secret[_-]?key"  # API credentials
    ]
    
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)

@pytest.mark.asyncio
async def test_no_sensitive_info_in_tasks(agent):
    """Test that tasks don't contain sensitive information."""
    task = Task(
        title="Contact artist via email",
        description="Send contract to artist@example.com",
        deadline=datetime.now() + timedelta(days=1),
        assigned_to="Manager",
        status="pending",
        priority=1
    )
    
    with pytest.raises(ValueError, match="contains sensitive information"):
        await agent.add_task(task)

@pytest.mark.asyncio
async def test_no_sensitive_info_in_events(agent):
    """Test that events don't contain sensitive information."""
    event = Event(
        title="Meeting with password: secret123",
        type="meeting",
        date=datetime.now(),
        venue="Office",
        capacity=10,
        budget=1000.0,
        status="scheduled"
    )
    
    with pytest.raises(ValueError, match="contains sensitive information"):
        await agent.add_event(event)

@pytest.mark.asyncio
async def test_no_sensitive_info_in_contracts(agent):
    """Test that contracts don't contain sensitive information."""
    contract = Contract(
        title="Agreement",
        parties=["Artist", "Manager"],
        terms={
            "api_key": "sk_test_123456789",
            "details": "Standard terms"
        },
        status="active",
        value=1000.0,
        expiration=datetime.now() + timedelta(days=30)
    )
    
    with pytest.raises(ValueError, match="contains sensitive information"):
        await agent.add_contract(contract)

@pytest.mark.asyncio
async def test_financial_record_amount_validation(agent):
    """Test that financial records validate amount ranges."""
    record = FinancialRecord(
        date=datetime.now(),
        type="expense",
        amount=-1000.0,  # Negative amount
        category="marketing",
        description="Marketing expenses"
    )
    
    with pytest.raises(ValueError, match="must be positive"):
        await agent.add_financial_record(record)

@pytest.mark.asyncio
async def test_input_sanitization(agent):
    """Test that inputs are properly sanitized."""
    malicious_inputs = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "${system('rm -rf /')}",
        "{{7*7}}",
        "|ls -la|",
        "\x00\x1f\x7f",  # Control characters
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4="
    ]
    
    for input_str in malicious_inputs:
        task = Task(
            title=input_str,
            description="Test task",
            deadline=datetime.now() + timedelta(days=1),
            assigned_to="Manager",
            status="pending",
            priority=1
        )
        
        with pytest.raises(ValueError, match="contains invalid characters"):
            await agent.add_task(task)

@pytest.mark.asyncio
async def test_rate_limiting(agent):
    """Test that rate limiting is enforced."""
    start_time = datetime.now()
    
    # Try to create 100 tasks rapidly
    for i in range(100):
        task = Task(
            title=f"Task {i}",
            description="Test task",
            deadline=datetime.now() + timedelta(days=1),
            assigned_to="Manager",
            status="pending",
            priority=1
        )
        await agent.add_task(task)
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # Should take at least 10 seconds due to rate limiting
    assert duration >= 10.0

@pytest.mark.asyncio
async def test_data_encryption(agent):
    """Test that sensitive data is encrypted."""
    contract = Contract(
        title="Confidential Agreement",
        parties=["Artist", "Manager"],
        terms={
            "rate": 1000,
            "confidential": True
        },
        status="active",
        value=10000.0,
        expiration=datetime.now() + timedelta(days=30)
    )
    
    await agent.add_contract(contract)
    
    # Get raw data from storage
    raw_data = agent._get_raw_contract_data(contract.id)
    
    # Verify that sensitive fields are encrypted
    assert "terms" not in raw_data
    assert "value" not in raw_data
    assert "encrypted_data" in raw_data

@pytest.mark.asyncio
async def test_access_control(agent):
    """Test that access control is properly enforced."""
    # Create a task with restricted access
    task = Task(
        title="Confidential Task",
        description="Sensitive information",
        deadline=datetime.now() + timedelta(days=1),
        assigned_to="Manager",
        status="pending",
        priority=1,
        access_level="restricted"
    )
    
    await agent.add_task(task)
    
    # Try to access with insufficient privileges
    with pytest.raises(PermissionError):
        await agent.get_task(task.id, access_level="public")
    
    # Try to access with proper privileges
    result = await agent.get_task(task.id, access_level="restricted")
    assert result.title == "Confidential Task"

@pytest.mark.asyncio
async def test_audit_logging(agent):
    """Test that all sensitive operations are logged."""
    # Perform various operations
    task = Task(
        title="Test Task",
        description="Test description",
        deadline=datetime.now() + timedelta(days=1),
        assigned_to="Manager",
        status="pending",
        priority=1
    )
    
    await agent.add_task(task)
    task.status = "completed"
    await agent.update_task(task)
    await agent.delete_task(task.id)
    
    # Get audit logs
    logs = await agent.get_audit_logs(
        start_time=datetime.now() - timedelta(minutes=5),
        end_time=datetime.now()
    )
    
    # Verify all operations were logged
    assert len(logs) == 3  # add, update, delete
    assert logs[0]["action"] == "add_task"
    assert logs[1]["action"] == "update_task"
    assert logs[2]["action"] == "delete_task"
    
    # Verify log contents
    for log in logs:
        assert "timestamp" in log
        assert "user_id" in log
        assert "action" in log
        assert "resource_id" in log
        assert "details" in log 