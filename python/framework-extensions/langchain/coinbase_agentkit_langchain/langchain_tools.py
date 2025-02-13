"""LangChain integration tools for AgentKit."""

from langchain.tools import StructuredTool

from coinbase_agentkit import Action, AgentKit


def get_langchain_tools(agent_kit: AgentKit) -> list[StructuredTool]:
    """Get Langchain tools from an AgentKit instance.

    Args:
        agent_kit: The AgentKit instance

    Returns:
        A list of Langchain tools

    """
    actions: list[Action] = agent_kit.get_actions()

    tools = []
    for action in actions:

        def create_tool_fn(action=action):
            def tool_fn(**kwargs) -> str:
                return action.invoke(kwargs)

            return tool_fn

        tool = StructuredTool(
            name=action.name,
            description=action.description,
            func=create_tool_fn(action),
            args_schema=action.args_schema,
        )
        tools.append(tool)

    return tools
