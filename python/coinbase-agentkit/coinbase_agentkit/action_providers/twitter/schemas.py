"""Schemas for Twitter action provider."""

from pydantic import BaseModel, Field


class AccountDetailsSchema(BaseModel):
    """Input argument schema for Twitter account details action."""

    pass


class AccountMentionsSchema(BaseModel):
    """Input argument schema for Twitter account mentions action."""

    user_id: str = Field(..., description="The Twitter user ID to fetch mentions for")


class PostTweetSchema(BaseModel):
    """Input argument schema for posting a tweet."""

    tweet: str = Field(..., description="The text content of the tweet (max 280 characters)")


class PostTweetReplySchema(BaseModel):
    """Input argument schema for posting a tweet reply."""

    tweet_reply: str = Field(
        ..., description="The text content of the reply tweet (max 280 characters)"
    )
    tweet_id: str = Field(..., description="The ID of the tweet to reply to")
