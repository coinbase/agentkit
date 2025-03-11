import { messariActionProvider, MessariActionProvider } from "./messariActionProvider";

const MOCK_API_KEY = "messari-test-key";

// Sample response for the research question action
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
      expect(() => messariActionProvider()).toThrow("MESSARI_API_KEY is not configured.");
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

      // Verify the API was called with the correct parameters
      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];

      // Check URL
      expect(url).toBe("https://api.messari.io/ai/v1/chat/completions");

      // Check request options
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

      // Check response formatting
      expect(response).toContain("Messari Research Results:");
      expect(response).toContain(MOCK_RESEARCH_RESPONSE.data.messages[0].content);
    });

    it("should handle non-ok response", async () => {
      const statusText = "Too Many Requests";
      const responseText = "Rate limit exceeded";

      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        statusText,
        text: async () => responseText,
      } as Response);

      const response = await provider.researchQuestion({
        question: "What is the current price of Bitcoin?",
      });

      expect(response).toContain("Error querying Messari AI");
      expect(response).toContain("429");
      expect(response).toContain(statusText);
      expect(response).toContain(responseText);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Network error");
      jest.spyOn(global, "fetch").mockRejectedValue(error);

      const response = await provider.researchQuestion({
        question: "What is the market cap of Solana?",
      });

      expect(response).toContain("Error querying Messari AI");
      expect(response).toContain(error.message);
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
