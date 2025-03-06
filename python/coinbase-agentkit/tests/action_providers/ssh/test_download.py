"""Tests for ssh_download action.

This module tests the ssh_download action of the SshActionProvider, which allows
downloading files from a remote server using SFTP.
"""

from unittest import mock

from coinbase_agentkit.action_providers.ssh.connection import SSHConnectionError


def test_ssh_download_success(ssh_provider):
    """Test successful file download."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    with (
        mock.patch("os.path.dirname", return_value="/local/directory"),
        mock.patch("os.makedirs"),
        mock.patch("os.path.expanduser", return_value="/local/path"),
    ):
        mock_pool.has_connection.return_value = True
        mock_pool.get_connection.return_value = mock_connection
        mock_connection.is_connected.return_value = True

        result = ssh_provider.ssh_download(
            {
                "connection_id": "test-conn",
                "remote_path": "/remote/path",
                "local_path": "/local/path",
            }
        )

        assert "File download successful" in result
        assert "/remote/path" in result
        assert "/local/path" in result
        mock_connection.download_file.assert_called_once_with("/remote/path", "/local/path")


def test_ssh_download_connection_not_found(ssh_provider):
    """Test file download with connection not found."""
    mock_pool = ssh_provider.connection_pool

    mock_pool.has_connection.return_value = False

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "/local/path",
        }
    )

    assert "Error: Connection ID 'test-conn' not found" in result
    mock_pool.has_connection.assert_called_once_with("test-conn")


def test_ssh_download_not_connected(ssh_provider):
    """Test file download with inactive connection."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = False

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "/local/path",
        }
    )

    assert "Error: Connection 'test-conn' is not currently active" in result
    mock_pool.get_connection.assert_called_once_with("test-conn")
    mock_connection.is_connected.assert_called_once()


def test_ssh_download_error(ssh_provider):
    """Test file download with error."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    with (
        mock.patch("os.path.dirname", return_value="/local/directory"),
        mock.patch("os.makedirs"),
        mock.patch("os.path.expanduser", return_value="/local/path"),
    ):
        mock_pool.has_connection.return_value = True
        mock_pool.get_connection.return_value = mock_connection
        mock_connection.is_connected.return_value = True
        mock_connection.download_file.side_effect = SSHConnectionError("Download failed")

        result = ssh_provider.ssh_download(
            {
                "connection_id": "test-conn",
                "remote_path": "/remote/path",
                "local_path": "/local/path",
            }
        )

        assert "Error: SSH connection:" in result
        assert "Download failed" in result
        mock_connection.download_file.assert_called_once_with("/remote/path", "/local/path")
