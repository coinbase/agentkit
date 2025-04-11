import {
  PrivyEvmDelegatedEmbeddedWalletConfig,
  PrivyEvmDelegatedEmbeddedWalletProvider,
} from "./privyEvmDelegatedEmbeddedWalletProvider";
import { Address, Hex } from "viem";

global.fetch = jest.fn().mockImplementation(async (url, init) => {
  if (!init?.headers?.["privy-authorization-signature"]) {
    throw new Error("Missing privy-authorization-signature header");
  }
  if (!init?.headers?.["privy-app-id"]) {
    throw new Error("Missing privy-app-id header");
  }

  const body = JSON.parse(init.body as string);

  if (url.includes("wallets/rpc")) {
    if (body.method === "personal_sign") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { signature: "0x1234" } }),
      } as Response);
    }
    if (body.method === "eth_signTypedData_v4") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ signature: "0x1234" }),
      } as Response);
    }
    if (body.method === "eth_signTransaction") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { signed_transaction: "0x1234" } }),
      } as Response);
    }
    if (body.method === "eth_sendTransaction") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { hash: "0xef01" } }),
      } as Response);
    }
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response);
});

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_WALLET_ID = "test-wallet-id";
const MOCK_TRANSACTION_HASH = "0xef01";
const MOCK_SIGNATURE = "0x1234";

jest.mock("../network", () => {
  const chain = {
    id: 84532,
    name: "Base Sepolia",
    rpcUrls: {
      default: { http: ["https://sepolia.base.org"] },
    },
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  };

  return {
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      chainId: "84532",
      networkId: "base-sepolia",
    }),
    getChain: jest.fn().mockReturnValue(chain),
    NETWORK_ID_TO_CHAIN_ID: {
      "base-sepolia": "84532",
    },
  };
});

jest.mock("viem", () => {
  const originalModule = jest.requireActual("viem");
  return {
    ...originalModule,
    createPublicClient: jest.fn().mockReturnValue({
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({
        transactionHash: "0xef01",
        status: "success",
      }),
      readContract: jest.fn().mockResolvedValue("mock_result"),
    }),
    parseEther: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
  };
});

jest.mock("./privyShared", () => ({
  createPrivyClient: jest.fn().mockReturnValue({
    getUser: jest.fn().mockResolvedValue({
      linkedAccounts: [
        {
          type: "wallet",
          walletClientType: "privy",
          address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        },
      ],
    }),
  }),
}));

jest.mock("canonicalize", () => {
  const mockFn = jest.fn().mockImplementation((obj: unknown) => {
    const replacer = (key: string, value: unknown) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
    return JSON.stringify(obj, replacer);
  });
  return mockFn;
});

jest.mock("crypto", () => ({
  createPrivateKey: jest.fn().mockImplementation(() => ({})),
  sign: jest.fn().mockImplementation(() => Buffer.from("mock-signature")),
}));

