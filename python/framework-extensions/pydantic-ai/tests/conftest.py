"""Configure pytest for the test suite."""

import pytest

# Set default event loop policy for all async tests
pytest.mark_asyncio_loop_scope = "function"

# Mark all tests in this directory as asyncio tests
pytestmark = pytest.mark.asyncio
