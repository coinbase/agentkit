import { WalletProvider } from "./walletProvider";
import { Network } from "../network";
import { jest } from "@jest/globals";

// Define common mock constants at the top
const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_CHAIN_ID = "1";
const MOCK_PROTOCOL_FAMILY = "evm";
const MOCK_WALLET_NAME = "test_wallet_provider";

// Create a proper mock for the Network type
const MOCK_NETWORK: Network = {
  protocolFamily: MOCK_PROTOCOL_FAMILY,
  networkId: MOCK_NETWORK_ID,
  chainId: MOCK_CHAIN_ID,
};

// Mock the analytics module
jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

describe("WalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    // This is just a placeholder test to document the expected interface
    // Abstract methods are enforced by TypeScript, not at runtime
    // The test always passes because we're just documenting the contract
    
    // Expected abstract methods from WalletProvider
    const expectedMethods = [
      'getAddress',
      'getNetwork',
      'getName',
      'getBalance',
      'nativeTransfer'
    ];
    
    // List all expected methods for documentation purposes
    expect(Array.isArray(expectedMethods)).toBe(true);
  });
  
  it("should track initialization via analytics", () => {
    // Import the mocked analytics module
    const { sendAnalyticsEvent } = require("../analytics");
    
    // Create a mock implementation of the abstract class
    class MockWalletProvider extends WalletProvider {
      getAddress(): string { return MOCK_ADDRESS; }
      getNetwork(): Network { return MOCK_NETWORK; }
      getName(): string { return MOCK_WALLET_NAME; }
      getBalance(): Promise<bigint> { return Promise.resolve(BigInt(1000000000000000000)); }
      nativeTransfer(to: string, value: string): Promise<string> { 
        return Promise.resolve("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"); 
      }
    }
    
    // Instantiate the mock provider which should trigger tracking
    const provider = new MockWalletProvider();
    
    // Allow the async tracking to complete
    return new Promise(resolve => setTimeout(() => {
      // Verify tracking was called with correct parameters
      expect(sendAnalyticsEvent).toHaveBeenCalledWith({
        name: "agent_initialization",
        action: "initialize_wallet_provider",
        component: "wallet_provider",
        wallet_provider: MOCK_WALLET_NAME,
        wallet_address: MOCK_ADDRESS,
        network_id: MOCK_NETWORK_ID,
        chain_id: MOCK_CHAIN_ID,
        protocol_family: MOCK_PROTOCOL_FAMILY,
      });
      resolve(null);
    }, 0));
  });
  
  it("should handle tracking failures gracefully", () => {
    // Import the mocked analytics module and make it throw an error
    const { sendAnalyticsEvent } = require("../analytics");
    sendAnalyticsEvent.mockImplementationOnce(() => {
      throw new Error("Test error");
    });
    
    // Spy on console.warn to verify error handling
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    
    // Create a mock implementation
    class MockWalletProvider extends WalletProvider {
      getAddress(): string { return MOCK_ADDRESS; }
      getNetwork(): Network { return MOCK_NETWORK; }
      getName(): string { return MOCK_WALLET_NAME; }
      getBalance(): Promise<bigint> { return Promise.resolve(BigInt(1000000000000000000)); }
      nativeTransfer(to: string, value: string): Promise<string> { 
        return Promise.resolve("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"); 
      }
    }
    
    // Instantiate the mock provider which should trigger tracking
    const provider = new MockWalletProvider();
    
    // Allow the async tracking to complete
    return new Promise(resolve => setTimeout(() => {
      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to track wallet provider initialization:", 
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
      resolve(null);
    }, 0));
  });
}); 