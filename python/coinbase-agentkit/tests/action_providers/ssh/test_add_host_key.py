"""Tests for ssh_add_host_key action.

This module tests the ssh_add_host_key action of the SshActionProvider,
which adds host keys to the SSH known_hosts file.
"""

import os
from unittest import mock

import pytest


@pytest.fixture
def temp_known_hosts(tmp_path, monkeypatch):
    """Create a temporary known_hosts file under cwd for testing."""
    monkeypatch.chdir(tmp_path)
    hosts = tmp_path / "known_hosts"
    hosts.write_text(
        "existing.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==\n"
        "other.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHRVs==\n",
        encoding="utf-8",
    )
    return str(hosts.resolve())


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


def test_add_host_key_create_file(ssh_provider, tmp_path, monkeypatch):
    """Test adding a host key when the known_hosts file doesn't exist."""
    monkeypatch.chdir(tmp_path)
    new_file_path = str((tmp_path / "new_known_hosts").resolve())

    result = ssh_provider.ssh_add_host_key(
        {
            "host": "new.example.com",
            "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            "known_hosts_file": "new_known_hosts",
        }
    )

    assert "successfully added" in result
    assert "Host key for 'new.example.com'" in result

    assert os.path.exists(new_file_path)
    with open(new_file_path) as f:
        content = f.read()

    assert "new.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in content


def test_add_host_key_rejects_path_outside_allowed_roots(ssh_provider, tmp_path, monkeypatch):
    """Test known_hosts_file outside cwd and ~/.ssh is rejected."""
    monkeypatch.chdir(tmp_path)

    result = ssh_provider.ssh_add_host_key(
        {
            "host": "evil.example.com",
            "key": "AAAAB3NzaC1yc2EAAAADAQABAAABAQ==",
            "known_hosts_file": "/etc/agentkit-known-hosts",
        }
    )

    assert "allowed directory" in result


def test_add_host_key_invalid_params(ssh_provider):
    """Test adding a host key with invalid parameters."""
    result = ssh_provider.ssh_add_host_key(
        {
            "key_type": "ssh-rsa",
        }
    )

    assert "Invalid input parameters" in result


def test_add_host_key_file_error(ssh_provider, tmp_path, monkeypatch):
    """Test handling file access errors."""
    monkeypatch.chdir(tmp_path)
    hosts = tmp_path / "known_hosts"
    hosts.write_text("", encoding="utf-8")

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
                "known_hosts_file": str(hosts),
            }
        )

    assert "Error" in result
    assert "Error: File operation:" in result
