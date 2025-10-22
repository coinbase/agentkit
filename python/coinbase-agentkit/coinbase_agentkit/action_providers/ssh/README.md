# SSH Action Provider

This directory contains the **SshActionProvider** implementation, which provides actions for interacting with remote servers via SSH.

## Directory Structure

```
ssh/
├── ssh_action_provider.py    # SSH action provider implementation
├── connection.py             # SSH connection management
├── connection_pool.py        # Pool for managing multiple connections
├── schemas.py                # SSH action schemas
├── __init__.py               # Main exports
└── README.md                 # This file

# From python/coinbase-agentkit/
tests/action_providers/ssh/
├── conftest.py               # Test configuration
├── test_action_provider.py   # Test action provider functionality
├── test_add_host_key.py      # Test adding host keys
├── test_connection.py        # Test SSH connection handling
├── test_connection_pool.py   # Test connection pool management
├── test_disconnect.py        # Test disconnection
├── test_download.py          # Test file downloads via SFTP
├── test_execute.py           # Test remote command execution
├── test_keys.py              # Test SSH key handling
├── test_list_connections.py  # Test listing active connections
├── test_params.py            # Test SSH parameters
├── test_remote_shell.py      # Test remote shell commands
├── test_sftp.py              # Test SFTP operations
├── test_ssh_connect.py       # Test SSH connection
├── test_status.py            # Test connection status checks
└── test_upload.py            # Test file uploads via SFTP
```

## Actions

- `ssh_connect`: Establish an SSH connection to a remote server
  - Supports password and key-based authentication
  - Generates a connection ID for future operations if one is not provided
  - Optional known_hosts_file parameter for custom host verification

- `remote_shell`: Execute shell commands on the remote server
  - Uses an established connection
  - Returns command output
  - Configurable timeout and stderr handling

- `ssh_disconnect`: Close an SSH connection
  - Frees up resources

- `ssh_status`: Check the status of an SSH connection
  - Shows connection details

- `list_connections`: List all active SSH connections
  - Shows connection details for all active connections

- `ssh_upload`: Upload a file to the remote server via SFTP
  - Requires full local and remote paths

- `ssh_download`: Download a file from the remote server via SFTP
  - Requires full local and remote paths

- `ssh_add_host_key`: Add a host key to the known hosts file
  - Useful for host verification
  - Supports various key types (ssh-rsa, ssh-ed25519, etc.)
  - Configurable known_hosts file path

## Adding New Actions

To add new SSH actions:

1. Define your action schema in `schemas.py`
2. Implement the action in `ssh_action_provider.py`
3. Implement tests in a new file in `tests/action_providers/ssh/`

## Notes

- The SSH action provider maintains a pool of connections for efficient management
- Actions like `remote_shell`, `ssh_upload`, and `ssh_download` require an active connection established via `ssh_connect`
- For file transfers (`ssh_upload` and `ssh_download`), full local and remote paths are required

## Prompts

### *please show my hyperbolic gpu instances*

<details>
<summary>Tool Output</summary>

```
Your Rented GPU Instances:
Instance ID: positive-peach-goat
Status: running (Ready to use)
GPU Model: NVIDIA-GeForce-RTX-4090
GPU Count: 1
GPU Memory: 24.0 GB
SSH Command: ssh ubuntu@positive-peach-goat.1.cricket.hyperbolic.xyz -p 31274

SSH Connection Instructions:
1. Wait until instance status is 'running'
2. Use the ssh_connect action with the provided host and username
3. Once connected, use remote_shell to execute commands
```
</details>

<details>
<summary>Agent Output</summary>

```
You have a running GPU instance with the following details:

- **Instance ID**: positive-peach-goat
- **Status**: running (Ready to use)
- **GPU Model**: NVIDIA-GeForce-RTX-4090
- **GPU Count**: 1
- **GPU Memory**: 24.0 GB
- **SSH Command**: `ssh ubuntu@positive-peach-goat.1.cricket.hyperbolic.xyz -p 31274`

If you would like me to SSH into this instance, please provide the password for the `ubuntu` user, or the private key if you are using key-based authentication.
```
</details>

### *please open an ssh connection to my hyperbolic gpu instance using /Users/chris/.ssh/hyperbolic*

<details>
<summary>Tool Output</summary>

```
Error: Host verification: Host key verification failed for [positive-peach-goat.1.cricket.hyperbolic.xyz]:31274. Server sent:
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIG6/psa2jo3Wu2XVnImwzQ10eQg+M/9RqrcWwdZY7mU

To add this host key, use the ssh_add_host_key action with the following parameters:
  host: [positive-peach-goat.1.cricket.hyperbolic.xyz]:31274
  key: AAAAC3NzaC1lZDI1NTE5AAAAIIG6/psa2jo3Wu2XVnImwzQ10eQg+M/9RqrcWwdZY7mU
  key_type: ssh-ed25519
```

```
Host key for '[positive-peach-goat.1.cricket.hyperbolic.xyz]:31274' successfully added to /Users/chris/.ssh/known_hosts
```

```
Connection ID: hyperbolic-gpu-instance
Successfully connected to positive-peach-goat.1.cricket.hyperbolic.xyz as ubuntu
```
</details>

<details>
<summary>Agent Output</summary>

```
You are now successfully connected to your Hyperbolic GPU instance with the following details:

- **Connection ID**: hyperbolic-gpu-instance
- **Host**: positive-peach-goat.1.cricket.hyperbolic.xyz
- **Username**: ubuntu

You can now execute commands on the instance. If you need to run specific commands or perform actions, just let me know!
```
</details>

### *please run `ls -lah` on my hyperbolic gpu instance*

<details>
<summary>Tool Output</summary>

