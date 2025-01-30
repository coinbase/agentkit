from json import dumps
from unittest.mock import patch

import pytest
from cdp_agentkit_core.actions.social.farcaster.cast import CastAction
from farcaster_langchain import FarcasterApiWrapper

MOCK_TEXT = "Hello Farcaster!"
MOCK_CAST_HASH = "0x123"
MOCK_CHANNEL_ID = "789"
MOCK_EMBEDS = ["https://example.com"]

def test_cast_success(farcaster_api_wrapper):
    """Test successful cast creation with default parameters."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=None)

def test_cast_success_with_channel(farcaster_api_wrapper):
    """Test successful cast creation with channel_id."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
                "channel_id": MOCK_CHANNEL_ID
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=MOCK_CHANNEL_ID)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=None)

def test_cast_success_with_embeds(farcaster_api_wrapper):
    """Test successful cast creation with embeds."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
                "embeds": MOCK_EMBEDS
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=MOCK_EMBEDS)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=MOCK_EMBEDS)

def test_cast_success_with_all_options(farcaster_api_wrapper):
    """Test successful cast creation with all optional parameters."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
                "channel_id": MOCK_CHANNEL_ID,
                "embeds": MOCK_EMBEDS
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=MOCK_EMBEDS)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=MOCK_EMBEDS)

def test_cast_empty_text(farcaster_api_wrapper):
    """Test cast creation with empty text."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Cast text cannot be empty"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, "")

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text="", channel_id=None, embeds=None)

def test_cast_invalid_channel(farcaster_api_wrapper):
    """Test cast creation with invalid channel ID."""
    mock_client = farcaster_api_wrapper
    invalid_channel = "invalid"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid channel ID"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=invalid_channel)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=invalid_channel, embeds=None)

def test_cast_invalid_embed(farcaster_api_wrapper):
    """Test cast creation with invalid embed URL."""
    mock_client = farcaster_api_wrapper
    invalid_embeds = ["not-a-url"]
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL format"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=invalid_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=invalid_embeds)

def test_cast_long_text(farcaster_api_wrapper):
    """Test cast creation with maximum length text."""
    mock_client = farcaster_api_wrapper
    long_text = "x" * 320  # Farcaster's max length
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Cast text exceeds maximum length"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, long_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=long_text, channel_id=None, embeds=None)

def test_cast_multiple_embeds(farcaster_api_wrapper):
    """Test cast creation with multiple embeds."""
    mock_client = farcaster_api_wrapper
    multiple_embeds = ["https://example.com/1", "https://example.com/2"]
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
                "embeds": multiple_embeds
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=multiple_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=multiple_embeds)

def test_cast_too_many_embeds(farcaster_api_wrapper):
    """Test cast creation with too many embeds."""
    mock_client = farcaster_api_wrapper
    too_many_embeds = ["https://example.com/" + str(i) for i in range(5)]  # More than allowed
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Too many embeds"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=too_many_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=too_many_embeds)

def test_cast_special_characters(farcaster_api_wrapper):
    """Test cast creation with special characters."""
    mock_client = farcaster_api_wrapper
    special_text = "Hello! 👋 #test @user 🚀"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": special_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, special_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=special_text, channel_id=None, embeds=None)

def test_cast_channel_with_embeds_invalid(farcaster_api_wrapper):
    """Test cast creation with valid channel but invalid embeds."""
    mock_client = farcaster_api_wrapper
    invalid_embeds = ["not-a-url"]
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL format"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=invalid_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=invalid_embeds)

def test_cast_empty_embeds(farcaster_api_wrapper):
    """Test cast creation with empty embeds list."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=[])

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=[])

def test_cast_whitespace_text(farcaster_api_wrapper):
    """Test cast creation with whitespace-only text."""
    mock_client = farcaster_api_wrapper
    whitespace_text = "   \n\t   "
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Cast text cannot be empty"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, whitespace_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=whitespace_text, channel_id=None, embeds=None)

def test_cast_invalid_channel_with_valid_embeds(farcaster_api_wrapper):
    """Test cast creation with invalid channel but valid embeds."""
    mock_client = farcaster_api_wrapper
    invalid_channel = "invalid"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid channel ID"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=invalid_channel, embeds=MOCK_EMBEDS)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=invalid_channel, embeds=MOCK_EMBEDS)

