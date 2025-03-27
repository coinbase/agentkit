import { SvmWalletProvider } from "./svmWalletProvider";
// We need these types for typing our mocks, prefix with _ to indicate they're only used for types
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  VersionedTransaction,
  SignatureResult,
} from "@solana/web3.js";
import { jest } from "@jest/globals";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe("SvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    if (!SvmWalletProvider.prototype.getConnection) {
      SvmWalletProvider.prototype.getConnection = jest.fn() as jest.Mock<() => Connection>;
    }
    if (!SvmWalletProvider.prototype.getPublicKey) {
      SvmWalletProvider.prototype.getPublicKey = jest.fn() as jest.Mock<() => PublicKey>;
    }
    if (!SvmWalletProvider.prototype.signTransaction) {
      SvmWalletProvider.prototype.signTransaction = jest.fn() as jest.Mock<
        (_transaction: VersionedTransaction) => Promise<VersionedTransaction>
      >;
    }
    if (!SvmWalletProvider.prototype.sendTransaction) {
      SvmWalletProvider.prototype.sendTransaction = jest.fn() as jest.Mock<
        (_transaction: VersionedTransaction) => Promise<string>
      >;
    }
    if (!SvmWalletProvider.prototype.signAndSendTransaction) {
      SvmWalletProvider.prototype.signAndSendTransaction = jest.fn() as jest.Mock<
        (_transaction: VersionedTransaction) => Promise<string>
      >;
    }
    if (!SvmWalletProvider.prototype.getSignatureStatus) {
      SvmWalletProvider.prototype.getSignatureStatus = jest.fn() as jest.Mock<
        (_signature: string) => Promise<RpcResponseAndContext<SignatureStatus | null>>
      >;
    }
    if (!SvmWalletProvider.prototype.waitForSignatureResult) {
      SvmWalletProvider.prototype.waitForSignatureResult = jest.fn() as jest.Mock<
        (_signature: string) => Promise<RpcResponseAndContext<SignatureResult>>
      >;
    }
  });

  it("should extend WalletProvider", () => {
    const proto = Object.getPrototypeOf(SvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe("WalletProvider");
  });

  it("should have consistent method signatures", () => {
    const signTransactionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype,
      "signTransaction",
    );
    expect(signTransactionDescriptor).toBeDefined();
    expect(typeof signTransactionDescriptor!.value).toBe("function");

    const sendTransactionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype,
      "sendTransaction",
    );
    expect(sendTransactionDescriptor).toBeDefined();
    expect(typeof sendTransactionDescriptor!.value).toBe("function");

    const getPublicKeyDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype,
      "getPublicKey",
    );
    expect(getPublicKeyDescriptor).toBeDefined();
    expect(typeof getPublicKeyDescriptor!.value).toBe("function");

    const getConnectionDescriptor = Object.getOwnPropertyDescriptor(
      SvmWalletProvider.prototype,
      "getConnection",
    );
    expect(getConnectionDescriptor).toBeDefined();
    expect(typeof getConnectionDescriptor!.value).toBe("function");
  });
});
