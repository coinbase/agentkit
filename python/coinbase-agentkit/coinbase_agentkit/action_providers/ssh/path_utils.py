"""Local path confinement for SSH file actions."""

from __future__ import annotations

import os


def resolve_safe_local_path(path: str) -> str:
    """Resolve ``path`` and require it to stay under ``os.getcwd()``.

    Twin of the TypeScript twitter/flaunch/zora cwd confine: agent-supplied
    local paths must not read or write arbitrary process-readable files.
    """
    if not path or not str(path).strip():
        raise ValueError("Local path must be within the working directory")

    root = os.path.realpath(os.getcwd())
    expanded = os.path.expanduser(path)
    # Match path.resolve(root, relativeOrAbsolute): absolute inputs ignore root.
    resolved = os.path.normpath(os.path.join(root, expanded) if not os.path.isabs(expanded) else expanded)
    if resolved != root and not resolved.startswith(root + os.sep):
        raise ValueError("Local path must be within the working directory")

    # realpath closes symlink escapes for existing path prefixes.
    real = os.path.realpath(resolved)
    if real != root and not real.startswith(root + os.sep):
        raise ValueError("Local path escapes the working directory")
    return real
