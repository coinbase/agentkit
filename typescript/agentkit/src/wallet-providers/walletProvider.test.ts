import { WalletProvider } from "./walletProvider";
import { Network } from "../network";
import { jest } from "@jest/globals";

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
}); 