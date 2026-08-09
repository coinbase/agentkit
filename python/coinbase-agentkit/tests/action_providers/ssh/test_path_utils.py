"""Tests for SSH local path confinement."""

import os
from pathlib import Path

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

    with pytest.raises(ValueError, match="working directory"):
        resolve_safe_local_path("../outside.txt")

    with pytest.raises(ValueError, match="working directory"):
        resolve_safe_local_path("/etc/passwd")
