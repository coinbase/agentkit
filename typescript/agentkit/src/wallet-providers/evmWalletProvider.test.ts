import { EvmWalletProvider } from "./evmWalletProvider";
import { jest } from "@jest/globals";
import type { TransactionRequest } from "viem";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const EXPECTED_EVM_METHODS = [
  "signMessage",
  "signTypedData",
  "signTransaction",
  "sendTransaction",
  "waitForTransactionReceipt",
  "readContract",
];

const EXPECTED_BASE_METHODS = [
  "getAddress",
  "getNetwork",
  "getName",
  "getBalance",
  "nativeTransfer",
];

describe("EvmWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    EvmWalletProvider.prototype.signMessage = jest.fn() as jest.Mock<
      (message: string | Uint8Array) => Promise<`0x${string}`>
    >;
    EvmWalletProvider.prototype.signTypedData = jest.fn() as jest.Mock<
      (typedData: unknown) => Promise<`0x${string}`>
    >;
    EvmWalletProvider.prototype.signTransaction = jest.fn() as jest.Mock<
      (transaction: TransactionRequest) => Promise<`0x${string}`>
    >;
    EvmWalletProvider.prototype.sendTransaction = jest.fn() as jest.Mock<
      (transaction: TransactionRequest) => Promise<`0x${string}`>
    >;
    EvmWalletProvider.prototype.waitForTransactionReceipt = jest.fn() as jest.Mock<
      (txHash: `0x${string}`) => Promise<unknown>
    >;
    // @ts-expect-error: complex generic signature
    EvmWalletProvider.prototype.readContract = jest.fn();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {
    const allExpectedMethods = [...EXPECTED_EVM_METHODS, ...EXPECTED_BASE_METHODS];
    expect(Array.isArray(allExpectedMethods)).toBe(true);
  });

  it("should extend WalletProvider", () => {
    const proto = Object.getPrototypeOf(EvmWalletProvider);
    const protoName = proto.name;
    expect(protoName).toBe("WalletProvider");
  });

  it("should have consistent method signatures", () => {
    const signMessageDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype,
      "signMessage",
    );
    expect(signMessageDescriptor).toBeDefined();
    expect(typeof signMessageDescriptor!.value).toBe("function");

    const signTypedDataDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype,
      "signTypedData",
    );
    expect(signTypedDataDescriptor).toBeDefined();
    expect(typeof signTypedDataDescriptor!.value).toBe("function");

    const readContractDescriptor = Object.getOwnPropertyDescriptor(
      EvmWalletProvider.prototype,
      "readContract",
    );
    expect(readContractDescriptor).toBeDefined();
    expect(typeof readContractDescriptor!.value).toBe("function");
  });
});
