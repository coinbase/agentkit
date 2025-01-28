import { accountDetails, AccountDetailsInput } from "../actions/cdp/social/twitter/account_details";
import { TwitterApi, TwitterApiv2 } from "twitter-api-v2";

const MOCK_ID = "1853889445319331840";
const MOCK_NAME = "CDP Agentkit";
const MOCK_USERNAME = "CDPAgentkit";

describe("Twitter (X) Account Details Input", () => {
  it("should successfully parse empty input", () => {
    const emptyInput = {};
    const result = AccountDetailsInput.safeParse(emptyInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(emptyInput);
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

  let mockApi: jest.Mocked<TwitterApi>;
  let mockClient: jest.Mocked<TwitterApiv2>;

  beforeEach(() => {
    mockClient = {
      me: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as jest.Mocked<TwitterApiv2>;

    mockApi = {
      get v2() {
        return mockClient;
      },
    } as unknown as jest.Mocked<TwitterApi>;
  });

  it("should successfully retrieve account details", async () => {
    const args = {};
    const response = await accountDetails(mockApi, args);

    expect(mockApi.v2.me).toHaveBeenCalled();
    expect(response).toContain("Successfully retrieved authenticated user account details");
    expect(response).toContain(JSON.stringify(mockResponse));
  });

  it("should handle errors when retrieving account details", async () => {
    const args = {};

    const error = new Error("An error has occurred");
    mockApi.v2.me = jest.fn().mockRejectedValue(error);

    const response = await accountDetails(mockApi, args);

    expect(mockApi.v2.me).toHaveBeenCalled();
    expect(response).toContain("Error retrieving authenticated user account details");
    expect(response).toContain(error.message);
  });
});
