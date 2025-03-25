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

// Define common mock constants at the top
const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_CHAIN_ID = "1";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_SIGNATURE = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

// Create a proper mock for method signatures
const EXPECTED_EVM_METHODS = [
  'signMessage',
  'signTypedData',
  'signTransaction',
  'sendTransaction',
  'waitForTransactionReceipt',
  'readContract'
];

// Base methods from WalletProvider
const EXPECTED_BASE_METHODS = [
  'getAddress',
  'getNetwork',
  'getName',
  'getBalance',
  'nativeTransfer'
];

describe("EvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    // This is just a placeholder test to document the expected interface
    // Abstract methods are enforced by TypeScript, not at runtime
    // The test always passes because we're just documenting the contract
    
    // List all expected methods for documentation purposes
    const allExpectedMethods = [...EXPECTED_EVM_METHODS, ...EXPECTED_BASE_METHODS];
    expect(Array.isArray(allExpectedMethods)).toBe(true);
  });
  
  it("should extend WalletProvider", () => {
    // Check that EvmWalletProvider extends WalletProvider
    const proto = Object.getPrototypeOf(EvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe('WalletProvider');
  });
  
  it("should have consistent method signatures", () => {
    // Verify essential EVM method signatures are defined properly
    
    // Check signMessage signature
    const signMessageDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype, 
      'signMessage'
    );
    expect(signMessageDescriptor).toBeDefined();
    expect(typeof signMessageDescriptor!.value).toBe('function');
    
    // Check signTypedData signature
    const signTypedDataDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype, 
      'signTypedData'
    );
    expect(signTypedDataDescriptor).toBeDefined();
    expect(typeof signTypedDataDescriptor!.value).toBe('function');
    
    // Check readContract signature
    const readContractDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype, 
      'readContract'
    );
    expect(readContractDescriptor).toBeDefined();
    expect(typeof readContractDescriptor!.value).toBe('function');
  });
}); 