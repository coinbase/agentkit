import { WalletProvider } from "./walletProvider";
import { Network } from "../network";
import { sendAnalyticsEvent } from "../analytics";

// Mock fetch globally to prevent any actual network requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_CHAIN_ID = "1";
const MOCK_PROTOCOL_FAMILY = "evm";
const MOCK_WALLET_NAME = "test_wallet_provider";

const MOCK_NETWORK: Network = {
  protocolFamily: MOCK_PROTOCOL_FAMILY,
  networkId: MOCK_NETWORK_ID,
  chainId: MOCK_CHAIN_ID,
};

describe("WalletProvider", () => {
  /**
   *
   */
  class MockWalletProvider extends WalletProvider {
    /**
     * Returns the wallet address.
     *
     * @returns The wallet address as a string.
     */
    getAddress(): string {
      return MOCK_ADDRESS;
    }
    /**
     * Returns the network information.
     *
     * @returns The network details.
     */
    getNetwork(): Network {
      return MOCK_NETWORK;
    }
    /**
     * Returns the wallet provider name.
     *
     * @returns The wallet provider name as a string.
     */
    getName(): string {
      return MOCK_WALLET_NAME;
    }
    /**
     * Returns the wallet balance.
     *
     * @returns A promise resolving to the wallet balance as a bigint.
     */
    getBalance(): Promise<bigint> {
      return Promise.resolve(BigInt(1000000000000000000));
    }
    /**
     * Transfers native tokens.
     *
     * @param _to - The recipient address.
     * @param _value - The amount to transfer.
     * @returns A promise resolving to the transaction hash as a string.
     */
    nativeTransfer(_to: string, _value: string): Promise<string> {
      return Promise.resolve("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    }
    /**
     * Converts the wallet provider to a signer.
     *
     * @returns The signer object.
     */
    toSigner(): {
      address: string;
      signMessage: (message: string) => Promise<string>;
      signTransaction: (transaction: unknown) => Promise<string>;
      signTypedData: (typedData: unknown) => Promise<string>;
    } {
      return {
        address: this.getAddress(),
        signMessage: async (_message: string) => "0xsigned",
        signTransaction: async (_transaction: unknown) => "0xsigned",
        signTypedData: async (_typedData: unknown) => "0xsigned",
      };
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should define abstract methods (TypeScript only - not a runtime check)", () => {});

  it("should track initialization via analytics", () => {
    new MockWalletProvider();

    return new Promise(resolve =>
      setTimeout(() => {
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
      }, 0),
    );
  });

  it("should handle tracking failures gracefully", () => {
    (sendAnalyticsEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Test error");
    });

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    new MockWalletProvider();

    return new Promise(resolve =>
      setTimeout(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Failed to track wallet provider initialization:",
          expect.any(Error),
        );
        consoleWarnSpy.mockRestore();
        resolve(null);
      }, 0),
    );
  });

  it("should convert wallet provider to signer", () => {
    const provider = new MockWalletProvider();
    const signer = provider.toSigner();

    expect(signer).toBeDefined();
    expect(signer.address).toBe(MOCK_ADDRESS);
    expect(signer.signMessage).toBeDefined();
    expect(signer.signTransaction).toBeDefined();
    expect(signer.signTypedData).toBeDefined();
  });
});
