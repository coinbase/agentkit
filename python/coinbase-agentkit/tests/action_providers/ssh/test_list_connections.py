"""Tests for list_connections action.

This module tests the list_connections action of the SshActionProvider, which
provides information about all active SSH connections in the pool.
"""

from unittest import mock


def test_list_connections_with_connections(ssh_provider):
    """Test listing connections when connections exist."""
    mock_pool = ssh_provider.connection_pool

    mock_conn1 = mock.Mock()
    mock_conn1.params.host = "host1"
    mock_conn1.params.port = 22
    mock_conn1.params.username = "user1"
    mock_conn1.is_connected.return_value = True

    mock_conn2 = mock.Mock()
    mock_conn2.params.host = "host2"
    mock_conn2.params.port = 22
    mock_conn2.params.username = "user2"
    mock_conn2.is_connected.return_value = True

    connections = {
        "conn1": mock_conn1,
        "conn2": mock_conn2,
    }

    mock_pool.get_connections.return_value = connections

    result = ssh_provider.list_connections({})

    assert "Active SSH Connections: 2" in result
    assert "Connection ID: conn1" in result
    assert "Connection ID: conn2" in result
    assert "host1:22" in result
    assert "host2:22" in result
    assert "user1" in result
    assert "user2" in result


def test_list_connections_no_connections(ssh_provider):
    """Test listing connections when no connections exist."""
    mock_pool = ssh_provider.connection_pool
    mock_pool.get_connections.return_value = {}

    result = ssh_provider.list_connections({})

    assert "No active SSH connections" in result
