import { DynamicWalletProvider } from "./dynamicWalletProvider";
import type { DynamicEvmWalletConfig } from "./dynamicEvmWalletProvider";
import type { DynamicSvmWalletConfig } from "./dynamicSvmWalletProvider";
import { DynamicEvmWalletProvider } from "./dynamicEvmWalletProvider";
import { DynamicSvmWalletProvider } from "./dynamicSvmWalletProvider";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("./dynamicEvmWalletProvider", () => ({
  DynamicEvmWalletProvider: {
    configureWithWallet: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockReturnValue("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "mainnet",
      }),
    }),
  },
}));

jest.mock("./dynamicSvmWalletProvider", () => ({
  DynamicSvmWalletProvider: {
    configureWithWallet: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockReturnValue("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "solana",
        chainId: "mainnet-beta",
        networkId: "mainnet-beta",
      }),
    }),
  },
}));

describe("DynamicWalletProvider", () => {
  const MOCK_EVM_CONFIG: DynamicEvmWalletConfig = {
    authToken: "test-auth-token",
    environmentId: "test-environment-id",
    chainId: "1",
    networkId: "mainnet",
  };

  const MOCK_SVM_CONFIG: DynamicSvmWalletConfig = {
    authToken: "test-auth-token",
    environmentId: "test-environment-id",
    networkId: "mainnet-beta",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create an EVM wallet provider by default", async () => {
    const provider = await DynamicWalletProvider.configureWithWallet(MOCK_EVM_CONFIG);

    expect(DynamicEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_EVM_CONFIG);
    expect(DynamicSvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should create an EVM wallet provider when explicitly requested", async () => {
    const config: DynamicEvmWalletConfig = {
      ...MOCK_EVM_CONFIG,
    };

    const provider = await DynamicWalletProvider.configureWithWallet(config);

    expect(DynamicEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(config);
    expect(DynamicSvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should create an SVM wallet provider when solana is specified", async () => {
    const provider = await DynamicWalletProvider.configureWithWallet(MOCK_SVM_CONFIG);

    expect(DynamicSvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_SVM_CONFIG);
    expect(DynamicEvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM");
    expect(provider.getNetwork().protocolFamily).toBe("solana");
  });

  it("should pass through all config properties", async () => {
    const fullConfig: DynamicEvmWalletConfig = {
      ...MOCK_EVM_CONFIG,
      chainId: "5",
    };

    await DynamicWalletProvider.configureWithWallet(fullConfig);

    expect(DynamicEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(fullConfig);
  });

  it("should handle initialization failures properly", async () => {
    const mockEvmConfigureWithWallet = DynamicEvmWalletProvider.configureWithWallet as jest.Mock;

    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();

    mockEvmConfigureWithWallet.mockImplementation(() => {
      throw new Error("Auth token not found");
    });

    await expect(DynamicWalletProvider.configureWithWallet(MOCK_EVM_CONFIG)).rejects.toThrow(
      "Auth token not found",
    );

    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });

  it("should validate config properly", async () => {
    const mockEvmConfigureWithWallet = DynamicEvmWalletProvider.configureWithWallet as jest.Mock;
    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();

    mockEvmConfigureWithWallet.mockImplementation(config => {
      if (!config.authToken) {
        throw new Error("Missing required authToken");
      }
      return Promise.resolve({});
    });

    const testConfig: Partial<DynamicEvmWalletConfig> = {
      environmentId: "test-environment-id",
    };

    await expect(
      DynamicWalletProvider.configureWithWallet(testConfig as DynamicEvmWalletConfig),
    ).rejects.toThrow("Missing required authToken");

    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });
});
