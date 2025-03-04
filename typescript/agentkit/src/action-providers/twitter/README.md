# Twitter Action Provider

This directory contains the **TwitterActionProvider** implementation, which provides actions to interact with the **Twitter API** for social media operations.

## Directory Structure

```
twitter/
├── twitterActionProvider.ts         # Main provider with Twitter functionality
├── twitterActionProvider.test.ts    # Test file for Twitter provider
├── schemas.ts                       # Twitter action schemas
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

- `account_details`: Get account details for the currently authenticated Twitter (X) user
- `account_mentions`: Get mentions for a specified Twitter (X) user
- `post_tweet`: Post a new tweet
- `post_tweet_reply`: Reply to a tweet

## Adding New Actions

To add new Twitter actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `twitterActionProvider.ts`
3. Add tests in `twitterActionProvider.test.ts`

## Network Support

The Twitter provider is network-agnostic.

## Notes

- Requires Twitter API credentials

For more information on the **Twitter API**, and to get API credentials, visit [Twitter API Documentation](https://developer.twitter.com/en/docs/twitter-api).
