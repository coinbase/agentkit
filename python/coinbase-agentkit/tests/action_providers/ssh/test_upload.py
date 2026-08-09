"""Tests for ssh_upload action.

This module tests the ssh_upload action of the SshActionProvider, which allows
uploading files to a remote server using SFTP.
"""

from unittest import mock

from coinbase_agentkit.action_providers.ssh.connection import SSHConnectionError


def test_ssh_upload_success(ssh_provider, tmp_path, monkeypatch):
    """Test successful file upload."""
    monkeypatch.chdir(tmp_path)
    local = tmp_path / "payload.txt"
    local.write_text("x", encoding="utf-8")
    local_path = str(local.resolve())

    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True

    result = ssh_provider.ssh_upload(
        {
            "connection_id": "test-conn",
            "local_path": "payload.txt",
            "remote_path": "/remote/path",
        }
    )

    assert "File upload successful" in result
    assert local_path in result
    assert "/remote/path" in result
    mock_connection.upload_file.assert_called_once_with(local_path, "/remote/path")


def test_ssh_upload_rejects_path_outside_cwd(ssh_provider, tmp_path, monkeypatch):
    """Test file upload rejects paths outside the allowed directory."""
    monkeypatch.chdir(tmp_path)
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True

    result = ssh_provider.ssh_upload(
        {
            "connection_id": "test-conn",
            "local_path": "/etc/passwd",
            "remote_path": "/remote/path",
        }
    )

    assert "allowed directory" in result
    mock_connection.upload_file.assert_not_called()


def test_ssh_upload_connection_not_found(ssh_provider, tmp_path, monkeypatch):
    """Test file upload with connection not found."""
    monkeypatch.chdir(tmp_path)
    (tmp_path / "payload.txt").write_text("x", encoding="utf-8")
    mock_pool = ssh_provider.connection_pool
    mock_pool.has_connection.return_value = False

    result = ssh_provider.ssh_upload(
        {
            "connection_id": "test-conn",
            "local_path": "payload.txt",
            "remote_path": "/remote/path",
        }
    )

    assert "Error: Connection ID 'test-conn' not found" in result
    mock_pool.has_connection.assert_called_once_with("test-conn")


def test_ssh_upload_not_connected(ssh_provider, tmp_path, monkeypatch):
    """Test file upload with inactive connection."""
    monkeypatch.chdir(tmp_path)
    (tmp_path / "payload.txt").write_text("x", encoding="utf-8")
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = False

    result = ssh_provider.ssh_upload(
        {
            "connection_id": "test-conn",
            "local_path": "payload.txt",
            "remote_path": "/remote/path",
        }
    )

    assert "Error: Connection 'test-conn' is not currently active" in result
    mock_pool.get_connection.assert_called_once_with("test-conn")
    mock_connection.is_connected.assert_called_once()


def test_ssh_upload_error(ssh_provider, tmp_path, monkeypatch):
    """Test file upload with error."""
    monkeypatch.chdir(tmp_path)
    local = tmp_path / "payload.txt"
    local.write_text("x", encoding="utf-8")
    local_path = str(local.resolve())

    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_pool.has_connection.return_value = True
    mock_pool.get_connection.return_value = mock_connection
    mock_connection.is_connected.return_value = True
    mock_connection.upload_file.side_effect = SSHConnectionError("Upload failed")

    result = ssh_provider.ssh_upload(
        {
            "connection_id": "test-conn",
            "local_path": "payload.txt",
            "remote_path": "/remote/path",
        }
    )

    assert "Error: SSH connection" in result
    mock_connection.upload_file.assert_called_once_with(local_path, "/remote/path")
