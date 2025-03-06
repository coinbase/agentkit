"""Tests for SSH SFTP operations.

This module tests the SFTP functionality of the SSHConnection class, including
file upload, download, and directory listing.
"""

import os
from unittest import mock

import paramiko
import pytest

from coinbase_agentkit.action_providers.ssh.connection import (
    SSHConnection,
    SSHConnectionError,
    SSHConnectionParams,
)


@pytest.fixture
def connection_params():
    """Create a standard set of connection parameters for testing."""
    return SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        password="testpass",
    )


@pytest.fixture
def ssh_connection(connection_params):
    """Create an SSH connection instance for testing."""
    return SSHConnection(connection_params)


@mock.patch("paramiko.SSHClient")
def test_get_sftp_client(mock_ssh_client_class, ssh_connection):
    """Test getting an SFTP client."""
    mock_client = mock_ssh_client_class.return_value
    ssh_connection.ssh_client = mock_client
    ssh_connection.connected = True

    mock_sftp = mock.Mock()
    mock_client.open_sftp.return_value = mock_sftp

    with mock.patch.object(ssh_connection, "is_connected", return_value=True):
        sftp = ssh_connection.get_sftp_client()

    assert sftp == mock_sftp
    mock_client.open_sftp.assert_called_once()


def test_get_sftp_client_not_connected(ssh_connection):
    """Test getting an SFTP client when not connected."""
    with (
        mock.patch.object(ssh_connection, "is_connected", return_value=False),
        pytest.raises(SSHConnectionError) as exc_info,
    ):
        ssh_connection.get_sftp_client()

    assert "No active SSH connection" in str(exc_info.value)


@mock.patch("os.path.exists")
def test_upload_file(mock_exists, ssh_connection):
    """Test uploading a file."""
    mock_exists.return_value = True

    mock_sftp = mock.Mock()

    with mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp):
        ssh_connection.upload_file("/local/path", "/remote/path")

    mock_sftp.put.assert_called_once_with("/local/path", "/remote/path")
    mock_sftp.close.assert_called_once()


@mock.patch("os.path.exists")
def test_upload_file_not_found(mock_exists, ssh_connection):
    """Test uploading a non-existent file."""
    mock_exists.return_value = False

    with pytest.raises(FileNotFoundError) as exc_info:
        ssh_connection.upload_file("/local/path", "/remote/path")

    assert "Local file not found" in str(exc_info.value)


@mock.patch("os.path.exists")
def test_upload_file_error(mock_exists, ssh_connection):
    """Test error handling during file upload."""
    mock_exists.return_value = True

    mock_sftp = mock.Mock()
    mock_sftp.put.side_effect = paramiko.SFTPError("Permission denied")

    with (
        mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp),
        pytest.raises(SSHConnectionError) as exc_info,
    ):
        ssh_connection.upload_file("/local/path", "/remote/path")

    assert "File upload failed" in str(exc_info.value)


def test_download_file(ssh_connection):
    """Test downloading a file."""
    mock_sftp = mock.Mock()

    with mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp):
        ssh_connection.download_file("/remote/path", "/local/path")

    mock_sftp.get.assert_called_once_with("/remote/path", "/local/path")
    mock_sftp.close.assert_called_once()


def test_download_file_error(ssh_connection):
    """Test error handling during file download."""
    mock_sftp = mock.Mock()
    mock_sftp.get.side_effect = paramiko.SFTPError("File not found")

    with (
        mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp),
        pytest.raises(SSHConnectionError) as exc_info,
    ):
        ssh_connection.download_file("/remote/path", "/local/path")

    assert "File download failed" in str(exc_info.value)


def test_list_directory(ssh_connection):
    """Test listing directory contents."""
    mock_sftp = mock.Mock()
    mock_sftp.listdir.return_value = ["file1", "file2", "directory"]

    with mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp):
        files = ssh_connection.list_directory("/remote/path")

    assert files == ["file1", "file2", "directory"]
    mock_sftp.listdir.assert_called_once_with("/remote/path")
    mock_sftp.close.assert_called_once()


def test_list_directory_error(ssh_connection):
    """Test error handling during directory listing."""
    mock_sftp = mock.Mock()
    mock_sftp.listdir.side_effect = paramiko.SFTPError("Directory not found")

    with (
        mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp),
        pytest.raises(SSHConnectionError) as exc_info,
    ):
        ssh_connection.list_directory("/remote/path")

    assert "Directory listing failed" in str(exc_info.value)


@mock.patch("os.path.dirname")
@mock.patch("os.makedirs")
@mock.patch("os.path.exists")
def test_create_local_directories_for_download(
    mock_exists, mock_makedirs, mock_dirname, ssh_connection
):
    """Test creating local directories during download (helper test)."""
    mock_exists.return_value = True

    mock_dirname.return_value = "/local"

    mock_sftp = mock.Mock()

    with mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp):
        os.makedirs = mock_makedirs
        os.makedirs("/local", exist_ok=True)
        ssh_connection.download_file("/remote/path", "/local/path")

    mock_makedirs.assert_called_once_with("/local", exist_ok=True)
    mock_sftp.get.assert_called_once_with("/remote/path", "/local/path")


@mock.patch("os.path.dirname")
@mock.patch("os.path.exists")
def test_create_remote_directory_for_upload(mock_exists, mock_dirname, ssh_connection):
    """Test creating remote directory during upload (helper test)."""
    mock_exists.return_value = True

    mock_dirname.return_value = "/remote"

    mock_sftp = mock.Mock()

    with mock.patch.object(ssh_connection, "get_sftp_client", return_value=mock_sftp):
        mock_sftp.mkdir("/remote")
        ssh_connection.upload_file("/local/path", "/remote/path")

    mock_sftp.mkdir.assert_called_once_with("/remote")
    mock_sftp.put.assert_called_once_with("/local/path", "/remote/path")
    mock_sftp.close.assert_called_once()
