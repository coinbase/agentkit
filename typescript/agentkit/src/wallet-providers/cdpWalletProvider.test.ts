import { CdpWalletProvider } from "./cdpWalletProvider";
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { NETWORK_ID_TO_CHAIN_ID } from "../network/network";
import { Decimal } from "decimal.js";
import { TransactionRequest } from "viem";

// Mock the Coinbase SDK
jest.mock("@coinbase/coinbase-sdk", () => ({
  Coinbase: {
    configure: jest.fn(),
    configureFromJson: jest.fn(),
    networks: {
      BaseSepolia: "base-sepolia",
    },
    assets: {
      Eth: "eth",
    },
  },
  Wallet: {
    create: jest.fn(),
    import: jest.fn(),
  },
  hashMessage: jest.fn().mockImplementation((message: string) => {
    // Simple mock implementation that returns a deterministic hash
    return `0x${Buffer.from(message).toString('hex')}`;
  }),
}));


describe("CDP Wallet Provider", () => {
  const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const mockWallet = {
    getDefaultAddress: jest.fn().mockResolvedValue({ getId: () => mockAddress }),
    getNetworkId: jest.fn().mockReturnValue(Coinbase.networks.BaseSepolia),
    createPayloadSignature: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(new Decimal("1.0")), // 1 ETH in base units
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    (Wallet.create as jest.Mock).mockResolvedValue(mockWallet);
    (Wallet.import as jest.Mock).mockResolvedValue(mockWallet);
  });

  it("should initialize correctly with default network", async () => {
    const provider = await CdpWalletProvider.configureWithWallet({
      networkId: Coinbase.networks.BaseSepolia,
    });

    expect(provider.getNetwork()).toEqual({
      protocolFamily: "evm",
      chainId: NETWORK_ID_TO_CHAIN_ID[Coinbase.networks.BaseSepolia],
      networkId: Coinbase.networks.BaseSepolia,
    });

    expect(provider.getName()).toBe("cdp_wallet_provider");
    expect(provider.getAddress()).toBe(mockAddress);
  });

  it("should initialize correctly with custom RPC URL", async () => {
    const customRpcUrl = "https://base-sepolia.example.com";
    const provider = await CdpWalletProvider.configureWithWallet({
      networkId: Coinbase.networks.BaseSepolia,
      rpcUrl: customRpcUrl,
    });

    expect(provider.getNetwork()).toEqual({
      protocolFamily: "evm",
      chainId: NETWORK_ID_TO_CHAIN_ID[Coinbase.networks.BaseSepolia],
      networkId: Coinbase.networks.BaseSepolia,
    });
    expect(provider.getRpcUrl()).toBe(customRpcUrl);
  });

  it("should throw error when wallet creation fails", async () => {
    (Wallet.create as jest.Mock).mockRejectedValue(new Error("Wallet creation failed"));

    await expect(
      CdpWalletProvider.configureWithWallet({})
    ).rejects.toThrow("Failed to initialize wallet: Error: Wallet creation failed");
  });

  it("should get wallet balance correctly", async () => {
    const provider = await CdpWalletProvider.configureWithWallet({
      networkId: Coinbase.networks.BaseSepolia,
    });

    const balance = await provider.getBalance();
    expect(balance.toString()).toBe("1000000000000000000"); // 1 ETH in wei
    expect(mockWallet.getBalance).toHaveBeenCalledWith("eth");
  });

  it("should sign messages correctly with mocked hash", async () => {
    const message = "Hello, World!";
    const expectedHash = `0x${Buffer.from(message).toString('hex')}`;
    const mockSignature = "0x123456789abcdef";

    mockWallet.createPayloadSignature.mockResolvedValue({
      getStatus: () => "completed",
      getSignature: () => mockSignature,
    });

    const provider = await CdpWalletProvider.configureWithWallet({
      networkId: Coinbase.networks.BaseSepolia,
    });

    const signature = await provider.signMessage(message);

    // Verify the hash was created correctly
    expect(mockWallet.createPayloadSignature).toHaveBeenCalledWith(expectedHash);
    expect(signature).toBe(mockSignature);
  });

  it("should handle pending signatures correctly", async () => {
    const mockSignature = "0x123456789abcdef";
    mockWallet.createPayloadSignature.mockResolvedValue({
      getStatus: () => "pending",
      wait: jest.fn().mockResolvedValue(true),
      getSignature: () => mockSignature,
    });

    const provider = await CdpWalletProvider.configureWithWallet({
      networkId: Coinbase.networks.BaseSepolia,
    });

    const signature = await provider.signMessage("Hello, World!");
    expect(signature).toBe(mockSignature);
  });
}); 