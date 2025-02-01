"""Tests for the CDP Tool."""

from typing import Any
from unittest.mock import Mock, patch

import pytest
from langchain_core.callbacks import CallbackManager
from pydantic import BaseModel

from cdp_langchain.tools import CdpTool
from cdp_langchain.utils import CdpAgentkitWrapper


class TestArgsSchema(BaseModel):
    """Test schema for validating input arguments."""

    test_param: str


@pytest.fixture
def mock_cdp_agentkit_wrapper():
    """Fixture for mocked CDP Agentkit wrapper."""
    with patch("cdp_langchain.tools.cdp_tool.CdpAgentkitWrapper") as mock:
        cdp_agentkit_wrapper = Mock(spec=CdpAgentkitWrapper)
        mock.return_value = cdp_agentkit_wrapper
        yield cdp_agentkit_wrapper


@pytest.fixture
def cdp_tool(mock_cdp_agentkit_wrapper):
    """Fixture for CDP Tool."""
    return CdpTool(
        cdp_agentkit_wrapper=mock_cdp_agentkit_wrapper,
        name="test_action",
        description="Test CDP Tool",
        func=lambda x: x,
    )


@pytest.fixture
def cdp_tool_with_schema(mock_cdp_agentkit_wrapper):
    """Fixture for CDP Tool with args schema."""
    return CdpTool(
        cdp_agentkit_wrapper=mock_cdp_agentkit_wrapper,
        name="test_action_with_schema",
        description="Test CDP Tool",
        args_schema=TestArgsSchema,
        func=lambda x: x,
    )


def test_initialization(mock_cdp_agentkit_wrapper):
    """Test basic initialization of CDP Tool."""
    tool = CdpTool(
        cdp_agentkit_wrapper=mock_cdp_agentkit_wrapper,
        name="test_action",
        description="Test CDP Tool",
        func=lambda x: x,
    )
    assert tool.name == "test_action"


def test_run_with_instructions(cdp_tool):
    """Test running CDP Tool with instructions."""
    cdp_tool.cdp_agentkit_wrapper.run_action.return_value = "success"
    result = cdp_tool._run(instructions="test instructions")

    cdp_tool.cdp_agentkit_wrapper.run_action.assert_called_once_with(
        cdp_tool.func, instructions="test instructions"
    )
    assert result == "success"


def test_run_with_empty_instructions(cdp_tool):
    """Test running CDP Tool with empty instructions."""
    cdp_tool.cdp_agentkit_wrapper.run_action.return_value = "success"

    # Test various empty input scenarios
    empty_inputs = ["", "{}", None]
    for empty_input in empty_inputs:
        result = cdp_tool._run(instructions=empty_input)
        cdp_tool.cdp_agentkit_wrapper.run_action.assert_called_with(cdp_tool.func, instructions="")
        assert result == "success"


def test_run_with_schema(cdp_tool_with_schema):
    """Test running CDP Tool with args schema."""
    cdp_tool_with_schema.cdp_agentkit_wrapper.run_action.return_value = "success"

    result = cdp_tool_with_schema._run(test_param="test")

    cdp_tool_with_schema.cdp_agentkit_wrapper.run_action.assert_called_once_with(
        cdp_tool_with_schema.func, test_param="test"
    )
    assert result == "success"


def test_run_with_callback_manager(cdp_tool):
    """Test running CDP Tool with callback manager."""
    cdp_tool.cdp_agentkit_wrapper.run_action.return_value = "success"
    callback_manager = CallbackManager([])

    result = cdp_tool._run(instructions="test", run_manager=callback_manager)

    cdp_tool.cdp_agentkit_wrapper.run_action.assert_called_once_with(
        cdp_tool.func, instructions="test"
    )
    assert result == "success"


def test_run_with_invalid_schema_data(cdp_tool_with_schema):
    """Test running CDP Tool with invalid schema data."""
    with pytest.raises(ValueError):
        cdp_tool_with_schema._run(invalid_param="test")


@pytest.mark.parametrize(
    "input_data",
    [
        {"test_param": "test"},
        {"test_param": "another_test"},
    ],
)
def test_run_with_different_valid_inputs(cdp_tool_with_schema, input_data: dict[str, Any]):
    """Test running CDP Tool with different valid inputs."""
    cdp_tool_with_schema.cdp_agentkit_wrapper.run_action.return_value = "success"

    result = cdp_tool_with_schema._run(**input_data)

    cdp_tool_with_schema.cdp_agentkit_wrapper.run_action.assert_called_once_with(
        cdp_tool_with_schema.func, **input_data
    )
    assert result == "success"
