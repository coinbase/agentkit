"""Tests for x402 service allowlist matching."""

import pytest

from coinbase_agentkit.action_providers.x402.utils import is_service_registered


@pytest.mark.parametrize(
    "url",
    [
        "https://api.example.com",
        "https://api.example.com/",
        "https://api.example.com/v1/data?x=1",
        "https://API.example.com/x",
        "https://api.example.com:443/x",
    ],
)
def test_origin_only_allows_same_origin(url):
    """Origin-only entries allow any path on the exact origin."""
    assert is_service_registered(url, {"https://api.example.com"}) is True


@pytest.mark.parametrize(
    "url",
    [
        "https://api.example.com.evil.io/x",
        "https://api.example.comevil.io/x",
        "https://api.example.com@evil.io/x",
        "https://user:pass@api.example.com/x",
        "https://api.example.com:pw@evil.io/x",
        "https://evil.io\\@api.example.com/x",
        "https://api.example.com\\@evil.io/x",
        "http://api.example.com/x",
        "https://api.example.com:8443/x",
        "ftp://api.example.com/x",
        "//api.example.com/x",
        "https://api.example.com /x",
        "https://api.example.com\t.evil.io/x",
        "https://api.example.com\n/x",
        "https://api.example.com:notaport/x",
        "not a url",
        "",
    ],
)
def test_origin_only_rejects_bypasses(url):
    """Hostname suffix, userinfo, parser-differential and other-origin URLs are rejected."""
    assert is_service_registered(url, {"https://api.example.com"}) is False


@pytest.mark.parametrize(
    "url",
    [
        "https://api.example.com/api",
        "https://api.example.com/api/",
        "https://api.example.com/api/v1/data?x=1",
    ],
)
def test_path_scoped_allows_subpaths(url):
    """Path-scoped entries allow the exact path and nested paths."""
    assert is_service_registered(url, {"https://api.example.com/api"}) is True


@pytest.mark.parametrize(
    "url",
    [
        "https://api.example.com/apiX",
        "https://api.example.com/api-admin/x",
        "https://api.example.com/",
        "https://api.example.com/admin",
        "https://api.example.com/api/../admin",
        "https://api.example.com/api/./v1",
        "https://api.example.com/api/%2e%2e/admin",
        "https://api.example.com/api/%2E%2E/admin",
        "https://api.example.com/api/.%2e/admin",
        "https://api.example.com/api/v1/../v2",
    ],
)
def test_path_scoped_rejects_siblings_and_dot_segments(url):
    """Sibling paths and any dot-segments (raw or percent-encoded) are rejected."""
    assert is_service_registered(url, {"https://api.example.com/api"}) is False


def test_registered_trailing_slash_is_equivalent():
    """A trailing slash on the registered path does not change the scope."""
    registered = {"https://api.example.com/api/"}
    assert is_service_registered("https://api.example.com/api", registered) is True
    assert is_service_registered("https://api.example.com/api/v1", registered) is True
    assert is_service_registered("https://api.example.com/apiX", registered) is False


def test_double_slash_registration_is_not_origin_wide():
    """A path made only of slashes does not become an origin-wide registration."""
    registered = {"https://api.example.com//"}
    assert is_service_registered("https://api.example.com/admin", registered) is False
    assert is_service_registered("https://api.example.com//child", registered) is True


def test_empty_registry_rejects_everything():
    """Nothing is allowed when no services are registered."""
    assert is_service_registered("https://api.example.com", set()) is False


def test_invalid_registered_entries_are_skipped():
    """Unparseable or unsafe registered entries never match, valid ones still do."""
    registered = {"garbage", "https://user:pw@evil.io", "https://ok.example.com"}
    assert is_service_registered("https://ok.example.com/x", registered) is True
    assert is_service_registered("https://evil.io/x", registered) is False


def test_matches_any_registered_entry():
    """A URL is allowed if any registered entry matches."""
    registered = {"https://a.example.com", "https://b.example.com/api"}
    assert is_service_registered("https://a.example.com/x", registered) is True
    assert is_service_registered("https://b.example.com/api/x", registered) is True
    assert is_service_registered("https://b.example.com/other", registered) is False
