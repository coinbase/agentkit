import { postTweet, PostTweetReplyInput } from "../actions/cdp/social/twitter/post_tweet_reply";
import { TwitterApi, TwitterApiv2 } from "twitter-api-v2";

const MOCK_TWEET_ID = "0123456789012345678";
const MOCK_TWEET_REPLY = "hello, world, again!";

describe("Post Tweet Reply Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = { tweetId: MOCK_TWEET_ID, tweetReply: MOCK_TWEET_REPLY };
    const result = PostTweetReplyInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail to parse empty input", () => {
    const emptyInput = {};
    const result = PostTweetReplyInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("Required");
  });

  it("should fail to parse invalid input: tweet is too long", () => {
    const invalidInput = { tweetId: MOCK_TWEET_ID, tweetReply: "A".repeat(281) };
    const result = PostTweetReplyInput.safeParse(invalidInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      "The reply to the tweet which must be a maximum of 280 characters.",
    );
  });
});

describe("Post Tweet Reply Action", () => {
  const mockApiResponse = {
    data: {
      id: "9123456789012345678",
      edit_history_tweet_ids: ["9123456789012345678"],
      text: MOCK_TWEET_REPLY,
    },
  };

  let mockApi: jest.Mocked<TwitterApi>;
  let mockClient: jest.Mocked<TwitterApiv2>;

  beforeEach(() => {
    mockClient = {
      tweet: jest.fn().mockResolvedValue(mockApiResponse),
    } as unknown as jest.Mocked<TwitterApiv2>;

    mockApi = {
      get v2() {
        return mockClient;
      },
    } as unknown as jest.Mocked<TwitterApi>;
  });

  it("should successfully post a reply", async () => {
    const args = {
      tweetId: MOCK_TWEET_ID,
      tweetReply: MOCK_TWEET_REPLY,
    };

    const response = await postTweet(mockApi, args);

    expect(mockApi.v2.tweet).toHaveBeenCalledWith(MOCK_TWEET_REPLY, {
      reply: { in_reply_to_tweet_id: MOCK_TWEET_ID },
    });
    expect(response).toContain("Successfully posted reply to Twitter:");
    expect(response).toContain(JSON.stringify(mockApiResponse));
  });

  it("should handle errors when posting a reply", async () => {
    const args = {
      tweetId: MOCK_TWEET_ID,
      tweetReply: MOCK_TWEET_REPLY,
    };

    const error = new Error("An error has occurred");
    mockClient.tweet.mockRejectedValue(error);

    const response = await postTweet(mockApi, args);

    expect(mockApi.v2.tweet).toHaveBeenCalledWith(MOCK_TWEET_REPLY, {
      reply: { in_reply_to_tweet_id: MOCK_TWEET_ID },
    });
    expect(response).toContain("Error posting reply to Twitter:");
    expect(response).toContain(error.message);
  });
});
