"""Tests for SSH connection pool.

This module provides comprehensive tests for the SSHConnectionPool class
and its interaction with SSHConnection.
"""

from unittest import mock

import pytest

from coinbase_agentkit.action_providers.ssh.connection import (
    SSHConnection,
    SSHConnectionError,
    SSHConnectionParams,
)
from coinbase_agentkit.action_providers.ssh.connection_pool import SSHConnectionPool

MOCK_CONNECTION_ID = "test-conn"
MOCK_HOST = "example.com"
MOCK_USERNAME = "testuser"
MOCK_PASSWORD = "testpass"

MOCK_CONNECTION_ID2 = "test-conn2"
MOCK_HOST2 = "example2.com"
MOCK_USERNAME2 = "testuser2"
MOCK_PASSWORD2 = "testpass2"


@pytest.fixture
def connection_params():
    """Create valid connection parameters for testing."""
    return SSHConnectionParams(
        connection_id=MOCK_CONNECTION_ID,
        host=MOCK_HOST,
        username=MOCK_USERNAME,
        password=MOCK_PASSWORD,
    )


@pytest.fixture
def connection_pool():
    """Create a connection pool for testing."""
    return SSHConnectionPool(max_connections=3)


def test_pool_initialization(connection_pool):
    """Test connection pool initialization."""
    assert connection_pool.max_connections == 3
    assert connection_pool.connections == {}
    assert connection_pool.connection_params == {}


def test_pool_has_connection_false(connection_pool):
    """Test has_connection returns False when connection doesn't exist."""
    assert connection_pool.has_connection("nonexistent-id") is False


def test_pool_has_connection_true(connection_pool, connection_params):
    """Test has_connection returns True when connection exists."""
    with mock.patch.object(SSHConnection, "__init__", return_value=None):
        connection = SSHConnection(connection_params)
        connection_pool.connections[MOCK_CONNECTION_ID] = connection

        assert connection_pool.has_connection(MOCK_CONNECTION_ID) is True


def test_pool_get_connection_params(connection_pool, connection_params):
    """Test getting connection parameters."""
    connection_pool.connection_params[MOCK_CONNECTION_ID] = connection_params
    retrieved_params = connection_pool._get_connection_params(MOCK_CONNECTION_ID)

    assert retrieved_params == connection_params
    assert retrieved_params.connection_id == MOCK_CONNECTION_ID
    assert retrieved_params.host == MOCK_HOST


def test_pool_get_connection_params_nonexistent(connection_pool):
    """Test getting nonexistent connection parameters."""
    assert connection_pool._get_connection_params("nonexistent-id") is None


def test_pool_set_connection_params(connection_pool, connection_params):
    """Test setting connection parameters."""
    result = connection_pool._set_connection_params(connection_params)

    assert result == connection_params
    assert connection_pool.connection_params[MOCK_CONNECTION_ID] == connection_params


def test_pool_remove_connection_params(connection_pool, connection_params):
    """Test removing connection parameters."""
    connection_pool.connection_params[MOCK_CONNECTION_ID] = connection_params
    connection_pool._remove_connection_params(MOCK_CONNECTION_ID)

    assert MOCK_CONNECTION_ID not in connection_pool.connection_params


def test_pool_remove_nonexistent_connection_params(connection_pool):
    """Test removing nonexistent connection parameters."""
    connection_pool._remove_connection_params("nonexistent-id")


def test_pool_get_connection_nonexistent(connection_pool):
    """Test get_connection for a nonexistent connection."""
    with pytest.raises(SSHConnectionError) as exc_info:
        connection_pool.get_connection("nonexistent-id")

    assert "Connection ID 'nonexistent-id' not found" in str(exc_info.value)


def test_pool_get_connection_existing(connection_pool, connection_params):
    """Test get_connection for an existing connection."""
    with mock.patch.object(SSHConnection, "__init__", return_value=None):
        connection = SSHConnection(connection_params)
        connection_pool.connections[MOCK_CONNECTION_ID] = connection

        result = connection_pool.get_connection(MOCK_CONNECTION_ID)

        assert result == connection


def test_pool_get_connection_from_params(connection_pool, connection_params):
    """Test get_connection recreates connection from stored params."""
    connection_pool.connection_params[MOCK_CONNECTION_ID] = connection_params

    mock_connection = mock.Mock()
    with mock.patch.object(
        connection_pool, "create_connection", return_value=mock_connection
    ) as mock_create:
        result = connection_pool.get_connection(MOCK_CONNECTION_ID)

        assert result == mock_connection
        mock_create.assert_called_once_with(connection_params)


def test_pool_create_connection(connection_pool, connection_params):
    """Test creating a new connection."""
    with mock.patch(
        "coinbase_agentkit.action_providers.ssh.connection_pool.SSHConnection"
    ) as mock_connection_class:
        mock_connection = mock.Mock()
        mock_connection_class.return_value = mock_connection

        result = connection_pool.create_connection(connection_params)

        assert result == mock_connection
        assert connection_pool.connections[MOCK_CONNECTION_ID] == mock_connection
        assert MOCK_CONNECTION_ID in connection_pool.connection_params
        mock_connection_class.assert_called_once_with(connection_params)


