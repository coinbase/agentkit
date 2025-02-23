import { FarcasterActionProvider } from "./farcasterActionProvider";
import { FarcasterAccountDetailsSchema, FarcasterPostCastSchema } from "./schemas";

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
});
