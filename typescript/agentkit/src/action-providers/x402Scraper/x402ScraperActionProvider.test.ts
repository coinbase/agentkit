import { Buffer } from "node:buffer";
import { x402ScraperActionProvider } from "./x402ScraperActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

describe("X402ScraperActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const mockWallet = {
    getAddress: jest.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
    signTypedData: jest.fn().mockResolvedValue("0xmocked_eip712_signature"),
    sendTransaction: jest.fn().mockResolvedValue("0xmocked_tx_hash"),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM protocol family", () => {
      const provider = x402ScraperActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });

    it("should return false for non-EVM protocol families", () => {
      const provider = x402ScraperActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("scrapeWebpage", () => {
    it("should scrape webpage successfully when free trial is active (HTTP 200)", async () => {
      const provider = x402ScraperActionProvider();
      const mockResult = {
        title: "Base | Ethereum L2",
        markdown: "# Base\nSecure, low-cost, builder-friendly Ethereum L2.",
        url: "https://base.org",
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResult,
      });

      const response = await provider.scrapeWebpage(mockWallet, { url: "https://base.org" });
      const parsed = JSON.parse(response);

      expect(parsed.title).toBe("Base | Ethereum L2");
      expect(parsed.url).toBe("https://base.org");
    });

    it("should handle HTTP 402 Payment Required via gasless EIP-712 settlement", async () => {
      const provider = x402ScraperActionProvider();
      const challenge = {
        payment: {
          recipient: "0x4107f297256E00F32873f45F50A35a902c1c2034",
          amount: 5000,
        },
      };
      const headerB64 = Buffer.from(JSON.stringify(challenge)).toString("base64");

      // 1. First call returns 402
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        headers: {
          get: (h: string) => (h.toLowerCase() === "payment-required" ? headerB64 : null),
        },
        json: async () => challenge,
      });

      // 2. Second call with signature returns 200
      const paidResult = {
        title: "Base | Ethereum L2",
        markdown: "# Base Content After Settlement",
      };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => paidResult,
      });

      const response = await provider.scrapeWebpage(mockWallet, { url: "https://base.org" });
      const parsed = JSON.parse(response);

      expect(parsed.title).toBe("Base | Ethereum L2");
      expect(mockWallet.signTypedData).toHaveBeenCalled();
    });
  });

  describe("digestWebpage", () => {
    it("should synthesize executive digest from webpage", async () => {
      const provider = x402ScraperActionProvider();
      const mockDigest = {
        url: "https://base.org",
        digest: "Base is an open-source Ethereum Layer 2 incubated by Coinbase.",
        takeaways: ["Low gas fees", "EVM equivalent", "Built on OP Stack"],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDigest,
      });

      const response = await provider.digestWebpage(mockWallet, {
        url: "https://base.org",
        format: "executive",
      });
      const parsed = JSON.parse(response);

      expect(parsed.digest).toContain("Ethereum Layer 2");
      expect(parsed.takeaways).toHaveLength(3);
    });
  });

  describe("auditWebpage", () => {
    it("should audit webpage security and credibility", async () => {
      const provider = x402ScraperActionProvider();
      const mockAudit = {
        url: "https://base.org",
        securityScore: 98,
        phishingRisk: "low",
        hasValidSSL: true,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAudit,
      });

      const response = await provider.auditWebpage(mockWallet, { url: "https://base.org" });
      const parsed = JSON.parse(response);

      expect(parsed.securityScore).toBe(98);
      expect(parsed.phishingRisk).toBe("low");
    });
  });

  describe("searchWeb", () => {
    it("should return synthesized search results", async () => {
      const provider = x402ScraperActionProvider();
      const mockSearch = {
        query: "Coinbase AgentKit",
        results: [
          { title: "Coinbase AgentKit Docs", url: "https://docs.cdp.coinbase.com/agentkit" },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearch,
      });

      const response = await provider.searchWeb(mockWallet, {
        query: "Coinbase AgentKit",
        numResults: 5,
      });
      const parsed = JSON.parse(response);

      expect(parsed.query).toBe("Coinbase AgentKit");
      expect(parsed.results).toHaveLength(1);
    });
  });

  describe("searchTwitter", () => {
    it("should return recent tweets matching search query", async () => {
      const provider = x402ScraperActionProvider();
      const mockTweets = {
        query: "$BASE",
        tweets: [{ id: "123", text: "Building AI agents on $BASE with AgentKit!" }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTweets,
      });

      const response = await provider.searchTwitter(mockWallet, {
        query: "$BASE",
        maxResults: 10,
      });
      const parsed = JSON.parse(response);

      expect(parsed.query).toBe("$BASE");
      expect(parsed.tweets).toHaveLength(1);
    });
  });

  describe("getTwitterProfile", () => {
    it("should fetch verified Twitter/X user profile", async () => {
      const provider = x402ScraperActionProvider();
      const mockProfile = {
        handle: "base",
        name: "Base",
        followers: 1200000,
        verified: true,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockProfile,
      });

      const response = await provider.getTwitterProfile(mockWallet, { handle: "base" });
      const parsed = JSON.parse(response);

      expect(parsed.handle).toBe("base");
      expect(parsed.verified).toBe(true);
    });
  });

  describe("spending ceiling protection", () => {
    it("should reject payments exceeding maxPaymentUsdc ceiling", async () => {
      const provider = x402ScraperActionProvider({ maxPaymentUsdc: 0.001 });
      const challenge = {
        payment: {
          recipient: "0x4107f297256E00F32873f45F50A35a902c1c2034",
          amount: 50000, // 0.05 USDC > 0.001 USDC
        },
      };
      const headerB64 = Buffer.from(JSON.stringify(challenge)).toString("base64");

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        headers: {
          get: (h: string) => (h.toLowerCase() === "payment-required" ? headerB64 : null),
        },
        json: async () => challenge,
      });

      const response = await provider.scrapeWebpage(mockWallet, { url: "https://expensive.com" });
      const parsed = JSON.parse(response);

      expect(parsed.error).toContain("exceeds configured ceiling");
      expect(parsed.status).toBe(402);
    });
  });
});
