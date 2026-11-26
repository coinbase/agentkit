"""Tests for LangChain tools and event-loop compatibility."""

import importlib.util
import subprocess
import sys
import textwrap
from types import SimpleNamespace

import pytest
from pydantic import BaseModel


def run_python(script: str) -> None:
    """Run import checks in isolation from nest-asyncio's global patches."""
    result = subprocess.run(
        [sys.executable, "-c", textwrap.dedent(script)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize(
    "setup",
    [
        "asyncio.set_event_loop(asyncio.new_event_loop())",
        "asyncio.set_event_loop(None)",
        "class CustomLoop(asyncio.AbstractEventLoop): pass\n"
        "asyncio.set_event_loop(CustomLoop())",
    ],
    ids=["standard-loop", "no-current-loop", "unsupported-loop"],
)
def test_import_with_event_loop(setup: str) -> None:
    """Import successfully with standard, absent, and unsupported loops."""
    run_python(
        "import asyncio\n"
        + setup
        + "\nfrom coinbase_agentkit_langchain import get_langchain_tools\n"
        + "assert callable(get_langchain_tools)\n"
    )


def test_nested_standard_loop_action() -> None:
    """Preserve synchronous actions that run coroutines on a standard loop."""
    run_python(
        """
        import asyncio
        from types import SimpleNamespace
        from pydantic import BaseModel
        from coinbase_agentkit import Action
        from coinbase_agentkit_langchain import get_langchain_tools

        class Inputs(BaseModel):
            value: str

        async def echo(value):
            return value

        def invoke(args):
            return asyncio.get_event_loop().run_until_complete(echo(args["value"]))

        action = Action(name="echo", description="Echo input", args_schema=Inputs, invoke=invoke)
        toolkit = SimpleNamespace(get_actions=lambda: [action])
        tool = get_langchain_tools(toolkit)[0]

        async def main():
            assert tool.invoke({"value": "nested"}) == "nested"

        asyncio.get_event_loop().run_until_complete(main())
        """
    )


@pytest.mark.parametrize("current_loop", [True, False], ids=["current-loop", "no-current-loop"])
def test_import_with_uvloop_policy(current_loop: bool) -> None:
    """Import with uvloop's policy both before and after selecting a loop."""
    if importlib.util.find_spec("uvloop") is None:
        pytest.skip("uvloop is not installed on this platform")

    setup = "uvloop.new_event_loop()" if current_loop else "None"
    run_python(
        "import asyncio, uvloop\n"
        "uvloop.install()\n"
        f"asyncio.set_event_loop({setup})\n"
        "from coinbase_agentkit_langchain import get_langchain_tools\n"
        "assert callable(get_langchain_tools)\n"
    )


def test_import_in_worker_thread() -> None:
    """Initialize the extension when a worker thread has no current loop."""
    run_python(
        """
        from concurrent.futures import ThreadPoolExecutor

        def load():
            from coinbase_agentkit_langchain import get_langchain_tools
            return callable(get_langchain_tools)

        with ThreadPoolExecutor(max_workers=1) as executor:
            assert executor.submit(load).result()
        """
    )


def test_async_tool_with_uvloop() -> None:
    """Import and invoke an asynchronous LangChain tool under real uvloop."""
    if importlib.util.find_spec("uvloop") is None:
        pytest.skip("uvloop is not installed on this platform")

    run_python(
        """
        import asyncio
        import threading
        from types import SimpleNamespace
        import uvloop
        from pydantic import BaseModel

        uvloop.install()
        loop = uvloop.new_event_loop()
        asyncio.set_event_loop(loop)

        from coinbase_agentkit import Action

        class Inputs(BaseModel):
            value: str

        loop_thread = threading.get_ident()

        async def echo(value):
            return value

        def invoke(args):
            assert threading.get_ident() != loop_thread
            action_loop = asyncio.new_event_loop()
            try:
                return action_loop.run_until_complete(echo(args["value"]))
            finally:
                action_loop.close()

        action = Action(name="echo", description="Echo input", args_schema=Inputs, invoke=invoke)
        toolkit = SimpleNamespace(get_actions=lambda: [action])

        async def main():
            from coinbase_agentkit_langchain import get_langchain_tools
            tool = get_langchain_tools(toolkit)[0]
            assert await tool.ainvoke({"value": "uvloop"}) == "uvloop"

        try:
            loop.run_until_complete(main())
        finally:
            loop.close()
            asyncio.set_event_loop(None)
        """
    )


def test_tools_preserve_action_binding() -> None:
    """Keep each tool bound to its own action and input schema."""
    from coinbase_agentkit import Action
    from coinbase_agentkit_langchain import get_langchain_tools

    class Inputs(BaseModel):
        """Arguments for the test actions."""

        value: str

    actions = [
        Action(
            name="first",
            description="First action",
            args_schema=Inputs,
            invoke=lambda args: f"first:{args['value']}",
        ),
        Action(
            name="second",
            description="Second action",
            args_schema=Inputs,
            invoke=lambda args: f"second:{args['value']}",
        ),
    ]
    tools = get_langchain_tools(SimpleNamespace(get_actions=lambda: actions))

    assert [tool.name for tool in tools] == ["first", "second"]
    assert all(tool.args_schema is Inputs for tool in tools)
    assert tools[0].invoke({"value": "one"}) == "first:one"
    assert tools[1].invoke({"value": "two"}) == "second:two"
