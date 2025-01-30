"""Util that calls Neynar API for Farcaster interactions."""

import uuid
from typing import Any, List, Optional, Callable
import requests
from langchain_core.utils import get_from_dict_or_env
from pydantic import BaseModel, model_validator
import json

class FarcasterApiWrapper(BaseModel):
    """Wrapper for Neynar API to interact with Farcaster."""

    api_key: str
    signer_uuid: str
    fid: str
    base_url: str = "https://api.neynar.com/v2/farcaster"

    @model_validator(mode="before")
    @classmethod
    def validate_environment(cls, values: dict) -> Any:
        """Validate that API keys exist in the environment."""
        
        print("Current values:", values)
        print("Looking for environment variables...")
        api_key = get_from_dict_or_env(values, "neynar_api_key", "NEYNAR_API_KEY")
        signer_uuid = get_from_dict_or_env(values, "signer_uuid", "NEYNAR_SIGNER_UUID")
        fid = get_from_dict_or_env(values, "fid", "FARCASTER_FID")

        values["api_key"] = api_key
        values["signer_uuid"] = signer_uuid
        values["fid"] = fid
        return values

    def _make_request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make a request to the Neynar API."""
        headers = {
            "accept": "application/json",
            "api_key": self.api_key,
            "content-type": "application/json"
        }
        
        url = f"{self.base_url}/{endpoint}"
        response = requests.request(method, url, headers=headers, **kwargs)
        if not response.ok:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
        response.raise_for_status()
        return response.json()

    def cast(self, text: str, channel_id: Optional[str] = None, embeds: Optional[List[str]] = None) -> str:
        """Post a cast to Farcaster.

        Args:
            text (str): The text to cast. Maximum 320 characters.
            channel_id (str, optional): Channel to post in (e.g., 'python')
            embeds (list, optional): List of URLs or cast_ids to embed
                For URLs: just pass the URL string
                For cast references: pass "cast_id:hash:fid" format

        Returns:
            str: A message containing the result of the cast action.
        """
        if len(text) > 320:
            raise ValueError("Cast text must be 320 characters or less")

        url = f"{self.base_url}/cast"

        formatted_embeds = []
        if embeds:
            for embed in embeds:
                if embed.startswith("cast_id:"):
                    # Handle cast reference embeds
                    _, hash_val, fid = embed.split(":")
                    formatted_embeds.append({
                        "cast_id": {
                            "hash": hash_val,
                            "fid": int(fid)
                        }
                    })
                else:
                    # Handle URL embeds
                    formatted_embeds.append({"url": embed})

        data = {
            "signer_uuid": self.signer_uuid,
            "text": text,
            "embeds": formatted_embeds,
            "idem": str(uuid.uuid4())[:16]
        }

        # Add channel if specified
        if channel_id:
            data["channel_id"] = channel_id

        print("\nPosting cast with data:")
        print(json.dumps(data, indent=2))

        try:
            headers = {
                "accept": "application/json",
                "api_key": self.api_key,
                "content-type": "application/json"
            }
            response = requests.post(url, headers=headers, json=data)
            if not response.ok:
                print(f"Response status: {response.status_code}")
                print(f"Response body: {response.text}")
                response.raise_for_status()
            return f"Successfully posted cast: {text}"
        except Exception as e:
            return f"Failed to post cast: {str(e)}"

    def reply_to_cast(self, cast_hash: str, text: str, embeds: Optional[List[str]] = None) -> str:
        """Reply to an existing cast.

        Args:
            cast_hash (str): The hash of the cast to reply to
            text (str): The text of the reply. Maximum 320 characters.
            embeds (list, optional): List of URLs to embed

        Returns:
            str: A message containing the result of the reply action.
        """
        if len(text) > 320:
            raise ValueError("Reply text must be 320 characters or less")

        url = f"{self.base_url}/cast"
        
        data = {
            "signer_uuid": self.signer_uuid,
            "text": text,
            "parent_hash": cast_hash,
            "embeds": embeds or [],
            "idem": str(uuid.uuid4())[:16]
        }

        print("\nPosting reply with data:")
        print(json.dumps(data, indent=2))

        try:
            headers = {
                "accept": "application/json",
                "api_key": self.api_key,
                "content-type": "application/json"
            }
            response = requests.post(url, headers=headers, json=data)
            if not response.ok:
                print(f"Response status: {response.status_code}")
                print(f"Response body: {response.text}")
                response.raise_for_status()
            return f"Successfully replied to cast {cast_hash}: {text}"
        except Exception as e:
            return f"Failed to reply to cast: {str(e)}"

    def get_user_details(self, fid: Optional[str] = None) -> str:
        """Get details about a Farcaster user.

        Args:
            fid (str, optional): The FID (Farcaster ID) of the user. 
                               If not provided, uses the authenticated user's FID.

        Returns:
            str: User details in a formatted string.
        """
        try:
            # Use provided FID or default to authenticated user
            target_fid = fid or self.fid
            response = self._make_request("GET", f"user/bulk?fids={target_fid}")
            
            # Check if we got user data
            if "users" in response and response["users"]:
                user = response["users"][0]  # Get the first user since we only requested one
                return (f"Retrieved user details for FID {target_fid}:\n"
                       f"Username: {user.get('username', 'N/A')}\n"
                       f"Display Name: {user.get('display_name', 'N/A')}\n"
                       f"Profile Image: {user.get('pfp_url', 'N/A')}\n"
                       f"Followers: {user.get('followers_count', 0)}\n"
                       f"Following: {user.get('following_count', 0)}")
            else:
                return f"No user details found for FID {target_fid}"
            
        except Exception as e:
            print(f"Error response: {str(e)}")  # Debug print
            return f"Failed to get user details: {str(e)}"

    def get_user_casts(self, fid: str, limit: int = 10) -> str:
        """Get recent casts from a user.

        Args:
            fid (str): The FID (Farcaster ID) of the user.
            limit (int): Number of casts to retrieve (max 100).

        Returns:
            str: A message containing the retrieved casts.
        """
        if limit > 100:
            raise ValueError("Cannot retrieve more than 100 casts at once")

        try:
            response = self._make_request("GET", f"user/cast?fid={fid}&limit={limit}")
            return f"Retrieved {len(response.get('casts', []))} casts from user {fid}"
        except Exception as e:
            return f"Failed to get user casts: {str(e)}"

    def run_action(self, func: Callable[..., str], **kwargs) -> str:
        """Run a Farcaster Action.
        
        Args:
            func (Callable): The function to run
            **kwargs: Arguments to pass to the function
            
        Returns:
            str: The result of the action
        """
        try:
            return func(self, **kwargs)
        except Exception as e:
            return f"Error executing action: {str(e)}"

    def get_notifications(self, fid: Optional[str] = None, notification_types: Optional[List[str]] = None) -> str:
        """Get notifications for a user."""
        try:
            response = self._make_request("GET", f"notifications?fid={fid or self.fid}")
            if response and "notifications" in response:
                result = []
                
                for notif in response["notifications"]:
                    if notif["type"] == "likes":
                        # Handle likes
                        for reaction in notif["reactions"]:
                            username = reaction["user"].get("username", "unknown")
                            result.append(f"❤️ @{username} liked your cast")
                            
                    elif notif["type"] == "follows":
                        # Handle follows
                        for follow in notif["follows"]:
                            username = follow["user"].get("username", "unknown")
                            result.append(f"👥 @{username} followed you")
                            
                    elif notif["type"] == "reply":
                        # Handle replies
                        username = notif["cast"]["author"].get("username", "unknown")
                        text = notif["cast"].get("text", "")
                        result.append(f"💬 @{username} replied: \"{text}\"")
                        
                    elif notif["type"] == "recasts":
                        # Handle recasts
                        for reaction in notif["reactions"]:
                            username = reaction["user"].get("username", "unknown")
                            result.append(f"🔄 @{username} recasted your cast")

                return "\nRecent Notifications:\n" + "\n".join(result)
            return "No notifications found"

        except Exception as e:
            print(f"Error getting notifications: {str(e)}")
            return f"Failed to get notifications: {str(e)}" 