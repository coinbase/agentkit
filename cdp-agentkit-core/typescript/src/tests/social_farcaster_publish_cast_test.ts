import { publishCast, PublishCastInput } from "../actions/cdp/social/farcaster/publish_cast";

const MOCK_CAST = "Hello from AgentKit, @CoinbaseDev!";

describe("Publish Cast Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = { castText: MOCK_CAST };
    const result = PublishCastInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail to parse empty input", () => {
    const emptyInput = {};
    const result = PublishCastInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("Required");
  });

  it("should fail to parse invalid input: cast is too long", () => {
    const invalidInput = { castText: "A".repeat(281) };
    const result = PublishCastInput.safeParse(invalidInput);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("Cast text must be a maximum of 280 characters.");
  });
});

describe("Publish Cast Action", () => {
  beforeEach(async () => {
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.NEYNAR_MANAGED_SIGNER = "test-managed-signer";
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env.NEYNAR_API_KEY = "";
    process.env.NEYNAR_MANAGED_SIGNER = "";
  });

  it("should successfully publish a cast", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ hash: "0x123" }) }),
    ) as jest.Mock;

    const args = {
      castText: "Hello, world!",
    };
    const response = await publishCast(args);
    expect(response).toContain("Successfully published cast to Farcaster:");
  });

  it("should handle errors when publishing a cast", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("An error has occurred"))) as jest.Mock;

    const args = {
      castText: "Hello, world!",
    };
    const response = await publishCast(args);

    expect(response).toContain("Error publishing to Farcaster:");
  });
});
