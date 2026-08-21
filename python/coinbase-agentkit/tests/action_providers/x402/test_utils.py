"""Tests for x402 action provider utility functions."""

from coinbase_agentkit.action_providers.x402.utils import filter_by_description


def test_filter_by_description_keeps_v2_top_level_description():
    """A v2 resource with a top-level description is kept."""
    resources = [
        {
            "resource": "https://example.com/feed",
            "x402_version": 2,
            "description": "Live agent-index data",
        }
    ]

    assert filter_by_description(resources) == resources


def test_filter_by_description_keeps_v2_metadata_only_description():
    """A v2 resource that only has metadata.description is kept."""
    resources = [
        {
            "resource": "https://example.com/feed",
            "x402_version": 2,
            "metadata": {"description": "Legacy metadata-only description"},
        }
    ]

    assert filter_by_description(resources) == resources


def test_filter_by_description_prefers_top_level_over_metadata():
    """The top-level description wins when both are present."""
    resources = [
        {
            "resource": "https://example.com/feed",
            "x402_version": 2,
            "description": "Top-level wins",
            "metadata": {"description": "Should be ignored"},
        }
    ]

    assert len(filter_by_description(resources)) == 1


def test_filter_by_description_drops_v2_with_no_description():
    """A v2 resource with no description anywhere is dropped."""
    resources = [
        {
            "resource": "https://example.com/feed",
            "x402_version": 2,
        }
    ]

    assert filter_by_description(resources) == []


def test_filter_by_description_leaves_v1_accepts_path_unchanged():
    """The v1 accepts[].description path is unaffected by the v2 fix."""
    resources = [
        {
            "resource": "https://example.com/v1-feed",
            "x402_version": 1,
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "base",
                    "asset": "0xusdc",
                    "max_amount_required": "1000",
                    "description": "v1 accepts description",
                }
            ],
        }
    ]

    assert filter_by_description(resources) == resources


def test_filter_by_description_drops_default_placeholder():
    """Resources whose description is the discovery API's default placeholder are dropped."""
    resources = [
        {
            "resource": "https://example.com/placeholder",
            "x402_version": 2,
            "description": "Access to protected content",
        }
    ]

    assert filter_by_description(resources) == []
