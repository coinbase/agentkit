"""Tests for ssh_add_host_key action.

This module tests the ssh_add_host_key action of the SshActionProvider,
which adds host keys to the SSH known_hosts file.
"""

import os
import tempfile
from unittest import mock

import pytest


@pytest.fixture
def temp_known_hosts():
    """Create a temporary known_hosts file for testing."""
    with tempfile.NamedTemporaryFile(mode="w+", delete=False) as temp_file:
        temp_file.write("existing.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==\n")
        temp_file.write("other.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHRVs==\n")
        temp_file_path = temp_file.name

    yield temp_file_path

    if os.path.exists(temp_file_path):
        os.unlink(temp_file_path)


def test_add_host_key_basic(ssh_provider, temp_known_hosts):
    """Test adding a new host key."""
    result = ssh_provider.ssh_add_host_key(
        {
            "host": "test.example.com",
            "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            "known_hosts_file": temp_known_hosts,
        }
    )

    assert "successfully added" in result
    assert "Host key for 'test.example.com'" in result

    with open(temp_known_hosts) as f:
        content = f.read()

    assert "test.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in content


def test_add_host_key_update_existing(ssh_provider, temp_known_hosts):
    """Test updating an existing host key."""
    result = ssh_provider.ssh_add_host_key(
        {
            "host": "existing.example.com",
            "key": "NEWKEY_AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            "known_hosts_file": temp_known_hosts,
        }
    )

    assert "updated in" in result
    assert "Host key for 'existing.example.com'" in result

    with open(temp_known_hosts) as f:
        content = f.read()

    assert "existing.example.com ssh-rsa NEWKEY_AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in content


def test_add_host_key_with_custom_port(ssh_provider, temp_known_hosts):
    """Test adding a host key with a non-standard port."""
    result = ssh_provider.ssh_add_host_key(
        {
            "host": "[port.example.com]:2222",
            "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            "known_hosts_file": temp_known_hosts,
        }
    )

    assert "successfully added" in result
    assert "Host key for '[port.example.com]:2222'" in result

    with open(temp_known_hosts) as f:
        content = f.read()

    assert "[port.example.com]:2222 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in content


def test_add_host_key_with_custom_key_type(ssh_provider, temp_known_hosts):
    """Test adding a host key with a custom key type."""
    result = ssh_provider.ssh_add_host_key(
        {
            "host": "keytype.example.com",
            "key": "AAAAC3NzaC1lZDI1NTE5AAAAIHRVs==",
            "key_type": "ssh-ed25519",
            "known_hosts_file": temp_known_hosts,
        }
    )

    assert "successfully added" in result
    assert "Host key for 'keytype.example.com'" in result

    with open(temp_known_hosts) as f:
        content = f.read()

    assert "keytype.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHRVs==" in content


def test_add_host_key_create_file(ssh_provider):
    """Test adding a host key when the known_hosts file doesn't exist."""
    with tempfile.TemporaryDirectory() as temp_dir:
        new_file_path = os.path.join(temp_dir, "new_known_hosts")

        result = ssh_provider.ssh_add_host_key(
            {
                "host": "new.example.com",
                "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
                "known_hosts_file": new_file_path,
            }
        )

        assert "successfully added" in result
        assert "Host key for 'new.example.com'" in result

        assert os.path.exists(new_file_path)
        with open(new_file_path) as f:
            content = f.read()

        assert "new.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in content


def test_add_host_key_invalid_params(ssh_provider):
    """Test adding a host key with invalid parameters."""
    result = ssh_provider.ssh_add_host_key(
        {
            "key_type": "ssh-rsa",
        }
    )

    assert "Invalid input parameters" in result


def test_add_host_key_file_error(ssh_provider):
    """Test handling file access errors."""
    with (
        mock.patch("os.path.exists") as mock_exists,
        mock.patch("os.makedirs"),
        mock.patch("builtins.open") as mock_open,
    ):
        mock_exists.return_value = True

        mock_open.side_effect = OSError("Permission denied")

        result = ssh_provider.ssh_add_host_key(
            {
                "host": "error.example.com",
                "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            }
        )

    assert "Error" in result
    assert "Error: File operation:" in result
