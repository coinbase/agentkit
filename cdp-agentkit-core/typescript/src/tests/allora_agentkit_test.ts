import { AlloraAPIClient, ChainSlug } from "@alloralabs/allora-sdk";
import { AlloraAgentkit } from "../allora_agentkit";

jest.mock("@alloralabs/allora-sdk");

describe("AlloraAgentkit", () => {
  describe("initialization", () => {
    beforeEach(() => {
      process.env.ALLORA_API_KEY = "test-api-key";
      process.env.ALLORA_BASE_API_URL = "https://test.api.url";
      process.env.ALLORA_CHAIN_SLUG = ChainSlug.TESTNET;
    });

    afterEach(() => {
      jest.resetAllMocks();
      process.env.ALLORA_API_KEY = "";
      process.env.ALLORA_BASE_API_URL = "";
      process.env.ALLORA_CHAIN_SLUG = "";
    });

    it("should successfully init with env variables", () => {
      const agentkit = new AlloraAgentkit();
      expect(agentkit).toBeDefined();
      expect(AlloraAPIClient).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        baseAPIUrl: "https://test.api.url",
        chainSlug: ChainSlug.TESTNET,
      });
    });

    it("should successfully init with options overriding env", () => {
      const options = {
        apiKey: "custom-api-key",
        baseAPIUrl: "https://custom.api.url",
        chainSlug: ChainSlug.MAINNET,
      };

      const agentkit = new AlloraAgentkit(options);
      expect(agentkit).toBeDefined();
      expect(AlloraAPIClient).toHaveBeenCalledWith(options);
    });

    it("should use default values when no options or env provided", () => {
      process.env.ALLORA_API_KEY = "";
      process.env.ALLORA_BASE_API_URL = "";
      process.env.ALLORA_CHAIN_SLUG = "";

      const agentkit = new AlloraAgentkit();
      expect(agentkit).toBeDefined();
      expect(AlloraAPIClient).toHaveBeenCalledWith({
        apiKey: "UP-4151d0cc489a44a7aa5cd7ef",
        baseAPIUrl: "",
        chainSlug: ChainSlug.TESTNET,
      });
    });

    it("should throw error for invalid chain slug", () => {
      const invalidChainSlug = "INVALID_CHAIN" as unknown as ChainSlug;
      expect(() => {
        new AlloraAgentkit({ chainSlug: invalidChainSlug });
      }).toThrow(/Invalid chainSlug/);
    });
  });
});
