# Twitter Action Provider

This directory contains the **TwitterActionProvider** implementation, which provides actions to interact with the **Twitter API** for social media operations.

## Directory Structure

```
twitter/
├── twitter_action_provider.py    # Twitter action provider
├── schemas.py                    # Twitter action schemas
├── __init__.py                   # Main exports
└── README.md                     # This file

# From python/coinbase-agentkit/
tests/action_providers/twitter/
├── conftest.py                    # Test configuration
├── test_account_details.py                    # Test configuration
├── test_account_mentions.py                    # Test configuration
├── test_action_provider.py                    # Test configuration
├── test_post_tweet_reply.py                    # Test configuration
└── test_post_tweet.py                    # Test configuration
```

## Actions

- `account_details`: Get the authenticated Twitter (X) user account details
- `account_mentions`: Get mentions for a specified Twitter (X) user
- `post_tweet`: Post a new tweet
- `post_tweet_reply`: Post a reply to a tweet

## Adding New Actions

To add new Twitter actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `twitter_action_provider.py`
3. Implement tests in a new file in `tests/action_providers/twitter/`

## Network Support

The Twitter provider is network-agnostic.

## Notes

- Requires Twitter API credentials

For more information on the **Twitter API**, and to get API credentials, visit [Twitter API Documentation](https://developer.twitter.com/en/docs/twitter-api).
