"""Tests for ssh_download action.

This module tests the ssh_download action of the SshActionProvider, which allows
downloading files from a remote server using SFTP.
"""

from unittest import mock

from coinbase_agentkit.action_providers.ssh.connection import SSHConnectionError


def test_ssh_download_success(ssh_provider, tmp_path, monkeypatch):
    """Test successful file download."""
    monkeypatch.chdir(tmp_path)
    local_path = str((tmp_path / "out.txt").resolve())

    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "out.txt",
        }
    )

    assert "File download successful" in result
    assert "/remote/path" in result
    assert local_path in result
    mock_connection.download_file.assert_called_once_with("/remote/path", local_path)


def test_ssh_download_rejects_path_outside_cwd(ssh_provider, tmp_path, monkeypatch):
    """Test file download rejects paths outside the allowed directory."""
    monkeypatch.chdir(tmp_path)
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "/etc/agentkit-ssh-download",
        }
    )

    assert "allowed directory" in result
    mock_connection.download_file.assert_not_called()


def test_ssh_download_connection_not_found(ssh_provider, tmp_path, monkeypatch):
    """Test file download with connection not found."""
    monkeypatch.chdir(tmp_path)
    mock_pool = ssh_provider.connection_pool
    mock_pool.has_connection.return_value = False

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "out.txt",
        }
    )

    assert "Error: Connection ID 'test-conn' not found" in result
    mock_pool.has_connection.assert_called_once_with("test-conn")


def test_ssh_download_not_connected(ssh_provider, tmp_path, monkeypatch):
    """Test file download with inactive connection."""
    monkeypatch.chdir(tmp_path)
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = False

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "out.txt",
        }
    )

    assert "Error: Connection 'test-conn' is not currently active" in result
    mock_pool.get_connection.assert_called_once_with("test-conn")
    mock_connection.is_connected.assert_called_once()


def test_ssh_download_error(ssh_provider, tmp_path, monkeypatch):
    """Test file download with error."""
    monkeypatch.chdir(tmp_path)
    local_path = str((tmp_path / "out.txt").resolve())

    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True
    mock_connection.download_file.side_effect = SSHConnectionError("Download failed")

    result = ssh_provider.ssh_download(
        {
            "connection_id": "test-conn",
            "remote_path": "/remote/path",
            "local_path": "out.txt",
        }
    )

    assert "Error: SSH connection" in result
    mock_connection.download_file.assert_called_once_with("/remote/path", local_path)
