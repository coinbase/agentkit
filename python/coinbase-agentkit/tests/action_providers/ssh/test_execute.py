"""Tests for SSH command execution.

This module tests the execute method of the SSHConnection class, including
error handling and result processing.
"""

from unittest import mock

import paramiko
import pytest

from coinbase_agentkit.action_providers.ssh.connection import (
    SSHConnectionError,
)


def test_execute_command_success(ssh_connection):
    """Test successful command execution."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b"command output"
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b""
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            result = ssh_connection.execute("ls -la")

            assert result == "command output"
            mock_client.exec_command.assert_called_once_with("ls -la", timeout=30)


def test_execute_not_connected(ssh_connection):
    """Test execute when not connected."""
    with pytest.raises(SSHConnectionError) as exc_info:
        ssh_connection.execute("ls -la")
    assert "No active SSH connection" in str(exc_info.value)


def test_execute_command_with_stderr(ssh_connection):
    """Test command execution with stderr output but success status."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b"command output"
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b"warning message"
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            result = ssh_connection.execute("ls -la")

            assert result == "command output\n[stderr]: warning message"
            mock_client.exec_command.assert_called_once_with("ls -la", timeout=30)


def test_execute_command_with_stderr_ignore(ssh_connection):
    """Test command execution with stderr output and ignore_stderr=True."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b"command output"
            mock_stdout.channel.recv_exit_status.return_value = 1
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b"warning message"
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            result = ssh_connection.execute("ls -la", ignore_stderr=True)

            assert result == "command output\n[stderr]: warning message"
            mock_client.exec_command.assert_called_once_with("ls -la", timeout=30)


def test_execute_command_failure_stderr(ssh_connection):
    """Test command execution failure with stderr output."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b""
            mock_stdout.channel.recv_exit_status.return_value = 1
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b"command failed"
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            with pytest.raises(SSHConnectionError) as exc_info:
                ssh_connection.execute("invalid-command")

            assert "Command execution failed" in str(exc_info.value)
            assert "command failed" in str(exc_info.value)
            mock_client.exec_command.assert_called_once_with("invalid-command", timeout=30)


def test_execute_command_failure_no_stderr(ssh_connection):
    """Test command execution failure with no stderr output."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b""
            mock_stdout.channel.recv_exit_status.return_value = 1
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b""
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            with pytest.raises(SSHConnectionError) as exc_info:
                ssh_connection.execute("invalid-command")

            assert "Command execution failed" in str(exc_info.value)
            assert "exit code 1" in str(exc_info.value)


def test_execute_command_empty_output(ssh_connection):
    """Test command execution with empty but successful output."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b""
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b""
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            result = ssh_connection.execute("touch file.txt")

            assert result == ""
            mock_client.exec_command.assert_called_once_with("touch file.txt", timeout=30)


def test_execute_command_exception(ssh_connection):
    """Test handling exceptions during command execution."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_client.exec_command.side_effect = paramiko.SSHException("Connection lost")

            with pytest.raises(SSHConnectionError) as exc_info:
                ssh_connection.execute("ls -la")

            assert "Command execution failed" in str(exc_info.value)
            assert "Connection lost" in str(exc_info.value)


def test_execute_command_custom_timeout(ssh_connection):
    """Test command execution with custom timeout."""
    with mock.patch("paramiko.SSHClient") as mock_ssh_client_class:
        mock_client = mock_ssh_client_class.return_value
        ssh_connection.ssh_client = mock_client
        ssh_connection.connected = True

        with mock.patch.object(ssh_connection, "is_connected", return_value=True):
            mock_stdin = mock.Mock()
            mock_stdout = mock.Mock()
            mock_stdout.read.return_value = b"command output"
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr = mock.Mock()
            mock_stderr.read.return_value = b""
            mock_client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)

            result = ssh_connection.execute("ls -la", timeout=60)

            assert result == "command output"
            mock_client.exec_command.assert_called_once_with("ls -la", timeout=60)
