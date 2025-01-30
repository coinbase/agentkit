from json import dumps
from unittest.mock import patch

import pytest
from cdp_agentkit_core.actions.social.farcaster.user_details import UserDetailsAction
from farcaster_langchain import FarcasterApiWrapper

MOCK_FID = "1234"

def test_user_details_success(farcaster_api_wrapper):
    """Test successful retrieval of user details."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "user": {
                "fid": int(MOCK_FID),
                "username": "test_user",
                "displayName": "Test User",
                "pfp": {
                    "url": "https://example.com/avatar.png"
                }
            }
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "get_user_details", return_value=mock_client_result) as mock_get:
        action = UserDetailsAction()
        response = action.func(mock_client, MOCK_FID)

        assert response == mock_client_result
        mock_get.assert_called_once_with(MOCK_FID)

def test_user_details_not_found(farcaster_api_wrapper):
    """Test user details retrieval when user is not found."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "User not found"
    }

    with patch.object(FarcasterApiWrapper, "get_user_details", return_value=mock_client_result) as mock_get:
        action = UserDetailsAction()
        response = action.func(mock_client, MOCK_FID)

        assert response == mock_client_result
        mock_get.assert_called_once_with(MOCK_FID)

def test_user_details_invalid_fid(farcaster_api_wrapper):
    """Test user details retrieval with invalid FID."""
    mock_client = farcaster_api_wrapper
    invalid_fid = "invalid"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid FID format"
    }

    with patch.object(FarcasterApiWrapper, "get_user_details", return_value=mock_client_result) as mock_get:
        action = UserDetailsAction()
        response = action.func(mock_client, invalid_fid)

        assert response == mock_client_result
        mock_get.assert_called_once_with(invalid_fid)