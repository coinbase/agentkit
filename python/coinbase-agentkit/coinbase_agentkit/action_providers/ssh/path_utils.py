"""Local path confinement for SSH file actions."""

from __future__ import annotations

import os


def resolve_safe_local_path(path: str, *, allowed_roots: list[str] | None = None) -> str:
    """Resolve ``path`` and require it to stay under an allowed root.

    Default root is ``os.getcwd()``. Callers may add extra roots (e.g. ``~/.ssh``
    for known_hosts). Twin of the TypeScript twitter/flaunch/zora cwd confine.
    """
    if not path or not str(path).strip():
        raise ValueError("Local path must be within an allowed directory")

    cwd = os.path.realpath(os.getcwd())
    roots = [cwd]
    if allowed_roots:
        for root in allowed_roots:
            roots.append(os.path.realpath(os.path.expanduser(root)))

    expanded = os.path.expanduser(path)
    # Match path.resolve(cwd, relativeOrAbsolute): absolute inputs ignore cwd.
    resolved = os.path.normpath(
        os.path.join(cwd, expanded) if not os.path.isabs(expanded) else expanded
    )

    if not any(resolved == root or resolved.startswith(root + os.sep) for root in roots):
        raise ValueError("Local path must be within an allowed directory")

    # realpath closes symlink escapes for existing path prefixes.
    real = os.path.realpath(resolved)
    if not any(real == root or real.startswith(root + os.sep) for root in roots):
        raise ValueError("Local path escapes the allowed directories")
    return real
