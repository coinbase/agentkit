"""SSH Connection Pool.

This module implements the SSHConnectionPool class, which manages multiple SSH connections
and provides methods to create, retrieve, and close connections.

@module ssh/pool
"""

from .connection import SSHConnection, SSHConnectionError, SSHConnectionParams


class SSHConnectionPool:
    """Manages multiple SSH connections.

    This class maintains a pool of SSH connections, limits the total number
    of connections, and provides methods to create, retrieve, and close connections.
    """

    def __init__(self, max_connections: int = 5):
        """Initialize connection pool.

        Args:
            max_connections: Maximum number of concurrent connections

        """
        self.connections = {}
        self.max_connections = max_connections
        self.connection_params = {}

    def has_connection(self, connection_id: str) -> bool:
        """Check if a connection exists in the pool.

        Args:
            connection_id: Unique identifier for the connection

        Returns:
            bool: True if the connection exists in the pool

        """
        return connection_id in self.connections

    def get_connection(self, connection_id: str) -> SSHConnection:
        """Get an existing connection from the pool.

        Args:
            connection_id: Unique identifier for the connection

        Returns:
            SSHConnection: The connection object

        Raises:
            SSHConnectionError: If the connection ID is not found or connection limit reached

        """
        if connection_id in self.connections:
            return self.connections[connection_id]

        params = self._get_connection_params(connection_id)
        if not params:
            raise SSHConnectionError(f"Connection ID '{connection_id}' not found")

        if len(self.connections) >= self.max_connections:
            raise SSHConnectionError(f"Connection limit reached ({self.max_connections})")

        return self.create_connection(params)

    def close_idle_connections(self) -> int:
        """Close any idle connections in the pool.

        Returns:
            int: Number of closed connections

        """
        closed_count = 0
        for conn_id, conn in list(self.connections.items()):
            if not conn.is_connected():
                self.close_connection(conn_id)
                closed_count += 1
        return closed_count

    def create_connection(self, params: SSHConnectionParams) -> SSHConnection:
        """Create a new connection and add it to the pool.

        Args:
            params: SSH connection parameters

        Returns:
            SSHConnection: The newly created SSH connection

        Raises:
            SSHConnectionError: If the connection limit is reached
            ValueError: If the connection parameters are invalid

        """
        self.close_idle_connections()

        if len(self.connections) >= self.max_connections:
            raise SSHConnectionError(f"Connection limit reached ({self.max_connections})")

        try:
            stored_params = self._set_connection_params(params)
            connection = SSHConnection(stored_params)

            self.connections[params.connection_id] = connection

            return connection
        except ValueError as e:
            self._remove_connection_params(params.connection_id)
            raise ValueError(
                f"Invalid connection parameters for '{params.connection_id}': {e!s}"
            ) from e

    def close_connection(self, connection_id: str) -> SSHConnection | None:
        """Close and remove a connection from the pool.

        Args:
            connection_id: Unique identifier for the connection

        """
        if connection_id not in self.connections:
            return None

        connection = self.connections[connection_id]
        connection.disconnect()

        del self.connections[connection_id]

        return connection

    def close_and_remove_connection(self, connection_id: str) -> None:
        """Close a connection and remove it completely from the pool including parameters.

        Args:
            connection_id: Unique identifier for the connection

        """
        self.close_connection(connection_id)
        self._remove_connection_params(connection_id)

    def close_all_connections(self) -> None:
        """Close all active connections in the pool."""
        for connection_id in list(self.connections.keys()):
            self.close_connection(connection_id)

    def clear_connection_pool(self) -> None:
        """Close all connections and clear all stored parameters."""
        self.close_all_connections()
        self.connection_params.clear()

    def get_connections(self):
        """Get all connections in the pool.

        Returns:
            dict: Dictionary of all connections

        """
        return self.connections

    def __enter__(self):
        """Enter context manager.

        Returns:
            SSHConnectionPool: The connection pool instance

        """
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager and close all connections.

        Args:
            exc_type: Exception type
            exc_val: Exception value
            exc_tb: Exception traceback

        """
        self.clear_connection_pool()

    def _get_connection_params(self, connection_id: str) -> SSHConnectionParams | None:
        """Get stored connection parameters.

        Args:
            connection_id: Unique identifier for the connection

        Returns:
            SSHConnectionParams: The stored parameters or None if not found

        """
        return self.connection_params.get(connection_id)

    def _set_connection_params(self, params: SSHConnectionParams) -> SSHConnectionParams:
        """Store connection parameters.

        Args:
            params: SSH connection parameters

        Returns:
            SSHConnectionParams: The stored parameters

        Raises:
            ValueError: If the parameters are invalid

        """
        self.connection_params[params.connection_id] = params
        return params

    def _remove_connection_params(self, connection_id: str) -> None:
        """Remove stored connection parameters.

        Args:
            connection_id: Unique identifier for the connection

        """
        if connection_id in self.connection_params:
            del self.connection_params[connection_id]