def test_pool_create_connection_limit_reached(connection_pool, connection_params):
    """Test creating a connection when limit is reached."""
    connection_pool.max_connections = 1
    with mock.patch("coinbase_agentkit.action_providers.ssh.connection_pool.SSHConnection"):
        connection_pool.create_connection(connection_params)

        params2 = SSHConnectionParams(
            connection_id=MOCK_CONNECTION_ID2,
            host=MOCK_HOST2,
            username=MOCK_USERNAME2,
            password=MOCK_PASSWORD2,
        )

        with pytest.raises(SSHConnectionError) as exc_info:
            connection_pool.create_connection(params2)

        assert "Connection limit reached" in str(exc_info.value)


def test_pool_create_connection_validation_error(connection_pool):
    """Test creating a connection with invalid parameters."""
    invalid_params = mock.Mock()
    invalid_params.connection_id = "invalid-conn"

    with mock.patch(
        "coinbase_agentkit.action_providers.ssh.connection_pool.SSHConnection",
        side_effect=ValueError("Invalid params"),
    ):
        with pytest.raises(ValueError) as exc_info:
            connection_pool.create_connection(invalid_params)

        assert "Invalid connection parameters" in str(exc_info.value)
        assert "invalid-conn" in str(exc_info.value)

        assert "invalid-conn" not in connection_pool.connection_params


def test_pool_close_idle_connections(connection_pool, connection_params):
    """Test closing idle connections."""
    mock_active = mock.Mock()
    mock_active.is_connected.return_value = True

    mock_idle = mock.Mock()
    mock_idle.is_connected.return_value = False

    connection_pool.connections = {
        "active-conn": mock_active,
        "idle-conn": mock_idle,
    }

    with mock.patch.object(connection_pool, "close_connection") as mock_close:
        closed_count = connection_pool.close_idle_connections()

    assert closed_count == 1
    mock_close.assert_called_once_with("idle-conn")


def test_pool_close_connection_existing(connection_pool):
    """Test closing an existing connection."""
    mock_connection = mock.Mock()
    connection_pool.connections = {"test-conn": mock_connection}

    result = connection_pool.close_connection("test-conn")

    assert result == mock_connection
    assert "test-conn" not in connection_pool.connections
    mock_connection.disconnect.assert_called_once()


def test_pool_close_connection_nonexistent(connection_pool):
    """Test closing a nonexistent connection."""
    result = connection_pool.close_connection("nonexistent-id")

    assert result is None


def test_pool_close_and_remove_connection(connection_pool, connection_params):
    """Test closing and removing a connection completely."""
    mock_connection = mock.Mock()
    connection_pool.connections[MOCK_CONNECTION_ID] = mock_connection

    connection_pool.connection_params[MOCK_CONNECTION_ID] = connection_params

    with mock.patch.object(
        connection_pool, "close_connection", return_value=mock_connection
    ) as mock_close:
        connection_pool.close_and_remove_connection(MOCK_CONNECTION_ID)

    mock_close.assert_called_once_with(MOCK_CONNECTION_ID)
    assert MOCK_CONNECTION_ID not in connection_pool.connection_params


def test_pool_close_all_connections(connection_pool):
    """Test closing all connections."""
    mock_conn1 = mock.Mock()
    mock_conn2 = mock.Mock()

    connection_pool.connections = {
        "conn1": mock_conn1,
        "conn2": mock_conn2,
    }

    with mock.patch.object(connection_pool, "close_connection") as mock_close:
        connection_pool.close_all_connections()

    assert mock_close.call_count == 2
    mock_close.assert_any_call("conn1")
    mock_close.assert_any_call("conn2")


def test_pool_clear_connection_pool(connection_pool, connection_params):
    """Test clearing the connection pool."""
    mock_connection = mock.Mock()
    connection_pool.connections = {"test-conn": mock_connection}

    connection_pool.connection_params[MOCK_CONNECTION_ID] = connection_params

    with mock.patch.object(connection_pool, "close_all_connections") as mock_close_all:
        connection_pool.clear_connection_pool()

    mock_close_all.assert_called_once()
    assert connection_pool.connection_params == {}


def test_pool_get_connections(connection_pool):
    """Test getting all connections."""
    mock_conn1 = mock.Mock()
    mock_conn2 = mock.Mock()

    connections = {
        "conn1": mock_conn1,
        "conn2": mock_conn2,
    }
    connection_pool.connections = connections

    result = connection_pool.get_connections()

    assert result == connections


def test_pool_context_manager(connection_pool):
    """Test using SSHConnectionPool as a context manager."""
    with (
        mock.patch.object(connection_pool, "clear_connection_pool") as mock_clear,
        connection_pool as pool,
    ):
        assert pool == connection_pool
    mock_clear.assert_called_once()
