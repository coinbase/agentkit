import { PrivyWalletProvider } from "./privyWalletProvider";
import { PrivyEvmWalletProvider } from "./privyEvmWalletProvider";
import { PrivySvmWalletProvider } from "./privySvmWalletProvider";

// Define proper types for mocks
type MockConfigureFn = jest.Mock<Promise<any>, [any]>;

// Properly type the mocked modules
jest.mock("./privyEvmWalletProvider", () => ({
  PrivyEvmWalletProvider: {
    configureWithWallet: jest.fn().mockResolvedValue({
      /* Mock EVM wallet provider instance */
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
      /* Mock SVM wallet provider instance */
      getAddress: jest.fn().mockReturnValue("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "solana",
        chainId: "mainnet-beta",
        networkId: "mainnet-beta",
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create an EVM wallet provider by default", async () => {
    const provider = await PrivyWalletProvider.configureWithWallet(MOCK_EVM_CONFIG);
    
    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_EVM_CONFIG);
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    
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
    
    expect(provider.getAddress()).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    expect(provider.getNetwork().protocolFamily).toBe("evm");
  });

  it("should create an SVM wallet provider when solana is specified", async () => {
    const provider = await PrivyWalletProvider.configureWithWallet(MOCK_SVM_CONFIG);
    
    expect(PrivySvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(MOCK_SVM_CONFIG);
    expect(PrivyEvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
    
    expect(provider.getAddress()).toBe("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM");
    expect(provider.getNetwork().protocolFamily).toBe("solana");
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
    // Create a local reference to the mocked function
    const mockEvmConfigureWithWallet = PrivyEvmWalletProvider.configureWithWallet as jest.Mock;
    
    // Save original implementation
    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();
    
    // Temporarily override implementation to throw error
    mockEvmConfigureWithWallet.mockImplementation(() => {
      throw new Error("API key not found");
    });
    
    // Should pass the error through
    await expect(
      PrivyWalletProvider.configureWithWallet({
        appId: "test-app-id",
        appSecret: "test-app-secret",
      })
    ).rejects.toThrow("API key not found");
    
    // Restore original implementation
    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });
  
  it("should validate config properly", async () => {
    // Create a local reference to the mocked function
    const mockEvmConfigureWithWallet = PrivyEvmWalletProvider.configureWithWallet as jest.Mock;
    
    // Save original implementation
    const originalImplementation = mockEvmConfigureWithWallet.getMockImplementation();
    
    // Missing appSecret field
    const invalidConfig = {
      appId: "test-app-id",
      // appSecret is missing
    };
    
    // Temporarily override implementation to check parameters
    mockEvmConfigureWithWallet.mockImplementation((config: any) => {
      if (!config.appSecret) {
        throw new Error("Missing required appSecret");
      }
      return Promise.resolve({});
    });
    
    // Should throw an error about missing appSecret
    await expect(
      // @ts-ignore - intentionally passing invalid config for the test
      PrivyWalletProvider.configureWithWallet(invalidConfig)
    ).rejects.toThrow("Missing required appSecret");
    
    // Restore original implementation
    mockEvmConfigureWithWallet.mockImplementation(originalImplementation);
  });
  
  it("should prefer chainType over extension-based inference", async () => {
    // Config specifies ethereum explicitly but has an .sol extension
    const explicitConfig = {
      ...MOCK_EVM_CONFIG,
      chainType: "ethereum" as const,
      extension: ".sol", // Solana extension but explicitly asking for Ethereum
    };
    
    const provider = await PrivyWalletProvider.configureWithWallet(explicitConfig);
    
    // Should honor the explicit chainType
    expect(PrivyEvmWalletProvider.configureWithWallet).toHaveBeenCalledWith(explicitConfig);
    expect(PrivySvmWalletProvider.configureWithWallet).not.toHaveBeenCalled();
  });
}); 