def test_cast_unicode_text(farcaster_api_wrapper):
    """Test cast creation with unicode characters."""
    mock_client = farcaster_api_wrapper
    unicode_text = "Hello 世界! Привет мир! مرحبا بالعالم!"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": unicode_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, unicode_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=unicode_text, channel_id=None, embeds=None)

def test_cast_multiple_urls_text(farcaster_api_wrapper):
    """Test cast creation with multiple URLs in text."""
    mock_client = farcaster_api_wrapper
    text_with_urls = "Check out https://example.com and https://test.com"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": text_with_urls,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, text_with_urls)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=text_with_urls, channel_id=None, embeds=None)

def test_cast_repeated_embeds(farcaster_api_wrapper):
    """Test cast creation with duplicate embed URLs."""
    mock_client = farcaster_api_wrapper
    repeated_embeds = ["https://example.com", "https://example.com"]
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Duplicate embed URLs not allowed"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=repeated_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=repeated_embeds)

def test_cast_max_length_with_embeds(farcaster_api_wrapper):
    """Test cast creation with maximum length text and embeds."""
    mock_client = farcaster_api_wrapper
    max_text = "x" * 319  # Just under max length
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": max_text,
                "timestamp": "2024-03-20T12:00:00Z",
                "embeds": MOCK_EMBEDS
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, max_text, embeds=MOCK_EMBEDS)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=max_text, channel_id=None, embeds=MOCK_EMBEDS)

def test_cast_newlines_and_tabs(farcaster_api_wrapper):
    """Test cast creation with newlines and tabs in text."""
    mock_client = farcaster_api_wrapper
    formatted_text = "Line 1\nLine 2\tTabbed"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": formatted_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, formatted_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=formatted_text, channel_id=None, embeds=None)

def test_cast_html_characters(farcaster_api_wrapper):
    """Test cast creation with HTML special characters."""
    mock_client = farcaster_api_wrapper
    html_text = "Test & <script> alert('test') </script>"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": html_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, html_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=html_text, channel_id=None, embeds=None)

def test_cast_null_channel_id(farcaster_api_wrapper):
    """Test cast creation with explicitly null channel_id."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=None)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=None)

def test_cast_empty_channel_id(farcaster_api_wrapper):
    """Test cast creation with empty string channel_id."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid channel ID"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id="")

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id="", embeds=None)

def test_cast_zero_channel_id(farcaster_api_wrapper):
    """Test cast creation with zero as channel_id."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid channel ID"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id="0")

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id="0", embeds=None)

def test_cast_invalid_embed_url_format(farcaster_api_wrapper):
    """Test cast creation with malformed URL in embeds."""
    mock_client = farcaster_api_wrapper
    invalid_url = "http:/malformed.url"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL format"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=[invalid_url])

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=[invalid_url])

def test_cast_non_http_embed_url(farcaster_api_wrapper):
    """Test cast creation with non-HTTP protocol URL in embeds."""
    mock_client = farcaster_api_wrapper
    non_http_url = "ftp://example.com"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL protocol"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=[non_http_url])

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=[non_http_url])

def test_cast_json_text(farcaster_api_wrapper):
    """Test cast creation with JSON-formatted text."""
    mock_client = farcaster_api_wrapper
    json_text = '{"key": "value", "array": [1,2,3]}'
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": json_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, json_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=json_text, channel_id=None, embeds=None)

def test_cast_markdown_text(farcaster_api_wrapper):
    """Test cast creation with markdown-style text."""
    mock_client = farcaster_api_wrapper
    markdown_text = "# Heading\n**bold** *italic*"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": markdown_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, markdown_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=markdown_text, channel_id=None, embeds=None)

def test_cast_multiple_mentions(farcaster_api_wrapper):
    """Test cast creation with multiple @mentions."""
    mock_client = farcaster_api_wrapper
    mention_text = "Hey @user1 @user2 @user3 check this out!"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": mention_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, mention_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=mention_text, channel_id=None, embeds=None)

def test_cast_multiple_hashtags(farcaster_api_wrapper):
    """Test cast creation with multiple #hashtags."""
    mock_client = farcaster_api_wrapper
    hashtag_text = "Big news! #announcement #update #launch"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": hashtag_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, hashtag_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=hashtag_text, channel_id=None, embeds=None)

def test_cast_mixed_content(farcaster_api_wrapper):
    """Test cast creation with mixed content (mentions, hashtags, URLs, emojis)."""
    mock_client = farcaster_api_wrapper
    mixed_text = "Hey @user! 👋 Check out https://example.com #awesome 🚀"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": mixed_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, mixed_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=mixed_text, channel_id=None, embeds=None)

