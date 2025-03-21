"""Tests for SSH key handling.

This module tests the key handling functionality of the SSHConnection class,
including loading keys from files and strings.
"""

from unittest import mock

import paramiko
import pytest

from coinbase_agentkit.action_providers.ssh.connection import (
    SSHConnection,
    SSHConnectionParams,
    SSHKeyError,
)


@pytest.fixture
def ssh_connection():
    """Create an SSH connection instance for testing."""
    params = SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        password="testpass",
    )
    return SSHConnection(params)


def test_load_key_from_string_success(ssh_connection):
    """Test loading an RSA key from a string successfully."""
    with mock.patch("paramiko.RSAKey") as mock_rsa_key:
        mock_key = mock.Mock()
        mock_rsa_key.from_private_key.return_value = mock_key

        key = ssh_connection._load_key_from_string("KEY_CONTENT")

        assert key == mock_key
        mock_rsa_key.from_private_key.assert_called_once()


def test_load_key_from_string_password_required(ssh_connection):
    """Test loading an RSA key that requires a password without providing one."""
    with mock.patch("paramiko.RSAKey") as mock_rsa_key:
        mock_rsa_key.from_private_key.side_effect = (
            paramiko.ssh_exception.PasswordRequiredException()
        )

        with pytest.raises(SSHKeyError) as exc_info:
            ssh_connection._load_key_from_string("KEY_CONTENT")

        assert "Password-protected key provided but no password was given" in str(exc_info.value)


def test_load_key_from_string_other_error(ssh_connection):
    """Test handling other errors when loading an RSA key from a string."""
    with mock.patch("paramiko.RSAKey") as mock_rsa_key:
        mock_rsa_key.from_private_key.side_effect = Exception("Invalid key format")

        with pytest.raises(SSHKeyError) as exc_info:
            ssh_connection._load_key_from_string("KEY_CONTENT")

        assert "Failed to load key from string" in str(exc_info.value)


def test_load_key_from_file_success(ssh_connection):
    """Test loading an RSA key from a file successfully."""
    with (
        mock.patch("paramiko.RSAKey") as mock_rsa_key,
        mock.patch("os.path.exists", return_value=True),
    ):
        mock_key = mock.Mock()
        mock_rsa_key.from_private_key_file.return_value = mock_key

        key = ssh_connection._load_key_from_file("/path/to/key")

        assert key == mock_key
        mock_rsa_key.from_private_key_file.assert_called_once_with("/path/to/key", password=None)


def test_load_key_from_file_password_required(ssh_connection, mock_fs):
    """Test loading an RSA key file that requires a password without providing one."""
    with (
        mock.patch("paramiko.RSAKey") as mock_rsa,
        mock.patch("paramiko.DSSKey") as mock_dss,
        mock.patch("paramiko.ECDSAKey") as mock_ecdsa,
        mock.patch("paramiko.Ed25519Key") as mock_ed25519,
    ):
        mock_rsa.from_private_key_file.side_effect = (
            paramiko.ssh_exception.PasswordRequiredException()
        )

        mock_dss.from_private_key_file.side_effect = paramiko.ssh_exception.SSHException("Not DSS")
        mock_ecdsa.from_private_key_file.side_effect = paramiko.ssh_exception.SSHException(
            "Not ECDSA"
        )
        mock_ed25519.from_private_key_file.side_effect = paramiko.ssh_exception.SSHException(
            "Not Ed25519"
        )

        with pytest.raises(SSHKeyError) as exc_info:
            ssh_connection._load_key_from_file("/path/to/key")

        assert "Password-protected key file requires a password" in str(exc_info.value)


def test_load_key_from_file_other_error(ssh_connection):
    """Test handling other errors when loading an RSA key from a file."""
    with mock.patch("paramiko.RSAKey") as mock_rsa_key:
        mock_rsa_key.from_private_key_file.side_effect = Exception("Invalid key format")

        with pytest.raises(SSHKeyError) as exc_info:
            ssh_connection._load_key_from_file("/path/to/key")

        assert "Failed to load key file" in str(exc_info.value)


def test_load_key_from_string_with_password(ssh_connection):
    """Test loading a password-protected key from string with password."""
    with mock.patch("paramiko.RSAKey") as mock_rsa_key:
        mock_key = mock.Mock()
        mock_rsa_key.from_private_key.return_value = mock_key

        key = ssh_connection._load_key_from_string("KEY_CONTENT", password="keypass")

        assert key == mock_key
        mock_rsa_key.from_private_key.assert_called_with(mock.ANY, password="keypass")


def test_load_key_from_file_with_password(ssh_connection, mock_fs):
    """Test loading a password-protected key file with password."""
    with (
        mock.patch("paramiko.RSAKey") as mock_rsa,
        mock.patch("paramiko.DSSKey") as mock_dss,
        mock.patch("paramiko.ECDSAKey") as mock_ecdsa,
        mock.patch("paramiko.Ed25519Key") as mock_ed25519,
    ):
        mock_key = mock.Mock()
        mock_rsa.from_private_key_file.return_value = mock_key

        mock_dss.from_private_key_file.side_effect = Exception("Should not be called")
        mock_ecdsa.from_private_key_file.side_effect = Exception("Should not be called")
        mock_ed25519.from_private_key_file.side_effect = Exception("Should not be called")

        key = ssh_connection._load_key_from_file("/path/to/key", password="keypass")

        assert key is not None
        mock_rsa.from_private_key_file.assert_called_once()
