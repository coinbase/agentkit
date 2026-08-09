"""Tests for SSH local path confinement."""

import os

import pytest

from coinbase_agentkit.action_providers.ssh.path_utils import resolve_safe_local_path


def test_resolve_safe_local_path_allows_under_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    inside = tmp_path / "payload.txt"
    inside.write_text("x", encoding="utf-8")

    assert resolve_safe_local_path("payload.txt") == str(inside.resolve())
    assert resolve_safe_local_path(str(inside)) == str(inside.resolve())


def test_resolve_safe_local_path_rejects_escapes(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    with pytest.raises(ValueError, match="allowed directory"):
        resolve_safe_local_path("../outside.txt")

    with pytest.raises(ValueError, match="allowed directory"):
        resolve_safe_local_path("/etc/passwd")


def test_resolve_safe_local_path_allows_extra_root(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ssh_dir = tmp_path / "fake-ssh"
    ssh_dir.mkdir()
    hosts = ssh_dir / "known_hosts"
    hosts.write_text("", encoding="utf-8")

    assert resolve_safe_local_path(
        str(hosts),
        allowed_roots=[str(ssh_dir)],
    ) == str(hosts.resolve())

    with pytest.raises(ValueError, match="allowed directory"):
        resolve_safe_local_path("/etc/passwd", allowed_roots=[str(ssh_dir)])
