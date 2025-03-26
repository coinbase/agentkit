from uuid import UUID

import pytest

from coinbase_agentkit.action_providers.nillion.nillion_action_provider import (
    NillionActionProvider,
    nillion_action_provider,
)
from tests.action_providers.nillion.conftest import TEST_SCHEMA_ID


@pytest.mark.usefixtures("mock_api_calls")
@pytest.mark.usefixtures("mock_env")
@pytest.mark.usefixtures("mock_chat_openai_basic")
def test_service_init():
    """Test constructor."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI()
    provider = nillion_action_provider(llm)
    assert isinstance(provider, NillionActionProvider)


@pytest.mark.usefixtures("mock_api_calls")
@pytest.mark.usefixtures("mock_env")
@pytest.mark.usefixtures("mock_chat_openai_schema_create")
def test_action_create_schema():
    """Test schema creation."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI()
    provider = nillion_action_provider(llm)

    schema_id, schema_def = provider.create_schema(args={"schema_description": "dummy"})
    assert schema_id is not None
    assert schema_def is not None


@pytest.mark.usefixtures("mock_api_calls")
@pytest.mark.usefixtures("mock_env")
@pytest.mark.usefixtures("mock_chat_openai_schema_lookup")
def test_action_lookup_schema():
    """Test schema lookup."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI()
    provider = nillion_action_provider(llm)

    schema_id, schema_def = provider.lookup_schema(args={"schema_description": "dummy"})
    assert schema_id is not None
    assert schema_def is not None


@pytest.mark.usefixtures("mock_api_calls")
@pytest.mark.usefixtures("mock_env")
@pytest.mark.usefixtures("mock_chat_openai_basic")
def test_action_data_download():
    """Test data download."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI()
    provider = nillion_action_provider(llm)

    result = provider.data_download(args={"schema_uuid": "dummy"})
    assert result == []


@pytest.mark.usefixtures("mock_api_calls")
@pytest.mark.usefixtures("mock_env")
@pytest.mark.usefixtures("mock_chat_openai_basic")
def test_action_data_upload():
    """Test data upload."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI()
    provider = nillion_action_provider(llm)

    result = provider.data_upload(
        args={
            "schema_uuid": TEST_SCHEMA_ID,
            "data_to_store": [
                {
                    "_id": "dummy",
                    "name": "dummy",
                }
            ],
        }
    )
    assert len(result) > 0
    assert result[0] is not None
    assert isinstance(UUID(result[0]), UUID)
