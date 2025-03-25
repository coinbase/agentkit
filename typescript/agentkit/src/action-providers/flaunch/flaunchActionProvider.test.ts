import { FlaunchActionProvider } from "./flaunchActionProvider";
import { Network } from "../../network";
import { FlaunchSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

// Mock the utils module
jest.mock("./utils", () => ({
  generateTokenUri: jest.fn().mockResolvedValue("ipfs://test-uri"),
}));

describe("FlaunchActionProvider", () => {
  const provider = new FlaunchActionProvider({ pinataJwt: "test-jwt" });
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
        chainId: "0x14a34",
      }),
      nativeTransfer: jest.fn(),
      sendTransaction: jest.fn().mockResolvedValue("0xtxhash"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support the supported networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);

      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-sepolia",
        }),
      ).toBe(true);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
          networkId: "base-mainnet",
        }),
      ).toBe(false);
    });

    it("should not support unsupported networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("action validation", () => {
    it("should validate flaunch schema", () => {
      const validInput = {
        name: "Test Token",
        symbol: "TEST",
        metadata: {
          imageUrl: "https://example.com/image.png",
          description: "A test token",
          websiteUrl: "https://example.com",
        },
      };
      const parseResult = FlaunchSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it("should reject invalid flaunch input", () => {
      const invalidInput = {
        name: "",
        symbol: "",
        metadata: {
          imageUrl: "not-a-url",
          description: "",
        },
      };
      const parseResult = FlaunchSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("flaunch action", () => {
    it("should execute flaunch action with wallet provider", async () => {
      const args = {
        name: "Test Token",
        symbol: "TEST",
        imageUrl: "https://example.com/image.png",
        description: "A test token",
        websiteUrl: "https://example.com",
      };

      const result = await provider.flaunch(mockWalletProvider, args);
      expect(result).toContain("Flaunched token TEST");
      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalled();
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalled();
    });
  });
});
