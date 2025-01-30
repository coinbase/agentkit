from json import dumps
from unittest.mock import patch
from typing import List

import pytest
from cdp_agentkit_core.actions.social.farcaster.notifications import NotificationsAction
from farcaster_langchain import FarcasterApiWrapper

MOCK_FID = "1234"
MOCK_TYPES = ["likes", "mentions"]

def test_notifications_success(farcaster_api_wrapper):
    """Test successful retrieval of notifications."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "notifications": [
                {
                    "type": "like",
                    "timestamp": "2024-03-20T12:00:00Z",
                    "user": {
                        "fid": int(MOCK_FID),
                        "username": "test_user",
                        "displayName": "Test User"
                    }
                }
            ]
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "get_notifications", return_value=mock_client_result) as mock_get:
        action = NotificationsAction()
        response = action.func(mock_client, types=MOCK_TYPES, fid=MOCK_FID)

        assert response == mock_client_result
        mock_get.assert_called_once_with(MOCK_FID, MOCK_TYPES)

def test_notifications_success_no_params(farcaster_api_wrapper):
    """Test successful retrieval of notifications without optional parameters."""
    mock_client = farcaster_api_wrapper
    mock_client_result = {
        "result": {
            "notifications": [
                {
                    "type": "like",
                    "timestamp": "2024-03-20T12:00:00Z",
                    "user": {
                        "fid": int(MOCK_FID),
                        "username": "test_user",
                        "displayName": "Test User"
                    }
                }
            ]
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "get_notifications", return_value=mock_client_result) as mock_get:
        action = NotificationsAction()
        response = action.func(mock_client)

        assert response == mock_client_result
        mock_get.assert_called_once_with(None, None)

def test_notifications_invalid_type(farcaster_api_wrapper):
    """Test notifications retrieval with invalid notification type."""
    mock_client = farcaster_api_wrapper
    invalid_types = ["invalid_type"]
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid notification type"
    }

    with patch.object(FarcasterApiWrapper, "get_notifications", return_value=mock_client_result) as mock_get:
        action = NotificationsAction()
        response = action.func(mock_client, types=invalid_types)

        assert response == mock_client_result
        mock_get.assert_called_once_with(None, invalid_types)

def test_notifications_invalid_fid(farcaster_api_wrapper):
    """Test notifications retrieval with invalid FID."""
    mock_client = farcaster_api_wrapper
    invalid_fid = "invalid"
    mock_client_result = {
        "result": None,
        "success": False,
        "error": "Invalid FID format"
    }

    with patch.object(FarcasterApiWrapper, "get_notifications", return_value=mock_client_result) as mock_get:
        action = NotificationsAction()
        response = action.func(mock_client, fid=invalid_fid)

        assert response == mock_client_result
        mock_get.assert_called_once_with(invalid_fid, None)

def test_notifications_all_valid_types(farcaster_api_wrapper):
    """Test notifications retrieval with all valid notification types."""
    mock_client = farcaster_api_wrapper
    valid_types = ["follows", "recasts", "likes", "mentions", "replies"]
    mock_client_result = {
        "result": {
            "notifications": [
                {
                    "type": "like",
                    "timestamp": "2024-03-20T12:00:00Z",
                    "user": {
                        "fid": int(MOCK_FID),
                        "username": "test_user",
                        "displayName": "Test User"
                    }
                }
            ]
        },
        "success": True
    }

    with patch.object(FarcasterApiWrapper, "get_notifications", return_value=mock_client_result) as mock_get:
        action = NotificationsAction()
        response = action.func(mock_client, types=valid_types)

        assert response == mock_client_result
        mock_get.assert_called_once_with(None, valid_types) 