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
    it("should support valid EVM networks", () => {
      expect(
        provider.supportsNetwork({
          networkId: "base-mainnet",
          protocolFamily: "evm",
        }),
      ).toBe(true);
    });

    it("should not support invalid EVM networks, such as testnets", () => {
      expect(
        provider.supportsNetwork({
          networkId: "base-sepolia",
          protocolFamily: "evm",
        }),
      ).toBe(false);
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
      const validInput = {};
      const parseResult = GetOnrampBuyUrlActionSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });
  });

  describe("getOnrampBuyUrl", () => {
    beforeEach(() => {
      mockWalletProvider.getAddress.mockReturnValue("0x123");
    });

    /**
     * Parses URL search parameters from a URL string.
     *
     * @param url - The URL string to parse parameters from
     * @returns The parsed URL search parameters
     */
    function parseUrlParams(url: string): URLSearchParams {
      const urlObj = new URL(url);
      return urlObj.searchParams;
    }

    it("should execute getOnrampBuyUrl with wallet provider", async () => {
      const result = await provider.getOnrampBuyUrl(mockWalletProvider, {});

      const url = new URL(result);
      const params = parseUrlParams(result);

      // Verify base URL
      expect(url.origin + url.pathname).toBe("https://pay.coinbase.com/buy");

      // Verify all expected parameters are present with correct values
      expect(params.get("appId")).toBe("test-project-id");
      expect(params.get("defaultNetwork")).toBe("base");

      // Verify address configuration
      const addressConfig = JSON.parse(params.get("addresses") || "{}");
      expect(addressConfig).toEqual({
        "0x123": ["base"],
      });

      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
      expect(mockWalletProvider.getAddress).toHaveBeenCalled();
    });

    it("should throw error for unsupported network", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "unsupported-network",
      });

      await expect(provider.getOnrampBuyUrl(mockWalletProvider, {})).rejects.toThrow(
        "Network ID is not supported. Make sure you are using a supported mainnet network.",
      );
    });

    it("should throw error when network ID is not set", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: undefined,
      });

      await expect(provider.getOnrampBuyUrl(mockWalletProvider, {})).rejects.toThrow(
        "Network ID is not set",
      );
    });
  });
});
