import { PrivyWalletProvider } from "./privyWalletProvider";
import { PrivyEvmWalletProvider } from "./privyEvmWalletProvider";
import { PrivySvmWalletProvider } from "./privySvmWalletProvider";

// Mock the specific provider modules
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
}); 