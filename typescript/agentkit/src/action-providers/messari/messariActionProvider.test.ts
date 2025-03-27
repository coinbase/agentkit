import { messariActionProvider, MessariActionProvider } from "./messariActionProvider";
import { API_KEY_MISSING_ERROR } from "./constants";

const MOCK_API_KEY = "messari-test-key";

const MOCK_RESEARCH_RESPONSE = {
  data: {
    messages: [
      {
        role: "assistant",
        content:
          "Ethereum (ETH) has shown strong performance over the past month with a 15% price increase. The current price is approximately $3,500, up from $3,000 at the beginning of the month. Trading volume has also increased by 20% in the same period.",
      },
    ],
  },
};

const MOCK_ERROR_RESPONSE = {
  error: "Internal server error, please try again. If the problem persists, please contact support",
  data: null,
};

describe("MessariActionProvider", () => {
  let provider: MessariActionProvider;

  beforeEach(() => {
    process.env.MESSARI_API_KEY = MOCK_API_KEY;
    provider = messariActionProvider({ apiKey: MOCK_API_KEY });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MESSARI_API_KEY;
  });

  describe("constructor", () => {
    it("should initialize with API key from constructor", () => {
      const customProvider = messariActionProvider({ apiKey: "custom-key" });
      expect(customProvider["apiKey"]).toBe("custom-key");
    });

    it("should initialize with API key from environment variable", () => {
      process.env.MESSARI_API_KEY = "env-key";
      const envProvider = messariActionProvider();
      expect(envProvider["apiKey"]).toBe("env-key");
    });

    it("should throw error if API key is not provided", () => {
      delete process.env.MESSARI_API_KEY;
      expect(() => messariActionProvider()).toThrow(API_KEY_MISSING_ERROR);
    });
  });

  describe("researchQuestion", () => {
    it("should successfully fetch research results", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_RESEARCH_RESPONSE,
      } as Response);

      const question = "What is the current price of Ethereum?";
      const response = await provider.researchQuestion({ question });

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api.messari.io/ai/v1/chat/completions");

      expect(options).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-messari-api-key": MOCK_API_KEY,
          }),
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: question,
              },
            ],
          }),
        }),
      );

      expect(response).toContain("Messari Research Results:");
      expect(response).toContain(MOCK_RESEARCH_RESPONSE.data.messages[0].content);
    });

    it("should handle non-ok response with structured error format", async () => {
      const errorResponseText = JSON.stringify(MOCK_ERROR_RESPONSE);

      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => errorResponseText,
      } as Response);

      const response = await provider.researchQuestion({
        question: "What is the current price of Bitcoin?",
      });

      expect(response).toContain("Messari API Error: Internal server error");
      expect(response).not.toContain("500");
    });

    it("should handle non-ok response with non-JSON error format", async () => {
      const plainTextError = "Rate limit exceeded";

      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => plainTextError,
      } as Response);

      const response = await provider.researchQuestion({
        question: "What is the current price of Bitcoin?",
      });

      expect(response).toContain("Messari API Error:");
      expect(response).toContain("429");
      expect(response).toContain("Too Many Requests");
      expect(response).toContain(plainTextError);
    });

    it("should handle JSON parsing error in successful response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response);

      const response = await provider.researchQuestion({
        question: "What is the market cap of Solana?",
      });

      expect(response).toContain("Unexpected error: Failed to parse API response");
      expect(response).toContain("Invalid JSON");
    });

    it("should handle invalid response format", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ data: { messages: [] } }),
      } as Response);

      const response = await provider.researchQuestion({
        question: "What is the market cap of Solana?",
      });

      expect(response).toContain(
        "Unexpected error: Received invalid response format from Messari API",
      );
    });

    it("should handle fetch error", async () => {
      const error = new Error("Network error");
      jest.spyOn(global, "fetch").mockRejectedValue(error);

      const response = await provider.researchQuestion({
        question: "What is the market cap of Solana?",
      });

      expect(response).toContain("Unexpected error: Network error");
    });

    it("should handle string error with JSON content", async () => {
      const stringifiedError = JSON.stringify(MOCK_ERROR_RESPONSE);
      jest.spyOn(global, "fetch").mockRejectedValue(stringifiedError);

      const response = await provider.researchQuestion({
        question: "What is the market cap of Solana?",
      });

      expect(response).toContain("Messari API Error: Internal server error");
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true as research is network-agnostic", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "unknown" })).toBe(true);
    });
  });
});
