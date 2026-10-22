# Coinbase AgentKit Model Context Protocol (MCP) Extension

The Model Context Protocol (MCP) extension for Coinbase AgentKit enables agentic workflows to expose and execute onchain actions within MCP-compatible clients (such as Claude Desktop, Cursor, or custom MCP client runtimes).

This package provides a security-hardened adapter, a low-level server factory, and a local standard-I/O (stdio) transport runner.

## Security Boundary & Action Allowlisting

AgentKit action providers may contain both read-only query actions and state-changing or transactional actions. To enforce the principle of least privilege:

- **Mandatory Allowlist**: Exposing all actions by default is strictly forbidden. The `allowed_actions` argument is mandatory and keyword-only with no default across `get_mcp_tools()` and `create_mcp_server()`.
- **Strict Isolation**: Only actions explicitly listed in `allowed_actions` are advertised via `tools/list` or callable via `tools/call`.
- **Rejection of Excluded Actions**: Attempting to call an excluded or unapproved action is rejected before dispatch; the underlying `Action.invoke()` method is never executed.
- **Sanitized Client Errors**: Argument validation errors and unexpected action execution exceptions produce generic client-facing messages. Raw tracebacks, internal filesystem paths, rejected input values, and sensitive credentials are never leaked to clients.
- **Scope**: The allowlist controls tool exposure and dispatch. It does not alter the underlying financial or operational semantics of the configured actions themselves.

## Requirements & Compatibility

- **Python**: `~=3.10` (declared requirement Python >=3.10, <4.0; locally tested on Python 3.14.6; Python 3.10–3.13 to be verified via CI matrix)
- **Dependencies**:
  - `coinbase-agentkit>=0.7.2,<0.8`
  - `mcp>=1.10.0,<2`
  - `pydantic>=2.0,<3`
  - `anyio>=4.0.0,<5`

## Installation

```bash
pip install coinbase-agentkit coinbase-agentkit-model-context-protocol
```

## Core APIs

The package exports three primary primitives:

1. **`get_mcp_tools(agent_kit, *, allowed_actions)`**:
   Inspects an AgentKit instance, converts approved action schemas into standard MCP `Tool` definitions, and returns a named tuple `AgentKitMcpTools(tools, tool_handler)` for custom MCP server integrations.
2. **`create_mcp_server(agent_kit, *, allowed_actions, name="coinbase-agentkit", version="0.1.0")`**:
   Initializes and configures a low-level `mcp.server.lowlevel.Server` instance with standard `list_tools` and `call_tool` handlers delegating directly to the Stage 1 adapter.
3. **`run_stdio_server(server, *, raise_exceptions=False)`**:
   Asynchronously executes a configured `Server` over standard input/output (`stdin`/`stdout`). It is strictly local: no network sockets, HTTP listeners, or remote SSE endpoints are opened.

## Usage Example

### 1. Python Server Script (`mcp_server.py`)

Create a local server script that initializes AgentKit, explicitly selects permitted actions, and starts the stdio runner:

```python
import asyncio
import os
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    erc20_action_provider,
    wallet_action_provider,
)
from coinbase_agentkit_model_context_protocol import (
    create_mcp_server,
    run_stdio_server,
)


async def main() -> None:
    # Configure wallet provider using environment variables (never hardcode credentials)
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
            api_key_id=os.environ.get("CDP_API_KEY_ID"),
            api_key_secret=os.environ.get("CDP_API_KEY_SECRET"),
            wallet_secret=os.environ.get("CDP_WALLET_SECRET"),
        )
    )

    # Initialize AgentKit with desired providers
    agent_kit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                wallet_action_provider(),
                erc20_action_provider(),
            ],
        )
    )

    # Deliberately select ONLY the actions to expose to MCP clients
    # Excluded actions will NOT be visible or executable by the client
    allowed_actions = [
        "WalletActionProvider_get_wallet_details",
        "WalletActionProvider_get_balance",
        "ERC20ActionProvider_get_balance",
    ]

    # Create the MCP Server instance
    server = create_mcp_server(
        agent_kit,
        allowed_actions=allowed_actions,
        name="my-agentkit-mcp-server",
        version="0.1.0",
    )

    # Run the server over stdio
    await run_stdio_server(server)


if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Client Configuration (e.g., Claude Desktop)

To use your local AgentKit MCP server with Claude Desktop, add it to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentkit": {
      "command": "python",
      "args": ["/absolute/path/to/mcp_server.py"],
      "env": {
        "CDP_API_KEY_ID": "your-key-id",
        "CDP_API_KEY_SECRET": "your-key-secret",
        "CDP_WALLET_SECRET": "your-wallet-secret",
        "NETWORK_ID": "base-sepolia"
      }
    }
  }
}
```

## Error Handling & Sanitization

- **Unknown / Excluded Actions**: Calling an unlisted tool name returns a tool error result (`isError=True`) with `"Tool '<name>' not found."`. Excluded actions are never executed.
- **Validation Errors**: If the client provides arguments that fail the tool's Pydantic schema, the response returns `isError=True` with:
  `"Invalid arguments for tool '<name>'. Check the tool's input schema and required fields."`
  Raw input payloads and custom validator text are suppressed to prevent secret leakage.
- **Action Execution Errors**: If an action raises an exception during execution, the server returns `isError=True` with:
  `"Error executing tool '<name>': <ExceptionType> occurred during action execution."`
  Tracebacks, internal URLs, filesystem paths, and authentication tokens are never exposed to the client.

## Development & Testing

Run tests and static analysis within the package directory:

```bash
# Run test suite
pytest tests -v

# Run linter
ruff check .

# Run formatter check
ruff format --check .

# Run strict type checking
mypy --strict coinbase_agentkit_model_context_protocol tests
```

## Limitations

- **Strictly Local Transport**: The package implements standard I/O (`stdio_server`) transport. Remote transports (HTTP, SSE, WebSocket) are intentionally excluded to keep the security perimeter strictly local to the running machine.
- **Static Action Table**: Allowed actions are resolved and validated during server construction; dynamically adding actions at runtime without restarting the server is unsupported.
- **Action Semantics**: The allowlist controls exposure; developers are responsible for ensuring that any state-changing actions included in the allowlist are appropriate for their LLM agent's operational context.