def test_cast_only_numbers(farcaster_api_wrapper):
    """Test cast creation with only numbers."""
    mock_client = farcaster_api_wrapper
    number_text = "123 456 789"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": number_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, number_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=number_text, channel_id=None, embeds=None)

def test_cast_repeated_text(farcaster_api_wrapper):
    """Test cast creation with repeated text."""
    mock_client = farcaster_api_wrapper
    repeated_text = "test " * 10
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": repeated_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, repeated_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=repeated_text, channel_id=None, embeds=None)

def test_cast_single_character(farcaster_api_wrapper):
    """Test cast creation with single character."""
    mock_client = farcaster_api_wrapper
    single_char = "x"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": single_char,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, single_char)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=single_char, channel_id=None, embeds=None)

def test_cast_multiple_spaces(farcaster_api_wrapper):
    """Test cast creation with multiple spaces between words."""
    mock_client = farcaster_api_wrapper
    spaced_text = "This    has    many    spaces"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": spaced_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, spaced_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=spaced_text, channel_id=None, embeds=None)

def test_cast_leading_trailing_spaces(farcaster_api_wrapper):
    """Test cast creation with leading and trailing spaces."""
    mock_client = farcaster_api_wrapper
    padded_text = "   padded text   "
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": padded_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, padded_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=padded_text, channel_id=None, embeds=None)

def test_cast_math_symbols(farcaster_api_wrapper):
    """Test cast creation with mathematical symbols."""
    mock_client = farcaster_api_wrapper
    math_text = "2 + 2 = 4 × 2 ÷ 2 ≠ 3 ≥ 2 ≤ 5 ∑ π"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": math_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, math_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=math_text, channel_id=None, embeds=None)

def test_cast_currency_symbols(farcaster_api_wrapper):
    """Test cast creation with currency symbols."""
    mock_client = farcaster_api_wrapper
    currency_text = "Price: $100 €50 £30 ¥5000 ₿0.001"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": currency_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, currency_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=currency_text, channel_id=None, embeds=None)

def test_cast_mixed_languages(farcaster_api_wrapper):
    """Test cast creation with mixed language text."""
    mock_client = farcaster_api_wrapper
    mixed_lang_text = "Hello 你好 Bonjour مرحبا Привет こんにちは"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": mixed_lang_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, mixed_lang_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=mixed_lang_text, channel_id=None, embeds=None)

def test_cast_code_snippet(farcaster_api_wrapper):
    """Test cast creation with code snippet."""
    mock_client = farcaster_api_wrapper
    code_text = "def hello():\n    print('Hello World!')\n#python"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": code_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, code_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=code_text, channel_id=None, embeds=None)

def test_cast_ascii_art(farcaster_api_wrapper):
    """Test cast creation with ASCII art."""
    mock_client = farcaster_api_wrapper
    ascii_text = """
    /\\_/\\
   ( o.o )
    > ^ <
    """
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": ascii_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, ascii_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=ascii_text, channel_id=None, embeds=None)

def test_cast_max_embeds_with_channel(farcaster_api_wrapper):
    """Test cast creation with maximum allowed embeds and channel."""
    mock_client = farcaster_api_wrapper
    max_embeds = ["https://example.com/1", "https://example.com/2", "https://example.com/3"]
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": MOCK_TEXT,
                "timestamp": "2024-03-20T12:00:00Z",
                "channel_id": MOCK_CHANNEL_ID,
                "embeds": max_embeds
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=max_embeds)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=MOCK_CHANNEL_ID, embeds=max_embeds)

def test_cast_embedded_quotes(farcaster_api_wrapper):
    """Test cast creation with embedded quotes and apostrophes."""
    mock_client = farcaster_api_wrapper
    quoted_text = 'She said "Hello!" and I\'m happy'
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": quoted_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, quoted_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=quoted_text, channel_id=None, embeds=None)

def test_cast_zero_width_characters(farcaster_api_wrapper):
    """Test cast creation with zero-width characters."""
    mock_client = farcaster_api_wrapper
    zero_width_text = "Hello​World"  # Contains zero-width space
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": zero_width_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, zero_width_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=zero_width_text, channel_id=None, embeds=None)

def test_cast_control_characters(farcaster_api_wrapper):
    """Test cast creation with control characters."""
    mock_client = farcaster_api_wrapper
    control_text = "Hello\u0000World\u0007"  # Contains NULL and BELL
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid control characters in text"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, control_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=control_text, channel_id=None, embeds=None)

