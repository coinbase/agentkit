import { OnrampActionProvider } from "./onrampActionProvider";
import { Network } from "../../network";
import { GetOnrampBuyUrlActionSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

describe("OnrampActionProvider", () => {
  const provider = new OnrampActionProvider({
    projectId: "test-project-id",
  });
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue("0x123"),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support the protocol family", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
        }),
      ).toBe(true);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("action validation", () => {
    it("should validate getOnrampBuyUrl schema", () => {
      const validInput = {
        asset: "ETH",
      };
      const parseResult = GetOnrampBuyUrlActionSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it("should reject invalid asset input", () => {
      const invalidInput = {
        asset: "INVALID_COIN",
      };
      const parseResult = GetOnrampBuyUrlActionSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("getOnrampBuyUrl", () => {
    beforeEach(() => {
      mockWalletProvider.getAddress.mockReturnValue("0x123");
    });

    /**
     *
     * @param url
     */
    function parseUrlParams(url: string): URLSearchParams {
      const urlObj = new URL(url);
      return urlObj.searchParams;
    }

    it("should execute getOnrampBuyUrl with wallet provider", async () => {
      const result = await provider.getOnrampBuyUrl(mockWalletProvider, {
        asset: "ETH",
      });

      const url = new URL(result);
      const params = parseUrlParams(result);

      // Verify base URL
      expect(url.origin + url.pathname).toBe("https://pay.coinbase.com/buy");

      // Verify all expected parameters are present with correct values
      expect(params.get("appId")).toBe("test-project-id");
      expect(params.get("defaultNetwork")).toBe("base");
      expect(params.get("defaultAsset")).toBe("ETH");

      // Verify address configuration
      const addressConfig = JSON.parse(params.get("addresses") || "{}");
      expect(addressConfig).toEqual({
        "0x123": ["base"],
      });

      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
      expect(mockWalletProvider.getAddress).toHaveBeenCalled();
    });

    it("should support different assets with correct network mappings", async () => {
      const ethResult = await provider.getOnrampBuyUrl(mockWalletProvider, {
        asset: "ETH",
      });
      const ethParams = parseUrlParams(ethResult);
      expect(ethParams.get("defaultAsset")).toBe("ETH");
      expect(ethParams.get("defaultNetwork")).toBe("base");

      const usdcResult = await provider.getOnrampBuyUrl(mockWalletProvider, {
        asset: "USDC",
      });
      const usdcParams = parseUrlParams(usdcResult);
      expect(usdcParams.get("defaultAsset")).toBe("USDC");
      expect(usdcParams.get("defaultNetwork")).toBe("base");

      // Verify address configuration remains consistent
      const addressConfig = JSON.parse(usdcParams.get("addresses") || "{}");
      expect(addressConfig).toEqual({
        "0x123": ["base"],
      });
    });

    it("should throw error for unsupported network", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "unsupported-network",
      });

      await expect(
        provider.getOnrampBuyUrl(mockWalletProvider, {
          asset: "ETH",
        }),
      ).rejects.toThrow("Network ID is not supported");
    });

    it("should throw error when network ID is not set", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: undefined,
      });

      await expect(
        provider.getOnrampBuyUrl(mockWalletProvider, {
          asset: "ETH",
        }),
      ).rejects.toThrow("Network ID is not set");
    });
  });
});
