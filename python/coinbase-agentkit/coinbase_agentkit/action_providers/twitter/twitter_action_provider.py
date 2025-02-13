"""Twitter action provider."""

import os
from json import dumps
from typing import Any

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    AccountDetailsSchema,
    AccountMentionsSchema,
    PostTweetReplySchema,
    PostTweetSchema,
)


class TwitterActionProvider(ActionProvider):
    """Provides actions for interacting with Twitter."""

    def __init__(
        self,
        api_key: str | None = None,
        api_secret: str | None = None,
        access_token: str | None = None,
        access_token_secret: str | None = None,
        bearer_token: str | None = None,
    ):
        super().__init__("twitter", [])

        api_key = api_key or os.getenv("TWITTER_API_KEY")
        api_secret = api_secret or os.getenv("TWITTER_API_SECRET")
        access_token = access_token or os.getenv("TWITTER_ACCESS_TOKEN")
        access_token_secret = access_token_secret or os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
        bearer_token = bearer_token or os.getenv("TWITTER_BEARER_TOKEN")

        if not api_key:
            raise ValueError("TWITTER_API_KEY is not configured.")
        if not api_secret:
            raise ValueError("TWITTER_API_SECRET is not configured.")
        if not access_token:
            raise ValueError("TWITTER_ACCESS_TOKEN is not configured.")
        if not access_token_secret:
            raise ValueError("TWITTER_ACCESS_TOKEN_SECRET is not configured.")
        if not bearer_token:
            raise ValueError("TWITTER_BEARER_TOKEN is not configured.")

        try:
            import tweepy

            self.client = tweepy.Client(
                consumer_key=api_key,
                consumer_secret=api_secret,
                access_token=access_token,
                access_token_secret=access_token_secret,
                bearer_token=bearer_token,
                return_type=dict,
            )
        except ImportError as e:
            raise ImportError(
                "Failed to import tweepy. Please install it with 'pip install tweepy'."
            ) from e
        except Exception as e:
            raise ValueError(f"Failed to initialize Twitter client: {e}") from e

    @create_action(
        name="account_details",
        description="""
This tool will return account details for the currently authenticated Twitter (X) user context.

A successful response will return a message with the api response as a json payload:
    {"data": {"id": "1853889445319331840", "name": "CDP AgentKit", "username": "CDPAgentKit"}}

A failure response will return a message with a Twitter API request error:
    Error retrieving authenticated user account: 429 Too Many Requests""",
        schema=AccountDetailsSchema,
    )
    def account_details(self, args: dict[str, Any]) -> str:
        """Get the authenticated Twitter user account details.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the action response or error details.

        """
        AccountDetailsSchema(**args)

        import tweepy

        try:
            response = self.client.get_me()
            data = response["data"]
            data["url"] = f"https://x.com/{data['username']}"

            return f"Successfully retrieved authenticated user account details:\n{dumps(response)}"
        except tweepy.errors.TweepyException as e:
            return f"Error retrieving authenticated user account details:\n{e}"

    @create_action(
        name="account_mentions",
        description="""
This tool will return mentions for the specified Twitter (X) user id.

A successful response will return a message with the API response as a JSON payload:
    {"data": [{"id": "1857479287504584856", "text": "@CDPAgentKit reply"}]}

A failure response will return a message with the Twitter API request error:
    Error retrieving user mentions: 429 Too Many Requests""",
        schema=AccountMentionsSchema,
    )
    def account_mentions(self, args: dict[str, Any]) -> str:
        """Get mentions for a specified Twitter user.

        Args:
            args (dict[str, Any]): Arguments containing user_id to get mentions for.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = AccountMentionsSchema(**args)

        import tweepy

        try:
            response = self.client.get_users_mentions(validated_args.user_id)
            return f"Successfully retrieved account mentions:\n{dumps(response)}"
        except tweepy.errors.TweepyException as e:
            return f"Error retrieving authenticated account mentions:\n{e}"

    @create_action(
        name="post_tweet",
        description="""
This tool will post a tweet on Twitter. The tool takes the text of the tweet as input. Tweets can be maximum 280 characters.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"text": "hello, world!", "id": "0123456789012345678", "edit_history_tweet_ids": ["0123456789012345678"]}}

A failure response will return a message with the Twitter API request error:
    You are not allowed to create a Tweet with duplicate content.""",
        schema=PostTweetSchema,
    )
    def post_tweet(self, args: dict[str, Any]) -> str:
        """Post a tweet on Twitter.

        Args:
            args (dict[str, Any]): Arguments containing tweet text to post.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = PostTweetSchema(**args)

        import tweepy

        try:
            response = self.client.create_tweet(text=validated_args.tweet)
            return f"Successfully posted to Twitter:\n{dumps(response)}"
        except tweepy.errors.TweepyException as e:
            return f"Error posting to Twitter:\n{e}"

    @create_action(
        name="post_tweet_reply",
        description="""
This tool will post a tweet on Twitter. The tool takes the text of the tweet as input. Tweets can be maximum 280 characters.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"text": "hello, world!", "id": "0123456789012345678", "edit_history_tweet_ids": ["0123456789012345678"]}}

A failure response will return a message with the Twitter API request error:
    You are not allowed to create a Tweet with duplicate content.""",
        schema=PostTweetReplySchema,
    )
    def post_tweet_reply(self, args: dict[str, Any]) -> str:
        """Post a reply to a tweet on Twitter.

        Args:
            args (dict[str, Any]): Arguments containing tweet_reply text and tweet_id to reply to.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = PostTweetReplySchema(**args)

        import tweepy

        try:
            response = self.client.create_tweet(
                text=validated_args.tweet_reply, in_reply_to_tweet_id=validated_args.tweet_id
            )
            return f"Successfully posted reply to Twitter:\n{dumps(response)}"
        except tweepy.errors.TweepyException as e:
            return f"Error posting reply to Twitter:\n{e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Twitter actions.

        Returns:
            bool: Always True as Twitter actions don't depend on blockchain networks.

        """
        return True


def twitter_action_provider(
    api_key: str | None = None,
    api_secret: str | None = None,
    access_token: str | None = None,
    access_token_secret: str | None = None,
    bearer_token: str | None = None,
) -> TwitterActionProvider:
    """Create and return a new TwitterActionProvider instance."""
    return TwitterActionProvider(
        api_key=api_key,
        api_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_token_secret,
        bearer_token=bearer_token,
    )
