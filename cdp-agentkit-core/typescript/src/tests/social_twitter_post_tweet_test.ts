import { postTweet, PostTweetInput } from "../actions/cdp/social/twitter/post_tweet";
import { TwitterApi, TwitterApiv2 } from "twitter-api-v2";

const MOCK_TWEET = "@CDPAgentkit please reply!";

describe("Post Tweet Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = { tweet: MOCK_TWEET };
    const result = PostTweetInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail to parse empty input", () => {
    const emptyInput = {};
    const result = PostTweetInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("Required");
  });

  it("should fail to parse invalid input: tweet is too long", () => {
    const invalidInput = { tweet: "A".repeat(281) };
    const result = PostTweetInput.safeParse(invalidInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("Tweet must be a maximum of 280 characters.");
  });
});

describe("Post Tweet Action", () => {
  const mockApiResponse = {
    data: {
      id: "0123456789012345678",
      edit_history_tweet_ids: ["0123456789012345678"],
      text: MOCK_TWEET,
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

  it("should successfully post a tweet", async () => {
    const args = {
      tweet: "Hello, world!",
    };

    const response = await postTweet(mockApi, args);

    expect(mockApi.v2.tweet).toHaveBeenCalledWith(args.tweet);
    expect(response).toContain("Successfully posted to Twitter:");
    expect(response).toContain(JSON.stringify(mockApiResponse));
  });

  it("should handle errors when posting a tweet", async () => {
    const args = {
      tweet: "Hello, world!",
    };

    const error = new Error("An error has occurred");
    mockClient.tweet.mockRejectedValue(error);

    const response = await postTweet(mockApi, { tweet: "Hello, world!" });

    expect(mockApi.v2.tweet).toHaveBeenCalledWith(args.tweet);
    expect(response).toContain("Error posting to Twitter:");
    expect(response).toContain(error.message);
  });
});
