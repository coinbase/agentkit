import {
  accountDetails,
  AccountDetailsInput,
} from "../actions/cdp/social/farcaster/account_details";

describe("Farcaster Account Details Input", () => {
  it("should successfully parse empty input", () => {
    const emptyInput = {};
    const result = AccountDetailsInput.safeParse(emptyInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(emptyInput);
  });
});

describe("Farcaster Account Details Action", () => {
  beforeEach(async () => {
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.NEYNAR_MANAGED_SIGNER = "test-managed-signer";
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env.NEYNAR_API_KEY = "";
    process.env.NEYNAR_MANAGED_SIGNER = "";
  });

  it("should successfully retrieve Farcaster account details", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            users: [
              {
                object: "user",
                fid: 193,
                username: "derek",
                display_name: "derek",
              },
            ],
          }),
      }),
    ) as jest.Mock;

    const args = {};
    const response = await accountDetails(args);
    expect(response).toContain("Successfully retrieved Farcaster account details:");
  });

  it("should handle errors when retrieving Farcaster account details", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("An error has occurred"))) as jest.Mock;

    const args = {};
    const response = await accountDetails(args);
    expect(response).toContain("Error retrieving Farcaster account details:");
  });
});
