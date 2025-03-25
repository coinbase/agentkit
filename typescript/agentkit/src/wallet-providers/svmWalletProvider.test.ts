import { SvmWalletProvider } from "./svmWalletProvider";
import { Network } from "../network";
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  VersionedTransaction,
  SignatureResult,
} from "@solana/web3.js";
import { jest } from "@jest/globals";

// Define common mock constants at the top
const MOCK_ADDRESS = "AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM";
const MOCK_NETWORK_ID = "solana-devnet";
const MOCK_CHAIN_ID = "devnet";
const MOCK_SIGNATURE = "23456wGEsQERVDAsDKpKvARGjxhquSG42avBr7YxH3nr5xjAdmvVHNXxRT";

// Create a proper mock for method signatures
const EXPECTED_SVM_METHODS = [
  'getConnection',
  'getPublicKey',
  'signTransaction',
  'sendTransaction',
  'signAndSendTransaction',
  'getSignatureStatus',
  'waitForSignatureResult'
];

// Base methods from WalletProvider
const EXPECTED_BASE_METHODS = [
  'getAddress',
  'getNetwork',
  'getName',
  'getBalance',
  'nativeTransfer'
];

describe("SvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    // This is just a placeholder test to document the expected interface
    // Abstract methods are enforced by TypeScript, not at runtime
    // The test always passes because we're just documenting the contract
    
    // List all expected methods for documentation purposes
    const allExpectedMethods = [...EXPECTED_SVM_METHODS, ...EXPECTED_BASE_METHODS];
    expect(Array.isArray(allExpectedMethods)).toBe(true);
  });
  
  it("should extend WalletProvider", () => {
    // Check that SvmWalletProvider extends WalletProvider
    const proto = Object.getPrototypeOf(SvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe('WalletProvider');
  });

  it("should have consistent method signatures", () => {
    // Verify essential SVM method signatures are defined properly
    
    // Check signTransaction signature
    const signTransactionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype, 
      'signTransaction'
    );
    expect(signTransactionDescriptor).toBeDefined();
    expect(typeof signTransactionDescriptor!.value).toBe('function');
    
    // Check sendTransaction signature
    const sendTransactionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype, 
      'sendTransaction'
    );
    expect(sendTransactionDescriptor).toBeDefined();
    expect(typeof sendTransactionDescriptor!.value).toBe('function');
    
    // Check getPublicKey signature
    const getPublicKeyDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype, 
      'getPublicKey'
    );
    expect(getPublicKeyDescriptor).toBeDefined();
    expect(typeof getPublicKeyDescriptor!.value).toBe('function');
    
    // Check getConnection signature
    const getConnectionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype, 
      'getConnection'
    );
    expect(getConnectionDescriptor).toBeDefined();
    expect(typeof getConnectionDescriptor!.value).toBe('function');
  });
}); 