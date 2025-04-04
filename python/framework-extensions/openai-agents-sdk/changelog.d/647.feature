Bump openai-agents to v0.0.7
Added support for MCP Servers in OpenAI agents. Users can now integrate MCP servers into their agents with a simple configuration:

```python
agent = Agent(
    name="Assistant",
    instructions="Use the tools to answer any questions.",
    mcp_servers=[mcp_server],
)
``` 