def test_cast_rtl_text(farcaster_api_wrapper):
    """Test cast creation with right-to-left text."""
    mock_client = farcaster_api_wrapper
    rtl_text = "Hello مرحبا שָׁלוֹם"
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": rtl_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, rtl_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=rtl_text, channel_id=None, embeds=None)

def test_cast_data_url_embed(farcaster_api_wrapper):
    """Test cast creation with data URL in embeds."""
    mock_client = farcaster_api_wrapper
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL protocol"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=[data_url])

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=[data_url])

def test_cast_relative_url_embed(farcaster_api_wrapper):
    """Test cast creation with relative URL in embeds."""
    mock_client = farcaster_api_wrapper
    relative_url = "/path/to/resource"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid embed URL format"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, MOCK_TEXT, embeds=[relative_url])

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=MOCK_TEXT, channel_id=None, embeds=[relative_url])

def test_cast_null_byte_text(farcaster_api_wrapper):
    """Test cast creation with null bytes in text."""
    mock_client = farcaster_api_wrapper
    null_byte_text = "Hello\x00World"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid characters in text"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, null_byte_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=null_byte_text, channel_id=None, embeds=None)

def test_cast_invisible_characters(farcaster_api_wrapper):
    """Test cast creation with invisible characters."""
    mock_client = farcaster_api_wrapper
    invisible_text = "Hello\u200bWorld\u200c\u200d"  # Zero-width space, non-joiner, joiner
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": invisible_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, invisible_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=invisible_text, channel_id=None, embeds=None)

def test_cast_combining_diacritical_marks(farcaster_api_wrapper):
    """Test cast creation with combining diacritical marks."""
    mock_client = farcaster_api_wrapper
    diacritical_text = "n\u0303o\u0308"  # ñö using combining marks
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": diacritical_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, diacritical_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=diacritical_text, channel_id=None, embeds=None)

def test_cast_surrogate_pairs(farcaster_api_wrapper):
    """Test cast creation with surrogate pairs (emoji)."""
    mock_client = farcaster_api_wrapper
    surrogate_text = "Hello 👨‍👩‍👧‍👦 World"  # Family emoji using surrogate pairs
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": surrogate_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, surrogate_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=surrogate_text, channel_id=None, embeds=None)

def test_cast_byte_order_mark(farcaster_api_wrapper):
    """Test cast creation with byte order mark."""
    mock_client = farcaster_api_wrapper
    bom_text = "\ufeffHello World"  # Starts with BOM
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": bom_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, bom_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=bom_text, channel_id=None, embeds=None)

def test_cast_variation_selectors(farcaster_api_wrapper):
    """Test cast creation with variation selectors."""
    mock_client = farcaster_api_wrapper
    variation_text = "️⃣1️⃣2️⃣3️⃣"  # Numbers with variation selectors
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": variation_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, variation_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=variation_text, channel_id=None, embeds=None)

def test_cast_bidirectional_formatting(farcaster_api_wrapper):
    """Test cast creation with bidirectional formatting characters."""
    mock_client = farcaster_api_wrapper
    bidi_text = "\u202EReversed\u202C Normal"  # Right-to-left override
    mock_client_result = {
        "result": {
            "cast": {
                "hash": MOCK_CAST_HASH,
                "text": bidi_text,
                "timestamp": "2024-03-20T12:00:00Z"
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, bidi_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=bidi_text, channel_id=None, embeds=None)

def test_cast_private_use_characters(farcaster_api_wrapper):
    """Test cast creation with private use characters."""
    mock_client = farcaster_api_wrapper
    private_text = "Hello \uE000\uE001 World"  # Private use characters
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid characters in text"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, private_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=private_text, channel_id=None, embeds=None)

def test_cast_noncharacters(farcaster_api_wrapper):
    """Test cast creation with Unicode noncharacters."""
    mock_client = farcaster_api_wrapper
    nonchar_text = "Hello \uFDD0\uFDD1 World"  # Unicode noncharacters
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid characters in text"
    }

    with patch.object(FarcasterApiWrapper, "cast", return_value=mock_client_result) as mock_cast:
        action = CastAction()
        response = action.func(mock_client, nonchar_text)

        assert response == mock_client_result
        mock_cast.assert_called_once_with(text=nonchar_text, channel_id=None, embeds=None) 