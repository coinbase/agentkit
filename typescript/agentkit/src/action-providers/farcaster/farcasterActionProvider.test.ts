import { FarcasterActionProvider } from "./farcasterActionProvider";
import {
  FarcasterAccountDetailsSchema,
  FarcasterPostCastSchema,
  FarcasterGetUserDetailsSchema,
  FarcasterReplyCastSchema,
  FarcasterGetFeedSchema,
  FarcasterGetMentionsSchema,
} from "./schemas";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Farcaster Action Provider Input Schemas", () => {
  describe("Account Details Schema", () => {
    it("should successfully parse empty input", () => {
      const validInput = {};
      const result = FarcasterAccountDetailsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });
  });

  describe("Post Cast Schema", () => {
    it("should successfully parse valid cast text", () => {
      const validInput = {
        castText: "Hello, Farcaster!",
      };
      const result = FarcasterPostCastSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse valid cast text with embeds", () => {
      const validInput = {
        castText: "Hello, Farcaster!",
        embeds: [{ url: "https://example.com" }],
      };
      const result = FarcasterPostCastSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail when embed URL is invalid", () => {
      const invalidInput = {
        castText: "Hello, Farcaster!",
        embeds: [{ url: "invalid-url" }],
      };
      const result = FarcasterPostCastSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail when there are more than 2 embeds", () => {
      const invalidInput = {
        castText: "Hello, Farcaster!",
        embeds: [
          { url: "https://example1.com" },
          { url: "https://example2.com" },
          { url: "https://example3.com" },
        ],
      };
      const result = FarcasterPostCastSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing cast text over 280 characters", () => {
      const invalidInput = {
        castText: "a".repeat(281),
      };
      const result = FarcasterPostCastSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Farcaster Action Provider", () => {
  const mockConfig = {
    neynarApiKey: "test-api-key",
    signerUuid: "test-signer-uuid",
    agentFid: "193",
  };

  let actionProvider: FarcasterActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    actionProvider = new FarcasterActionProvider(mockConfig);
  });

  describe("accountDetails", () => {
    const mockUserResponse = {
      users: [
        {
          object: "user",
          fid: 193,
          username: "derek",
          display_name: "Derek",
        },
      ],
    };

    it("should successfully retrieve Farcaster account details", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockUserResponse),
      });

      const result = await actionProvider.accountDetails({});

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${mockConfig.agentFid}`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "x-api-key": mockConfig.neynarApiKey,
            "x-neynar-experimental": "true",
          },
        },
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toContain("Successfully retrieved Farcaster account details");
      expect(result).toContain(JSON.stringify(mockUserResponse.users[0]));
    });

    it("should handle errors when retrieving account details", async () => {
      const error = new Error("API request failed");
      mockFetch.mockRejectedValueOnce(error);

      const result = await actionProvider.accountDetails({});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe(`Error retrieving Farcaster account details:\n${error}`);
    });
  });

  describe("postCast", () => {
    const mockCastResponse = {
      hash: "0x123",
    };

    it("should successfully post a cast", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockCastResponse),
      });

      const args = {
        castText: "Hello, Farcaster!",
      };

      const result = await actionProvider.postCast(args);

      expect(mockFetch).toHaveBeenCalledWith("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers: {
          api_key: mockConfig.neynarApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signer_uuid: mockConfig.signerUuid,
          text: args.castText,
          embeds: undefined,
        }),
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toContain("Successfully posted cast to Farcaster");
      expect(result).toContain(JSON.stringify(mockCastResponse));
    });

    it("should successfully post a cast with embeds", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockCastResponse),
      });

      const args = {
        castText: "Hello, Farcaster!",
        embeds: [{ url: "https://example.com" }],
      };

      const result = await actionProvider.postCast(args);

      expect(mockFetch).toHaveBeenCalledWith("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers: {
          api_key: mockConfig.neynarApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signer_uuid: mockConfig.signerUuid,
          text: args.castText,
          embeds: args.embeds,
        }),
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toContain("Successfully posted cast to Farcaster");
      expect(result).toContain(JSON.stringify(mockCastResponse));
    });

    it("should handle errors when posting cast", async () => {
      const error = new Error("Failed to post cast");
      mockFetch.mockRejectedValueOnce(error);

      const args = {
        castText: "Hello, Farcaster!",
      };

      const result = await actionProvider.postCast(args);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe(`Error posting to Farcaster:\n${error}`);
    });
  });

  describe("constructor", () => {
    it("should use environment variables when config is not provided", () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        NEYNAR_API_KEY: "env-api-key",
        NEYNAR_MANAGER_SIGNER: "env-signer-uuid",
        AGENT_FID: "env-agent-fid",
      };

      const provider = new FarcasterActionProvider();
      expect(provider).toBeDefined();

      process.env = originalEnv;
    });

    it("should throw error when required config is missing", () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.NEYNAR_API_KEY;
      delete process.env.NEYNAR_MANAGER_SIGNER;
      delete process.env.AGENT_FID;

      expect(() => new FarcasterActionProvider()).toThrow();

      process.env = originalEnv;
    });
  });

  describe("supportsNetwork", () => {
    it("should return true when protocolFamily is evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false when protocolFamily is not evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });

  describe("getUserDetails", () => {
    const mockUserResponse = {
      users: [
        {
          object: "user",
          fid: 123,
          username: "testuser",
          display_name: "Test User",
        },
      ],
    };

    it("should successfully retrieve user details by FID", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockUserResponse),
      });

      const result = await actionProvider.getUserDetails({ fid: 123 });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.neynar.com/v2/farcaster/user/bulk?fids=123",
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toContain("Successfully retrieved Farcaster user details");
    });

    it("should successfully retrieve user details by username", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ user: mockUserResponse.users[0] }),
      });

      const result = await actionProvider.getUserDetails({ username: "testuser" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.neynar.com/v2/farcaster/user/by_username?username=testuser",
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toContain("Successfully retrieved Farcaster user details");
    });

    it("should handle user not found", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ users: [] }),
      });

      const result = await actionProvider.getUserDetails({ fid: 99999 });

      expect(result).toContain("User not found");
    });
  });

  describe("replyToCast", () => {
    const mockReplyResponse = {
      cast: {
        hash: "0x456",
        text: "This is a reply",
      },
    };

    it("should successfully reply to a cast", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockReplyResponse),
      });

      const args = {
        parentHash: "0x123",
        replyText: "This is a reply",
      };

      const result = await actionProvider.replyToCast(args);

      expect(mockFetch).toHaveBeenCalledWith("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers: {
          api_key: mockConfig.neynarApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signer_uuid: mockConfig.signerUuid,
          text: args.replyText,
          parent: args.parentHash,
          embeds: undefined,
        }),
      });
      expect(result).toContain("Successfully posted reply to Farcaster");
    });

    it("should handle errors when replying", async () => {
      const error = new Error("Failed to reply");
      mockFetch.mockRejectedValueOnce(error);

      const args = {
        parentHash: "0x123",
        replyText: "This is a reply",
      };

      const result = await actionProvider.replyToCast(args);

      expect(result).toBe(`Error posting reply to Farcaster:\n${error}`);
    });
  });

  describe("getFeed", () => {
    const mockFeedResponse = {
      casts: [
        { hash: "0x1", text: "Cast 1" },
        { hash: "0x2", text: "Cast 2" },
      ],
    };

    it("should successfully retrieve feed for agent", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockFeedResponse),
      });

      const result = await actionProvider.getFeed({ limit: 10, includeReplies: false });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${mockConfig.agentFid}&limit=10&include_replies=false`,
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toContain("Successfully retrieved Farcaster feed");
      expect(result).toContain("2 casts");
    });

    it("should retrieve feed for specified FID", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockFeedResponse),
      });

      const result = await actionProvider.getFeed({ fid: 456, limit: 25, includeReplies: true });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.neynar.com/v2/farcaster/feed/user/casts?fid=456&limit=25&include_replies=true",
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toContain("Successfully retrieved Farcaster feed");
    });
  });

  describe("getMentions", () => {
    const mockMentionsResponse = {
      notifications: [
        { cast: { hash: "0x1", text: "Hey @agent" } },
        { cast: { hash: "0x2", text: "Hello @agent" } },
      ],
    };

    it("should successfully retrieve mentions", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockMentionsResponse),
      });

      const result = await actionProvider.getMentions({ limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.neynar.com/v2/farcaster/notifications?fid=${mockConfig.agentFid}&type=mentions&limit=10`,
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toContain("Successfully retrieved Farcaster mentions");
      expect(result).toContain("2 mentions");
    });

    it("should handle errors when retrieving mentions", async () => {
      const error = new Error("Failed to get mentions");
      mockFetch.mockRejectedValueOnce(error);

      const result = await actionProvider.getMentions({ limit: 25 });

      expect(result).toBe(`Error retrieving Farcaster mentions:\n${error}`);
    });
  });
});

describe("New Farcaster Schema Tests", () => {
  describe("GetUserDetails Schema", () => {
    it("should accept username", () => {
      const result = FarcasterGetUserDetailsSchema.safeParse({ username: "testuser" });
      expect(result.success).toBe(true);
    });

    it("should accept fid", () => {
      const result = FarcasterGetUserDetailsSchema.safeParse({ fid: 123 });
      expect(result.success).toBe(true);
    });

    it("should reject when neither username nor fid provided", () => {
      const result = FarcasterGetUserDetailsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("ReplyCast Schema", () => {
    it("should accept valid reply", () => {
      const result = FarcasterReplyCastSchema.safeParse({
        parentHash: "0x123",
        replyText: "This is a reply",
      });
      expect(result.success).toBe(true);
    });

    it("should reject reply over 280 characters", () => {
      const result = FarcasterReplyCastSchema.safeParse({
        parentHash: "0x123",
        replyText: "a".repeat(281),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetFeed Schema", () => {
    it("should accept valid feed request", () => {
      const result = FarcasterGetFeedSchema.safeParse({
        limit: 25,
        includeReplies: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject limit over 100", () => {
      const result = FarcasterGetFeedSchema.safeParse({
        limit: 101,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetMentions Schema", () => {
    it("should accept valid mentions request", () => {
      const result = FarcasterGetMentionsSchema.safeParse({
        limit: 25,
      });
      expect(result.success).toBe(true);
    });
  });
});
