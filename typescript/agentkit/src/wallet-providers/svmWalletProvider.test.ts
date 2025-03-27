import { SvmWalletProvider } from "./svmWalletProvider";

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
      SvmWalletProvider.prototype.getConnection = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.getConnection
      >;
    }
    if (!SvmWalletProvider.prototype.getPublicKey) {
      SvmWalletProvider.prototype.getPublicKey = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.getPublicKey
      >;
    }
    if (!SvmWalletProvider.prototype.signTransaction) {
      SvmWalletProvider.prototype.signTransaction = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.signTransaction
      >;
    }
    if (!SvmWalletProvider.prototype.sendTransaction) {
      SvmWalletProvider.prototype.sendTransaction = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.sendTransaction
      >;
    }
    if (!SvmWalletProvider.prototype.signAndSendTransaction) {
      SvmWalletProvider.prototype.signAndSendTransaction = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.signAndSendTransaction
      >;
    }
    if (!SvmWalletProvider.prototype.getSignatureStatus) {
      SvmWalletProvider.prototype.getSignatureStatus = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.getSignatureStatus
      >;
    }
    if (!SvmWalletProvider.prototype.waitForSignatureResult) {
      SvmWalletProvider.prototype.waitForSignatureResult = jest.fn() as jest.MockedFunction<
        typeof SvmWalletProvider.prototype.waitForSignatureResult
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
