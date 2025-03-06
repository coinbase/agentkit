"""Tests for ssh_upload action.

This module tests the ssh_upload action of the SshActionProvider, which allows
uploading files to a remote server using SFTP.
"""

from unittest import mock

from coinbase_agentkit.action_providers.ssh.connection import SSHConnectionError


def test_ssh_upload_success(ssh_provider):
    """Test successful file upload."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    with (
        mock.patch("os.path.exists", return_value=True),
        mock.patch("os.path.isfile", return_value=True),
    ):
        mock_pool.has_connection.return_value = True
        mock_pool.get_connection.return_value = mock_connection
        mock_connection.is_connected.return_value = True

        result = ssh_provider.ssh_upload(
            {
                "connection_id": "test-conn",
                "local_path": "/local/path",
                "remote_path": "/remote/path",
            }
        )

        assert "File upload successful" in result
        assert "/local/path" in result
        assert "/remote/path" in result
        mock_connection.upload_file.assert_called_once_with("/local/path", "/remote/path")


def test_ssh_upload_connection_not_found(ssh_provider):
    """Test file upload with connection not found."""
    mock_pool = ssh_provider.connection_pool

    with (
        mock.patch("os.path.exists", return_value=True),
        mock.patch("os.path.isfile", return_value=True),
    ):
        mock_pool.has_connection.return_value = False

        result = ssh_provider.ssh_upload(
            {
                "connection_id": "test-conn",
                "local_path": "/local/path",
                "remote_path": "/remote/path",
            }
        )

        assert "Error: Connection ID 'test-conn' not found" in result
        mock_pool.has_connection.assert_called_once_with("test-conn")


def test_ssh_upload_not_connected(ssh_provider):
    """Test file upload with inactive connection."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    with (
        mock.patch("os.path.exists", return_value=True),
        mock.patch("os.path.isfile", return_value=True),
    ):
        mock_pool.has_connection.return_value = True
        mock_pool.get_connection.return_value = mock_connection
        mock_connection.is_connected.return_value = False

        result = ssh_provider.ssh_upload(
            {
                "connection_id": "test-conn",
                "local_path": "/local/path",
                "remote_path": "/remote/path",
            }
        )

        assert "Error: Connection 'test-conn' is not currently active" in result
        mock_pool.get_connection.assert_called_once_with("test-conn")
        mock_connection.is_connected.assert_called_once()


def test_ssh_upload_error(ssh_provider):
    """Test file upload with error."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()

    with (
        mock.patch("os.path.exists", return_value=True),
        mock.patch("os.path.isfile", return_value=True),
    ):
        mock_pool.has_connection.return_value = True
        mock_pool.get_connection.return_value = mock_connection
        mock_connection.is_connected.return_value = True
        mock_connection.upload_file.side_effect = SSHConnectionError("Upload failed")

        result = ssh_provider.ssh_upload(
            {
                "connection_id": "test-conn",
                "local_path": "/local/path",
                "remote_path": "/remote/path",
            }
        )

        assert "Error: SSH connection:" in result
        assert "Upload failed" in result
        mock_connection.upload_file.assert_called_once_with("/local/path", "/remote/path")
