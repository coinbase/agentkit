import { SafeWalletProvider } from "./safeWalletProvider";
import { Network } from "../network";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { createPublicClient } from "viem";

// Mock modules
jest.mock("@safe-global/protocol-kit");
jest.mock("@safe-global/api-kit");
jest.mock("viem", () => ({
  ...jest.requireActual("viem"),
  createPublicClient: jest.fn(),
  http: jest.fn(),
}));

describe("SafeWalletProvider", () => {
  const mockPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
  const mockNetworkId = "base-sepolia";
  const mockSafeAddress = "0x1234567890123456789012345678901234567890";

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock createPublicClient with default 1 ETH balance
    (createPublicClient as jest.Mock).mockReturnValue({
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)), // 1 ETH
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: "0xtxhash" }),
    });

    // Mock Safe.init
    (Safe.init as jest.Mock).mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockSafeAddress),
      connect: jest.fn().mockResolvedValue({
        getAddress: jest.fn().mockResolvedValue(mockSafeAddress),
      }),
      createSafeDeploymentTransaction: jest.fn().mockResolvedValue({
        to: "0x123",
        value: "0",
        data: "0x",
      }),
      getSafeProvider: jest.fn().mockReturnValue({
        getExternalSigner: jest.fn().mockResolvedValue({
          sendTransaction: jest.fn().mockResolvedValue("0xtxhash"),
        }),
      }),
    });

    // Mock SafeApiKit constructor
    (SafeApiKit as unknown as jest.Mock).mockImplementation(() => ({}));
  });

  it("should initialize correctly with private key and network", async () => {
    const provider = new SafeWalletProvider({
      privateKey: mockPrivateKey,
      networkId: mockNetworkId,
    });

    await provider.waitForInitialization();

    expect(provider.getName()).toBe("safe_wallet_provider");

    const network = provider.getNetwork();
    expect(network).toEqual({
      protocolFamily: "evm",
      networkId: mockNetworkId,
      chainId: NETWORK_ID_TO_VIEM_CHAIN[mockNetworkId].id.toString(),
    } as Network);
  });

  it("should throw error when connecting to unsupported network", () => {
    expect(() => {
      new SafeWalletProvider({
        privateKey: mockPrivateKey,
        networkId: "solana",
      });
    }).toThrow("Unsupported network: solana");
  });

  it("should throw error when accessing address before initialization", async () => {
    const provider = new SafeWalletProvider({
      privateKey: mockPrivateKey,
      networkId: mockNetworkId,
    });

    expect(() => {
      provider.getAddress();
    }).toThrow("Safe not yet initialized");
  });

  it("should connect to existing Safe if address provided", async () => {
    // Mock successful initialization
    (Safe.init as jest.Mock).mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockSafeAddress),
    });

    const provider = new SafeWalletProvider({
      privateKey: mockPrivateKey,
      networkId: mockNetworkId,
      safeAddress: mockSafeAddress,
    });

    await provider.waitForInitialization();

    expect(provider.getAddress()).toBe(mockSafeAddress);
    expect(Safe.init).toHaveBeenCalledWith(
      expect.objectContaining({
        safeAddress: mockSafeAddress,
      }),
    );
  });

  it("should fail if account has no ETH balance when creating new Safe", async () => {
    // Mock zero balance
    (createPublicClient as jest.Mock).mockReturnValue({
      getBalance: jest.fn().mockResolvedValue(BigInt(0)), // 0 ETH
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: "0xtxhash" }),
    });

    const provider = new SafeWalletProvider({
      privateKey: mockPrivateKey,
      networkId: mockNetworkId,
      // No safeAddress -> will try to create new Safe
    });

    // Wait for initialization to fail
    await expect(provider.waitForInitialization()).rejects.toThrow(
      "Creating Safe account requires gaas fees. Please ensure you have enough ETH in your wallet.",
    );
  });
});
