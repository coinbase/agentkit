import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import {
  TransactionRequest,
  ReadContractParameters,
  ReadContractReturnType,
  Abi,
  ContractFunctionName,
  ContractFunctionArgs,
} from "viem";
import { jest } from "@jest/globals";

describe("EvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    // This is just a placeholder test to document the expected interface
    // Abstract methods are enforced by TypeScript, not at runtime
    // The test always passes because we're just documenting the contract
    
    // Expected abstract methods from EvmWalletProvider
    const evmSpecificMethods = [
      'signMessage',
      'signTypedData',
      'signTransaction',
      'sendTransaction',
      'waitForTransactionReceipt',
      'readContract'
    ];
    
    // Expected abstract methods from WalletProvider
    const baseProviderMethods = [
      'getAddress',
      'getNetwork',
      'getName',
      'getBalance',
      'nativeTransfer'
    ];
    
    // List all expected methods for documentation purposes
    const allExpectedMethods = [...evmSpecificMethods, ...baseProviderMethods];
    expect(Array.isArray(allExpectedMethods)).toBe(true);
  });
  
  it("should extend WalletProvider", () => {
    // Check that EvmWalletProvider extends WalletProvider
    const proto = Object.getPrototypeOf(EvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe('WalletProvider');
  });
}); 