```
Output from connection 'hyperbolic-gpu-instance':

total 48K
drwxr-x--- 6 ubuntu ubuntu 4.0K Mar 12 10:54 .
drwxr-xr-x 1 root   root   4.0K Feb 14 20:24 ..
-rw-r--r-- 1 ubuntu ubuntu  220 Jan  6  2022 .bash_logout
-rw-r--r-- 1 ubuntu ubuntu 3.7K Jan  6  2022 .bashrc
drwx------ 2 ubuntu ubuntu 4.0K Mar 12 10:54 .cache
drwxrwxr-x 3 ubuntu ubuntu 4.0K Mar 12 10:54 .config
-rw-r--r-- 1 ubuntu ubuntu  807 Jan  6  2022 .profile
drwxr-xr-x 2 ubuntu ubuntu 4.0K Feb 14 20:24 .ssh
drwx------ 2 ubuntu ubuntu  16K Mar 12 10:51 lost+found
```
</details>

<details>
<summary>Agent Output</summary>

```
The output of the `ls -lah` command on your Hyperbolic GPU instance is as follows:

total 48K
drwxr-x--- 6 ubuntu ubuntu 4.0K Mar 12 10:54 .
drwxr-xr-x 1 root   root   4.0K Feb 14 20:24 ..
-rw-r--r-- 1 ubuntu ubuntu  220 Jan  6  2022 .bash_logout
-rw-r--r-- 1 ubuntu ubuntu 3.7K Jan  6  2022 .bashrc
drwx------ 2 ubuntu ubuntu 4.0K Mar 12 10:54 .cache
drwxrwxr-x 3 ubuntu ubuntu 4.0K Mar 12 10:54 .config
-rw-r--r-- 1 ubuntu ubuntu  807 Jan  6  2022 .profile
drwxr-xr-x 2 ubuntu ubuntu 4.0K Feb 14 20:24 .ssh
drwx------ 2 ubuntu ubuntu  16K Mar 12 10:51 lost+found

If you need to run more commands or require further assistance, just let me know!
```
</details>

### *please show my hyperbolic gpu instance ssh connection status*

<details>
<summary>Tool Output</summary>

```
Connection ID: hyperbolic-gpu-instance
Status: Connected
Host: positive-peach-goat.1.cricket.hyperbolic.xyz:31274
Username: ubuntu
Connected since: 2025-03-12 03:54:10
```
</details>

<details>
<summary>Agent Output</summary>

```
The SSH connection status for your Hyperbolic GPU instance is as follows:

- **Connection ID**: hyperbolic-gpu-instance
- **Status**: Connected
- **Host**: positive-peach-goat.1.cricket.hyperbolic.xyz:31274
- **Username**: ubuntu
- **Connected since**: March 12, 2025, 03:54:10

If you need any further assistance or commands to be executed, feel free to ask!
```
</details>

### *please list open ssh connections*

<details>
<summary>Tool Output</summary>

```
Active SSH Connections: 1
Connection ID: hyperbolic-gpu-instance
Status: Connected
Host: positive-peach-goat.1.cricket.hyperbolic.xyz:31274
Username: ubuntu
```
</details>

<details>
<summary>Agent Output</summary>

```
You currently have the following active SSH connection:

- **Connection ID**: hyperbolic-gpu-instance
- **Status**: Connected
- **Host**: positive-peach-goat.1.cricket.hyperbolic.xyz:31274
- **Username**: ubuntu

If you need any further actions or information, just let me know!
```
</details>

### *please upload from my local /Users/chris/hello.txt to /home/ubuntu/hello.txt*

<details>
<summary>Tool Output</summary>

```
File upload successful:
Local file: /Users/chris/hello.txt
Remote destination: /home/ubuntu/hello.txt
```
</details>

<details>
<summary>Agent Output</summary>

```
The file upload was successful! The file **hello.txt** has been uploaded from your local path **/Users/chris/hello.txt** to the remote path **/home/ubuntu/hello.txt** on your Hyperbolic GPU instance.

If you need further assistance or have more tasks, feel free to ask!
```
</details>

### *please run `cat hello.txt`*

<details>
<summary>Tool Output</summary>

```
Output from connection 'hyperbolic-gpu-instance':

world
```
</details>

<details>
<summary>Agent Output</summary>

```
The output of the `cat hello.txt` command is as follows:

```
world
```

If you have any more commands to run or need further assistance, just let me know!
```
</details>

### *please run `echo 'fizz' > buzz.txt`*

<details>
<summary>Tool Output</summary>

```
Output from connection 'hyperbolic-gpu-instance':

```
</details>

<details>
<summary>Agent Output</summary>

```
The command `echo 'fizz' > buzz.txt` has been executed successfully. 

If you need to check the contents of **buzz.txt** or perform any other actions, just let me know!
```
</details>

### *please download buzz.txt to /Users/chris/buzz.txt*

<details>
<summary>Tool Output</summary>

```
File download successful:
Remote file: buzz.txt
Local destination: /Users/chris/buzz.txt
```
</details>

<details>
<summary>Agent Output</summary>

```
The file **buzz.txt** has been successfully downloaded from your Hyperbolic GPU instance to your local path **/Users/chris/buzz.txt**.

If you need any further assistance or have more tasks, feel free to ask!
```
</details>

### *please close all ssh connections*

<details>
<summary>Tool Output</summary>

```
Connection ID: hyperbolic-gpu-instance
Disconnected from positive-peach-goat.1.cricket.hyperbolic.xyz
```
</details>

<details>
<summary>Agent Output</summary>

```
The SSH connection to your Hyperbolic GPU instance has been successfully closed. 

If you need any further assistance or have more tasks, just let me know!
```
</details>