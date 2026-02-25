import { describe, it, expect } from "@jest/globals";
import { oneLyActionProvider } from "./oneLyActionProvider";

describe("OneLyActionProvider", () => {
  const provider = oneLyActionProvider();

  describe("provider configuration", () => {
    it("should have correct name", () => {
      expect(provider.name).toBe("onely");
    });

    it("should accept custom config", () => {
      const customProvider = oneLyActionProvider({
        apiKey: "test-key",
        apiBase: "https://test.1ly.store",
      });
      expect(customProvider.name).toBe("onely");
    });
  });

  describe("network support", () => {
    it("should support base-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as any)).toBe(true);
    });

    it("should support base-sepolia", () => {
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as any)).toBe(true);
    });

    it("should support solana-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "solana-mainnet" } as any)).toBe(true);
    });

    it("should support solana-devnet", () => {
      expect(provider.supportsNetwork({ networkId: "solana-devnet" } as any)).toBe(true);
    });

    it("should not support ethereum-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as any)).toBe(false);
    });

    it("should not support arbitrum-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "arbitrum-mainnet" } as any)).toBe(false);
    });
  });

  describe("actions", () => {
    const mockWalletProvider = {} as any;

    it("should have 9 actions defined", () => {
      const actions = provider.getActions(mockWalletProvider);
      expect(actions.length).toBe(9);
    });

    it("should include buyer actions", () => {
      const actionNames = provider.getActions(mockWalletProvider).map((a) => a.name);
      expect(actionNames).toContain("onely_search");
      expect(actionNames).toContain("onely_get_details");
      expect(actionNames).toContain("onely_call");
      expect(actionNames).toContain("onely_review");
    });

    it("should include seller actions", () => {
      const actionNames = provider.getActions(mockWalletProvider).map((a) => a.name);
      expect(actionNames).toContain("onely_create_store");
      expect(actionNames).toContain("onely_create_link");
      expect(actionNames).toContain("onely_list_links");
      expect(actionNames).toContain("onely_get_stats");
      expect(actionNames).toContain("onely_withdraw");
    });
  });

  describe("integration tests with production API", () => {
    // These tests hit the real 1ly.store API
    // Skip if you want to avoid external API calls during testing

    it.skip("should search for APIs on production", async () => {
      const mockWalletProvider = {} as any;
      const result = await provider.search(mockWalletProvider, {
        query: "weather",
        limit: 5,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("results");
      expect(parsed).toHaveProperty("total");
      expect(parsed).toHaveProperty("showing");
    });

    it.skip("should get API details on production", async () => {
      const mockWalletProvider = {} as any;
      // Replace with a known endpoint from production
      const result = await provider.getDetails(mockWalletProvider, {
        endpoint: "test/api",
      });

      const parsed = JSON.parse(result);
      // Test will vary based on whether endpoint exists
      expect(parsed).toBeDefined();
    });
  });
});
