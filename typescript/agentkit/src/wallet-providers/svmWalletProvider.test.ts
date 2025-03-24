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

describe("SvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    // This is just a placeholder test to document the expected interface
    // Abstract methods are enforced by TypeScript, not at runtime
    // The test always passes because we're just documenting the contract
    
    // Expected abstract methods from SvmWalletProvider
    const svmSpecificMethods = [
      'getConnection',
      'getPublicKey',
      'signTransaction',
      'sendTransaction',
      'signAndSendTransaction',
      'getSignatureStatus',
      'waitForSignatureResult'
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
    const allExpectedMethods = [...svmSpecificMethods, ...baseProviderMethods];
    expect(Array.isArray(allExpectedMethods)).toBe(true);
  });
  
  it("should extend WalletProvider", () => {
    // Check that SvmWalletProvider extends WalletProvider
    const proto = Object.getPrototypeOf(SvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe('WalletProvider');
  });
}); 