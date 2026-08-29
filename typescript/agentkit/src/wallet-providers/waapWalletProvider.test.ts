import { WaapWalletProvider, WaapWalletProviderConfig, WaapWalletExport } from "./waapWalletProvider";
import * as child_process from "child_process";
import { ReadContractParameters, Abi } from "viem";

// =========================================================
// global mocks
// =========================================================

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("child_process", () => ({
  execFileSync: jest.fn(),
  execFile: jest.fn(),
}));

// Intercept promisify so execFileAsync uses our execFile mock with callback semantics.
jest.mock("util", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cp = require("child_process");
  return {
    ...jest.requireActual("util"),
    promisify: (fn: unknown) => {
      if (fn === cp.execFile) {
        return (...args: unknown[]) =>
          new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            (cp.execFile as jest.Mock)(
              ...args,
              (err: Error | null, stdout: string, stderr: string) => {
                if (err) reject(err);
                else resolve({ stdout, stderr });
              },
            );
          });
      }
      return jest.requireActual("util").promisify(fn);
    },
  };
});

const mockPublicClient = {
  getBalance: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
};

jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => mockPublicClient),
  };
});

jest.mock("../network/network", () => ({
  CHAIN_ID_TO_NETWORK_ID: {
    8453: "base-mainnet",
    84532: "base-sepolia",
    1: "ethereum-mainnet",
  },
  getChain: jest.fn().mockImplementation((chainId: string) => {
    if (chainId === "999999") return undefined;
    return {
      id: Number(chainId),
      name: "Base",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
    };
  }),
}));

// =========================================================
// consts
// =========================================================

const MOCK_ADDRESS = "0x6186E6CeD896981DDe6Da33830E697be900c95f5";
const MOCK_SIGNATURE =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab1c";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const MOCK_SIGNED_TX =
  "0x02f87083210580843b9aca00850684ee180082520894dead000000000000000000000000000000000000872386f26fc1000080c0";

const DEFAULT_CONFIG: WaapWalletProviderConfig = {
  chainId: "8453",
  rpcUrl: "https://mainnet.base.org",
  cliPath: "/usr/local/bin/waap-cli",
};

const mockExecFileSync = child_process.execFileSync as jest.MockedFunction<
  typeof child_process.execFileSync
>;
// Cast as jest.Mock (not MockedFunction) to avoid ChildProcess return-type errors in mockImplementation
const mockExecFile = child_process.execFile as unknown as jest.Mock;

/**
 * Sets the return value for both sync and async CLI mocks simultaneously.
 * Use this in tests to control what waap-cli "outputs".
 */