describe("PrivyEvmDelegatedEmbeddedWalletProvider", () => {
  const MOCK_CONFIG = {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    authorizationPrivateKey: "wallet-auth:test-auth-key",
    walletId: MOCK_WALLET_ID,
    networkId: "base-sepolia",
    walletType: "embedded" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("configureWithWallet", () => {
    it("should configure with required configuration", async () => {
      const provider =
        await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(provider).toBeInstanceOf(PrivyEvmDelegatedEmbeddedWalletProvider);
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "84532",
        networkId: "base-sepolia",
      });
    });

    it("should throw error if walletId is missing", async () => {
      const { walletId: _walletId, ...configWithoutWalletId } = MOCK_CONFIG;
      await expect(
        PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(
          configWithoutWalletId as PrivyEvmDelegatedEmbeddedWalletConfig,
        ),
      ).rejects.toThrow("walletId is required");
    });

    it("should throw error if appId or appSecret is missing", async () => {
      const { appId: _appId, ...configWithoutAppId } = MOCK_CONFIG;
      await expect(
        PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(
          configWithoutAppId as PrivyEvmDelegatedEmbeddedWalletConfig,
        ),
      ).rejects.toThrow("appId and appSecret are required");
    });

    it("should throw error if authorizationPrivateKey is missing", async () => {
      const { authorizationPrivateKey: _authKey, ...configWithoutAuthKey } = MOCK_CONFIG;
      await expect(
        PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(configWithoutAuthKey),
      ).rejects.toThrow("authorizationPrivateKey is required");
    });
  });

  describe("wallet methods", () => {
    let provider: PrivyEvmDelegatedEmbeddedWalletProvider;

    beforeEach(async () => {
      provider = await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(MOCK_CONFIG);
    });

    it("should get the wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "84532",
        networkId: "base-sepolia",
      });
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("privy_evm_embedded_wallet_provider");
    });

    it("should get the wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt(1000000000000000000));
    });

    it("should sign a message", async () => {
      const result = await provider.signMessage("Hello, world!");
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should sign typed data", async () => {
      const typedData = {
        domain: { name: "Test" },
        types: { Test: [{ name: "test", type: "string" }] },
        primaryType: "Test",
        message: { test: "test" },
      };

      const result = await provider.signTypedData(typedData);
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should sign a transaction", async () => {
      const transaction = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      const result = await provider.signTransaction(transaction);
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should send a transaction", async () => {
      const transaction = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      const result = await provider.sendTransaction(transaction);
      expect(result).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should wait for transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex);
      expect(receipt).toEqual({
        transactionHash: MOCK_TRANSACTION_HASH,
        status: "success",
      });
    });

    it("should transfer native tokens", async () => {
      const result = await provider.nativeTransfer(
        "0x1234567890123456789012345678901234567890",
        "1.0",
      );
      expect(result).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should export wallet data", () => {
      const exportData = provider.exportWallet();
      expect(exportData).toEqual({
        walletId: MOCK_WALLET_ID,
        authorizationPrivateKey: MOCK_CONFIG.authorizationPrivateKey,
        networkId: "base-sepolia",
        chainId: "84532",
      });
    });

    it("should read contract data", async () => {
      const abi = [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
          stateMutability: "view",
        },
      ] as const;

      const result = await provider.readContract({
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS as Address],
      });

      expect(result).toBe("mock_result");
    });

    describe("request signing", () => {
      it("should include required headers in requests", async () => {
        const transaction = {
          to: "0x1234567890123456789012345678901234567890" as Address,
          value: BigInt(1000000000000000000),
        };

        await provider.sendTransaction(transaction);

        expect(global.fetch).toHaveBeenCalled();
        const lastCall = (global.fetch as jest.Mock).mock.calls[
          (global.fetch as jest.Mock).mock.calls.length - 1
        ];
        const [_url, init] = lastCall;

        expect(init.headers).toBeDefined();
        expect(init.headers["privy-authorization-signature"]).toBeDefined();
        expect(init.headers["privy-app-id"]).toBe("test-app-id");
        expect(init.headers["Authorization"]).toBeDefined();
      });

      it("should handle signature generation errors", async () => {
        const canonicalize = jest.requireMock("canonicalize");
        canonicalize.mockImplementationOnce(() => null); // Force canonicalization failure

        const transaction = {
          to: "0x1234567890123456789012345678901234567890" as Address,
          value: BigInt(1000000000000000000),
        };

        await expect(provider.sendTransaction(transaction)).rejects.toThrow(
          "Error generating Privy authorization signature",
        );
      });

      it("should handle HTTP errors", async () => {
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
          } as Response),
        );

        const transaction = {
          to: "0x1234567890123456789012345678901234567890" as Address,
          value: BigInt(1000000000000000000),
        };

        await expect(provider.sendTransaction(transaction)).rejects.toThrow(
          "Privy request failed: HTTP error! status: 400",
        );
      });
    });
  });
});
