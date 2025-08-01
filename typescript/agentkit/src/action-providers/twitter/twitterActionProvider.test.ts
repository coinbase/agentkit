import { TwitterApi, TwitterApiv2, TwitterApiv1 } from "twitter-api-v2";
import { TwitterActionProvider } from "./twitterActionProvider";
import { TweetUserMentionTimelineV2Paginator } from "twitter-api-v2";

const MOCK_CONFIG = {
  apiKey: "test-api-key",
  apiSecret: "test-api-secret",
  accessToken: "test-access-token",
  accessTokenSecret: "test-access-token-secret",
};

const MOCK_ID = "1853889445319331840";
const MOCK_NAME = "CDP Agentkit";
const MOCK_USERNAME = "CDPAgentkit";
const MOCK_TWEET = "Hello, world!";
const MOCK_TWEET_ID = "0123456789012345678";
const MOCK_TWEET_REPLY = "Hello again!";
const MOCK_MEDIA_ID = "987654321";
const MOCK_FILE_PATH = "/path/to/image.jpg";

describe("TwitterActionProvider", () => {
  let mockClient: jest.Mocked<TwitterApiv2>;
  let provider: TwitterActionProvider;
  let mockUploadMedia: jest.Mock;

  beforeEach(() => {
    mockClient = {
      me: jest.fn(),
      userMentionTimeline: jest.fn(),
      tweet: jest.fn(),
    } as unknown as jest.Mocked<TwitterApiv2>;

    mockUploadMedia = jest.fn();

    jest.spyOn(TwitterApi.prototype, "v2", "get").mockReturnValue(mockClient);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(TwitterApi.prototype, "v1", "get").mockReturnValue({
      uploadMedia: mockUploadMedia,
    } as unknown as TwitterApiv1);

    provider = new TwitterActionProvider(MOCK_CONFIG);
  });

  describe("Constructor", () => {
    it("should initialize with config values", () => {
      expect(() => new TwitterActionProvider(MOCK_CONFIG)).not.toThrow();
    });

    it("should initialize with environment variables", () => {
      process.env.TWITTER_API_KEY = MOCK_CONFIG.apiKey;
      process.env.TWITTER_API_SECRET = MOCK_CONFIG.apiSecret;
      process.env.TWITTER_ACCESS_TOKEN = MOCK_CONFIG.accessToken;
      process.env.TWITTER_ACCESS_TOKEN_SECRET = MOCK_CONFIG.accessTokenSecret;

      expect(() => new TwitterActionProvider()).not.toThrow();
    });

    it("should throw error if no config or env vars", () => {
      delete process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_SECRET;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.TWITTER_ACCESS_TOKEN_SECRET;

      expect(() => new TwitterActionProvider()).toThrow("TWITTER_API_KEY is not configured.");
    });

    it("should implement lazy initialization", async () => {
      // We'll check lazy initialization by observing that we can create an instance
      // without error, and then use it to call methods successfully
      const provider = new TwitterActionProvider(MOCK_CONFIG);

      // Mock a response for accountDetails
      mockClient.me.mockResolvedValue({
        data: {
          id: MOCK_ID,
          name: MOCK_NAME,
          username: MOCK_USERNAME,
        },
      });

      // Call a method that should trigger initialization
      const response = await provider.accountDetails({});

      // Verify the method worked, which means initialization succeeded
      expect(response).toContain("Successfully retrieved authenticated user account details");
      expect(mockClient.me).toHaveBeenCalled();
    });
  });

  describe("Account Details Action", () => {
    const mockResponse = {
      data: {
        id: MOCK_ID,
        name: MOCK_NAME,
        username: MOCK_USERNAME,
      },
    };

    beforeEach(() => {
      mockClient.me.mockResolvedValue(mockResponse);
    });

    it("should successfully retrieve account details", async () => {
      const response = await provider.accountDetails({});

      expect(mockClient.me).toHaveBeenCalled();
      expect(response).toContain("Successfully retrieved authenticated user account details");
      expect(response).toContain(
        JSON.stringify({
          ...mockResponse,
          data: { ...mockResponse.data, url: `https://x.com/${MOCK_USERNAME}` },
        }),
      );
    });

    it("should handle errors when retrieving account details", async () => {
      const error = new Error("An error has occurred");
      mockClient.me.mockRejectedValue(error);

      const response = await provider.accountDetails({});

      expect(mockClient.me).toHaveBeenCalled();
      expect(response).toContain("Error retrieving authenticated user account details");
      expect(response).toContain(error.message);
    });
  });

  describe("Account Mentions Action", () => {
    const mockResponse = {
      _realData: {
        data: [
          {
            id: MOCK_TWEET_ID,
            text: "@CDPAgentkit please reply!",
          },
        ],
      },
      data: [
        {
          id: MOCK_TWEET_ID,
          text: "@CDPAgentkit please reply!",
        },
      ],
      meta: {},
      _endpoint: {},
      tweets: [],
      getItemArray: () => [],
      refreshInstanceFromResult: () => mockResponse,
    } as unknown as TweetUserMentionTimelineV2Paginator;

    beforeEach(() => {
      mockClient.userMentionTimeline.mockResolvedValue(mockResponse);
    });

    it("should successfully retrieve account mentions", async () => {
      const response = await provider.accountMentions({ userId: MOCK_ID });

      expect(mockClient.userMentionTimeline).toHaveBeenCalledWith(MOCK_ID);
      expect(response).toContain("Successfully retrieved account mentions");
      expect(response).toContain(JSON.stringify(mockResponse));
    });

    it("should handle errors when retrieving mentions", async () => {
      const error = new Error("An error has occurred");
      mockClient.userMentionTimeline.mockRejectedValue(error);

      const response = await provider.accountMentions({ userId: MOCK_ID });

      expect(mockClient.userMentionTimeline).toHaveBeenCalledWith(MOCK_ID);
      expect(response).toContain("Error retrieving authenticated account mentions");
      expect(response).toContain(error.message);
    });
  });

  describe("Post Tweet Action", () => {
    const mockResponse = {
      data: {
        id: MOCK_TWEET_ID,
        text: MOCK_TWEET,
        edit_history_tweet_ids: [MOCK_TWEET_ID],
      },
    };

    beforeEach(() => {
      mockClient.tweet.mockResolvedValue(mockResponse);
    });

    it("should successfully post a tweet", async () => {
      const response = await provider.postTweet({ tweet: MOCK_TWEET });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET, {});
      expect(response).toContain("Successfully posted to Twitter");
      expect(response).toContain(JSON.stringify(mockResponse));
    });

    it("should successfully post a tweet with media", async () => {
      const mediaIds = [MOCK_MEDIA_ID] as [string];
      const response = await provider.postTweet({ tweet: MOCK_TWEET, mediaIds });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET, {
        media: { media_ids: mediaIds },
      });
      expect(response).toContain("Successfully posted to Twitter");
      expect(response).toContain(JSON.stringify(mockResponse));
    });

    it("should handle errors when posting a tweet", async () => {
      const error = new Error("An error has occurred");
      mockClient.tweet.mockRejectedValue(error);

      const response = await provider.postTweet({ tweet: MOCK_TWEET });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET, {});
      expect(response).toContain("Error posting to Twitter");
      expect(response).toContain(error.message);
    });
  });

  describe("Post Tweet Reply Action", () => {
    const mockResponse = {
      data: {
        id: MOCK_TWEET_ID,
        text: MOCK_TWEET_REPLY,
        edit_history_tweet_ids: [MOCK_TWEET_ID],
      },
    };

    beforeEach(() => {
      mockClient.tweet.mockResolvedValue(mockResponse);
    });

    it("should successfully post a tweet reply", async () => {
      const response = await provider.postTweetReply({
        tweetId: MOCK_TWEET_ID,
        tweetReply: MOCK_TWEET_REPLY,
      });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET_REPLY, {
        reply: { in_reply_to_tweet_id: MOCK_TWEET_ID },
      });
      expect(response).toContain("Successfully posted reply to Twitter");
      expect(response).toContain(JSON.stringify(mockResponse));
    });

    it("should successfully post a tweet reply with media", async () => {
      const mediaIds = [MOCK_MEDIA_ID] as [string];
      const response = await provider.postTweetReply({
        tweetId: MOCK_TWEET_ID,
        tweetReply: MOCK_TWEET_REPLY,
        mediaIds,
      });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET_REPLY, {
        reply: { in_reply_to_tweet_id: MOCK_TWEET_ID },
        media: { media_ids: mediaIds },
      });
      expect(response).toContain("Successfully posted reply to Twitter");
      expect(response).toContain(JSON.stringify(mockResponse));
    });

    it("should handle errors when posting a tweet reply", async () => {
      const error = new Error("An error has occurred");
      mockClient.tweet.mockRejectedValue(error);

      const response = await provider.postTweetReply({
        tweetId: MOCK_TWEET_ID,
        tweetReply: MOCK_TWEET_REPLY,
      });

      expect(mockClient.tweet).toHaveBeenCalledWith(MOCK_TWEET_REPLY, {
        reply: { in_reply_to_tweet_id: MOCK_TWEET_ID },
      });
      expect(response).toContain("Error posting reply to Twitter");
      expect(response).toContain(error.message);
    });
  });

  describe("Upload Media Action", () => {
    beforeEach(() => {
      mockUploadMedia.mockResolvedValue(MOCK_MEDIA_ID);
    });

    it("should successfully upload media", async () => {
      const response = await provider.uploadMedia({ filePath: MOCK_FILE_PATH });

      expect(mockUploadMedia).toHaveBeenCalledWith(MOCK_FILE_PATH);
      expect(response).toContain("Successfully uploaded media to Twitter");
      expect(response).toContain(MOCK_MEDIA_ID);
    });

    it("should handle errors when uploading media", async () => {
      const error = new Error("Invalid file format");
      mockUploadMedia.mockRejectedValue(error);

      const response = await provider.uploadMedia({ filePath: MOCK_FILE_PATH });

      expect(mockUploadMedia).toHaveBeenCalledWith(MOCK_FILE_PATH);
      expect(response).toContain("Error uploading media to Twitter");
      expect(response).toContain(error.message);
    });
  });

  describe("Network Support", () => {
    it("should always return true for network support", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "1" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana", networkId: "2" })).toBe(true);
    });
  });

  describe("Next.js Integration", () => {
    it("should work in a simulated Next.js environment", async () => {
      // Create a clean instance of the provider
      const provider = new TwitterActionProvider(MOCK_CONFIG);

      // Mock v2.me to test functionality
      const mockResponse = {
        data: {
          id: MOCK_ID,
          name: MOCK_NAME,
          username: MOCK_USERNAME,
        },
      };

      const mockTwitterApi = {
        v2: {
          me: jest.fn().mockResolvedValue(mockResponse),
        },
      };

      // Override the getClient method to return our mocked API
      jest
        .spyOn(provider as unknown as { getClient(): TwitterApi }, "getClient")
        .mockReturnValue(mockTwitterApi as unknown as TwitterApi);

      // Simulate a Next.js API route calling the provider
      const result = await provider.accountDetails({});

      expect(result).toContain("Successfully retrieved authenticated user account details");
      expect(mockTwitterApi.v2.me).toHaveBeenCalled();
    });
  });
});