function mockCliOutput(output: string) {
  mockExecFileSync.mockReturnValue(output);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockExecFile.mockImplementation((...args: any[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") cb(null, output, "");
  });
}

// =========================================================
// tests
// =========================================================

describe("WaapWalletProvider", () => {
  let provider: WaapWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    const whoamiOutput = `🔑 Fetching encrypted keyshare ...\n  🔓 Decrypting keyshare ...\n  ✅ Keyshare ready\nWallet address: ${MOCK_ADDRESS}`;
    mockCliOutput(whoamiOutput);
    mockPublicClient.getBalance.mockResolvedValue(BigInt("1000000000000000000"));
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TX_HASH,
    });
    mockPublicClient.readContract.mockResolvedValue("mock_result");
    provider = new WaapWalletProvider(DEFAULT_CONFIG);
  });

  // =========================================================
  // initialization tests
  // =========================================================

  describe("initialization", () => {
    it("should create a provider with valid config", () => {
      expect(provider).toBeInstanceOf(WaapWalletProvider);
    });

    it("should throw for unsupported chain ID", () => {
      expect(
        () =>
          new WaapWalletProvider({
            chainId: "999999",
          }),
      ).toThrow("Unsupported chain ID: 999999");
    });

    it("should use default cliPath when not provided", () => {
      const p = new WaapWalletProvider({ chainId: "8453" });
      p.getAddress();
      expect(mockExecFileSync).toHaveBeenCalledWith("waap-cli", ["whoami"], expect.any(Object));
    });
  });

  // =========================================================
  // basic wallet method tests
  // =========================================================

  describe("basic wallet methods", () => {
    it("should get the address", () => {
      const address = provider.getAddress();
      expect(address).toBe(MOCK_ADDRESS);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["whoami"],
        expect.any(Object),
      );
    });

    it("should cache the address after first call", () => {
      provider.getAddress();
      provider.getAddress();
      const whoamiCalls = mockExecFileSync.mock.calls.filter(
        call => Array.isArray(call[1]) && call[1].includes("whoami"),
      );
      expect(whoamiCalls).toHaveLength(1);
    });

    it("should get the name", () => {
      expect(provider.getName()).toBe("waap_wallet_provider");
    });

    it("should get the network", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "8453",
        networkId: "base-mainnet",
      });
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt("1000000000000000000"));
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_ADDRESS,
      });
    });

    it("should handle connection errors during balance check", async () => {
      mockPublicClient.getBalance.mockRejectedValueOnce(new Error("Network connection error"));
      await expect(provider.getBalance()).rejects.toThrow("Network connection error");
    });

    it("should return the PublicClient", () => {
      const client = provider.getPublicClient();
      expect(client).toBe(mockPublicClient);
    });
  });

  // =========================================================
  // signing operation tests
  // =========================================================

  describe("signing operations", () => {
    it("should sign a raw hash", async () => {
      mockCliOutput(`Signature: ${MOCK_SIGNATURE}`);
      const hash = "0xabcdef1234567890" as `0x${string}`;
      const result = await provider.sign(hash);
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["sign-message", "--message", hash],
        expect.any(Object),
        expect.any(Function),
      );
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should sign a text message", async () => {
      mockCliOutput(`Signature: ${MOCK_SIGNATURE}`);
      const result = await provider.signMessage("Hello, World!");
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["sign-message", "--message", "Hello, World!"],
        expect.any(Object),
        expect.any(Function),
      );
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should convert Uint8Array message to hex", async () => {
      mockCliOutput(`Signature: ${MOCK_SIGNATURE}`);
      const msg = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      await provider.signMessage(msg);
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["sign-message", "--message", "0x48656c6c6f"],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should sign typed data", async () => {
      mockCliOutput(`Signature: ${MOCK_SIGNATURE}`);
      const typedData = {
        domain: { name: "Test", version: "1", chainId: 1 },
        types: { Person: [{ name: "name", type: "string" }] },
        primaryType: "Person",
        message: { name: "Alice" },
      };
      const result = await provider.signTypedData(typedData);
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["sign-typed-data", "--data", JSON.stringify(typedData)],
        expect.any(Object),
        expect.any(Function),
      );
      expect(result).toBe(MOCK_SIGNATURE);
    });

    it("should handle CLI failure during signing", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockExecFile.mockImplementation((...args: any[]) => {
        const cb = args[args.length - 1];
        if (typeof cb === "function") cb(new Error("waap-cli: command not found"), "", "");
      });
      await expect(provider.signMessage("test")).rejects.toThrow("waap-cli: command not found");
    });

    it("should throw when CLI output contains no hex value", async () => {
      mockCliOutput("Error: authentication required");
      await expect(provider.signMessage("test")).rejects.toThrow(
        "Could not extract hex value from waap-cli output",
      );
    });
  });

  // =========================================================
  // transaction operation tests
  // =========================================================

  describe("transaction operations", () => {
    it("should sign a transaction", async () => {
      mockCliOutput(`Signed tx: ${MOCK_SIGNED_TX}`);
      const result = await provider.signTransaction({
        to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
        value: BigInt("10000000000000000"),
      });
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        [
          "sign-tx",
          "--to",
          "0xdead000000000000000000000000000000000000",
          "--value",
          "0.01",
          "--chain-id",
          "8453",
          "--rpc",
          "https://mainnet.base.org",
        ],
        expect.any(Object),
        expect.any(Function),
      );
      expect(result).toBe(MOCK_SIGNED_TX);
    });

    it("should send a transaction and return tx hash", async () => {
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      const result = await provider.sendTransaction({
        to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
        value: BigInt("10000000000000000"),
      });
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        [
          "send-tx",
          "--to",
          "0xdead000000000000000000000000000000000000",
          "--value",
          "0.01",
          "--chain-id",
          "8453",
          "--rpc",
          "https://mainnet.base.org",
        ],
        expect.any(Object),
        expect.any(Function),
      );
      expect(result).toBe(MOCK_TX_HASH);
    });

    it("should include calldata when provided", async () => {
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      await provider.sendTransaction({
        to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
        data: "0xabcdef" as `0x${string}`,
      });
      expect(mockExecFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        [
          "send-tx",
          "--to",
          "0xdead000000000000000000000000000000000000",
          "--value",
          "0",
          "--chain-id",
          "8453",
          "--rpc",
          "https://mainnet.base.org",
          "--data",
          "0xabcdef",
        ],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should omit --rpc when rpcUrl is not configured", async () => {
      const providerNoRpc = new WaapWalletProvider({
        chainId: "8453",
        cliPath: "/usr/local/bin/waap-cli",
      });
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      await providerNoRpc.sendTransaction({
        to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
        value: BigInt("10000000000000000"),
      });
      const callArgs = mockExecFile.mock.calls.find(
        call => Array.isArray(call[1]) && call[1].includes("send-tx"),
      );
      expect(callArgs![1]).not.toContain("--rpc");
    });

    it("should default --value to 0 when value is not provided (required by waap-cli for contract calls)", async () => {
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      await provider.sendTransaction({
        to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
        data: "0x095ea7b3" as `0x${string}`,
      });
      const callArgs = mockExecFile.mock.calls.find(
        call => Array.isArray(call[1]) && call[1].includes("send-tx"),
      );
      expect(callArgs![1]).toContain("--value");
      const valueIdx = callArgs![1].indexOf("--value");
      expect(callArgs![1][valueIdx + 1]).toBe("0");
    });

    it("should handle CLI failure during transaction send", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockExecFile.mockImplementation((...args: any[]) => {
        const cb = args[args.length - 1];
        if (typeof cb === "function") cb(new Error("Transaction rejected by policy engine"), "", "");
      });
      await expect(
        provider.sendTransaction({
          to: "0xdead000000000000000000000000000000000000" as `0x${string}`,
          value: BigInt("10000000000000000"),
        }),
      ).rejects.toThrow("Transaction rejected by policy engine");
    });

    it("should wait for transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(MOCK_TX_HASH as `0x${string}`);
      expect(receipt.transactionHash).toBe(MOCK_TX_HASH);
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: MOCK_TX_HASH,
        timeout: 120_000,
      });
    });

    it("should handle receipt timeout errors", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error("Timed out"));
      await expect(
        provider.waitForTransactionReceipt(MOCK_TX_HASH as `0x${string}`),
      ).rejects.toThrow("Timed out");
    });
  });

  // =========================================================
  // native transfer tests
  // =========================================================

  describe("nativeTransfer", () => {
    it("should return the tx hash from send-tx", async () => {
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      const result = await provider.nativeTransfer(
        "0xdead000000000000000000000000000000000000",
        "10000000000000000",
      );
      expect(result).toBe(MOCK_TX_HASH);
    });

    it("should not call waitForTransactionReceipt (waap-cli confirms before returning)", async () => {
      mockCliOutput(`Transaction hash: ${MOCK_TX_HASH}`);
      await provider.nativeTransfer(
        "0xdead000000000000000000000000000000000000",
        "10000000000000000",
      );
      expect(mockPublicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
    });
  });

  // =========================================================
  // contract interaction tests
  // =========================================================

  describe("contract interactions", () => {
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
        address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        abi,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS as `0x${string}`],
      } as unknown as ReadContractParameters);

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it("should handle contract read errors", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read error"));

      const abi = [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
          stateMutability: "view",
        },
      ] as const;

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          abi,
          functionName: "balanceOf",
          args: [MOCK_ADDRESS as `0x${string}`],
        } as unknown as ReadContractParameters),
      ).rejects.toThrow("Contract read error");
    });
  });

  // =========================================================
  // configureWithWallet tests
  // =========================================================

  describe("configureWithWallet", () => {
    it("should log in when credentials are provided", () => {
      mockCliOutput(`Wallet address: ${MOCK_ADDRESS}`);
      const result = WaapWalletProvider.configureWithWallet({
        ...DEFAULT_CONFIG,
        email: "agent@test.com",
        password: "secret123",
      });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["login", "--email", "agent@test.com", "--password", "secret123"],
        expect.any(Object),
      );
      expect(result).toBeInstanceOf(WaapWalletProvider);
    });

    it("should skip login when no credentials provided", () => {
      const result = WaapWalletProvider.configureWithWallet(DEFAULT_CONFIG);
      const loginCalls = mockExecFileSync.mock.calls.filter(
        call => Array.isArray(call[1]) && call[1].includes("login"),
      );
      expect(loginCalls).toHaveLength(0);
      expect(result).toBeInstanceOf(WaapWalletProvider);
    });

    it("should support multi-agent isolation via + email notation", () => {
      mockCliOutput(`Wallet address: ${MOCK_ADDRESS}`);
      WaapWalletProvider.configureWithWallet({
        ...DEFAULT_CONFIG,
        email: "owner+agent007@example.com",
        password: "secret123",
      });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        DEFAULT_CONFIG.cliPath,
        ["login", "--email", "owner+agent007@example.com", "--password", "secret123"],
        expect.any(Object),
      );
    });

    it("should handle login failure", () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error("Invalid credentials");
      });
      expect(() =>
        WaapWalletProvider.configureWithWallet({
          ...DEFAULT_CONFIG,
          email: "agent@test.com",
          password: "wrong",
        }),
      ).toThrow("Invalid credentials");
    });
  });

  // =========================================================
  // exportWallet tests
  // =========================================================

  describe("exportWallet", () => {
    it("should export wallet data with email and chain info", () => {
      const p = WaapWalletProvider.configureWithWallet({
        ...DEFAULT_CONFIG,
        email: "agent@test.com",
        password: "secret123",
      });
      const exported: WaapWalletExport = p.exportWallet();
      expect(exported.email).toBe("agent@test.com");
      expect(exported.chainId).toBe("8453");
      expect(exported.networkId).toBe("base-mainnet");
      expect(exported.rpcUrl).toBe("https://mainnet.base.org");
    });

    it("should export undefined email when not configured", () => {
      const exported = provider.exportWallet();
      expect(exported.email).toBeUndefined();
      expect(exported.chainId).toBe("8453");
    });

    it("should export undefined rpcUrl when not configured", () => {
      const p = new WaapWalletProvider({ chainId: "8453" });
      const exported = p.exportWallet();
      expect(exported.rpcUrl).toBeUndefined();
    });

    it("exported data is sufficient to reconstruct the provider", () => {
      const p = WaapWalletProvider.configureWithWallet({
        ...DEFAULT_CONFIG,
        email: "agent@test.com",
        password: "secret123",
      });
      const exported = p.exportWallet();

      // Reconstruct — password must be supplied separately (not exported for security)
      const reconstructed = new WaapWalletProvider({
        chainId: exported.chainId,
        rpcUrl: exported.rpcUrl,
        email: exported.email,
      });
      expect(reconstructed.getNetwork().chainId).toBe(exported.chainId);
    });
  });
});
