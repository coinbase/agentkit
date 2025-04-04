import { PrivyWalletProvider } from "./privyWalletProvider";
import { PrivyEvmWalletProvider } from "./privyEvmWalletProvider";
import { PrivySvmWalletProvider } from "./privySvmWalletProvider";
import { PrivyEvmDelegatedEmbeddedWalletProvider } from "./privyEvmDelegatedEmbeddedWalletProvider";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("./privyEvmWalletProvider", () => ({
  PrivyEvmWalletProvider: {
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

jest.mock("./privySvmWalletProvider", () => ({
  PrivySvmWalletProvider: {
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

jest.mock("./privyEvmDelegatedEmbeddedWalletProvider", () => ({
  PrivyEvmDelegatedEmbeddedWalletProvider: {
    configureWithWallet: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockReturnValue("0x324335Cc6634C0532925a3b844Bc454e4438d22g"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "mainnet",
      }),
    }),
  },
}));

describe("PrivyWalletProvider", () => {
  const MOCK_EVM_CONFIG = {
    appId: "test-app-id",
    appSecret: "test-app-secret",
  };

  const MOCK_SVM_CONFIG = {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    chainType: "solana" as const,
  };

  const MOCK_EVM_EMBEDDED_WALLET_CONFIG = {
    ...MOCK_EVM_CONFIG,
    authorizationPrivateKey: "test-auth-key",
    walletId: "test-wallet-id",
    walletType: "embedded" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create an EVM wallet provider by default", async () => {
    const provider = await PrivyWalletProvider.configureWithWallet(MOCK_EVM_CONFIG);

    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_EVM_CONFIG);
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    expect(PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should create an EVM wallet provider when explicitly requested", async () => {
    const config = {
      ...MOCK_EVM_CONFIG,
      chainType: "ethereum" as const,
    };

    const provider = await PrivyWalletProvider.configureWithWallet(config);

    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(config);
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    expect(PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should create an SVM wallet provider when solana is specified", async () => {
    const provider = await PrivyWalletProvider.configureWithWallet(MOCK_SVM_CONFIG);

    expect(PrivySvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_SVM_CONFIG);
    expect(PrivyEvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    expect(PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM");
    expect(provider.getNetwork().protocolFamily).toBe("solana");
  });

  it("should create an EVM embedded wallet provider when embedded is specified", async () => {
    const provider = await PrivyWalletProvider.configureWithWallet(MOCK_EVM_EMBEDDED_WALLET_CONFIG);

    expect(PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet).toHaveBeenCalledWith(
      MOCK_EVM_EMBEDDED_WALLET_CONFIG,
    );
    expect(PrivyEvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();

    expect(provider.getAddress()).toBe("0x324335Cc6634C0532925a3b844Bc454e4438d22g");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should pass through all config properties", async () => {
    const fullConfig = {
      ...MOCK_EVM_CONFIG,
      walletId: "test-wallet-id",
      authorizationPrivateKey: "test-auth-key",
      authorizationKeyId: "test-auth-key-id",
      chainId: "5",
    };

    await PrivyWalletProvider.configureWithWallet(fullConfig);

    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(fullConfig);
  });

  it("should handle initialization failures properly", async () => {
    const mockEvmConfigureWithWallet = PrivyEvmWalletProvider.configureWithWallet as jest.Mock;

    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();

    mockEvmConfigureWithWallet.mockImplementation(() => {
      throw new Error("API key not found");
    });

    await expect(
      PrivyWalletProvider.configureWithWallet({
        appId: "test-app-id",
        appSecret: "test-app-secret",
      }),
    ).rejects.toThrow("API key not found");

    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });

  it("should validate config properly", async () => {
    const mockEvmConfigureWithWallet = PrivyEvmWalletProvider.configureWithWallet as jest.Mock;
    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();

    mockEvmConfigureWithWallet.mockImplementation(config => {
      if (config.appId === "test-app-id") {
        throw new Error("Missing required appSecret");
      }
      return Promise.resolve({});
    });

    const testConfig = {
      appId: "test-app-id",
      appSecret: "test-app-secret",
    };

    await expect(PrivyWalletProvider.configureWithWallet(testConfig)).rejects.toThrow(
      "Missing required appSecret",
    );

    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });

  it("should prefer chainType over extension-based inference", async () => {
    const explicitConfig = {
      ...MOCK_EVM_CONFIG,
      chainType: "ethereum" as const,
      extension: ".sol",
    };

    await PrivyWalletProvider.configureWithWallet(explicitConfig);

    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(explicitConfig);
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
  });
});
