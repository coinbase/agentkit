"""SSH connection package.

This package provides SSH connection functionality for the agent toolkit.
"""

from .connection import SSHConnection, SSHConnectionError, SSHConnectionParams, SSHKeyError
from .connection_pool import SSHConnectionPool

__all__ = [
    "SSHConnection",
    "SSHConnectionPool",
    "SSHConnectionParams",
    "SSHConnectionError",
    "SSHKeyError",
]
