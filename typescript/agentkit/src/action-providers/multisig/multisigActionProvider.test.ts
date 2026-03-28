import { multisigActionProvider, MultisigActionProvider } from "./multisigActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

describe("MultisigActionProvider", () => {
  let provider: MultisigActionProvider;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = multisigActionProvider();

    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      sign: jest.fn().mockResolvedValue(
        "0x" + "ab".repeat(65), // Mock signature
      ),
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
      signTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      nativeTransfer: jest.fn(),
      getBalance: jest.fn(),
      getName: jest.fn().mockReturnValue("mock-wallet"),
      readContract: jest.fn(),
      getPublicClient: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("signDigest", () => {
    const validDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    it("should sign a valid digest without 0x prefix", async () => {
      const result = await provider.signDigest(mockWalletProvider, { digest: validDigest });

      expect(mockWalletProvider.sign).toHaveBeenCalledWith(`0x${validDigest}`);
      expect(result).toContain("Digest signed successfully");
      expect(result).toContain("Signature:");
    });

    it("should sign a valid digest with 0x prefix", async () => {
      const result = await provider.signDigest(mockWalletProvider, {
        digest: `0x${validDigest}`,
      });

      expect(mockWalletProvider.sign).toHaveBeenCalledWith(`0x${validDigest}`);
      expect(result).toContain("Digest signed successfully");
    });

    it("should handle uppercase digest", async () => {
      const result = await provider.signDigest(mockWalletProvider, {
        digest: validDigest.toUpperCase(),
      });

      expect(mockWalletProvider.sign).toHaveBeenCalledWith(`0x${validDigest}`);
      expect(result).toContain("Digest signed successfully");
    });

    it("should reject digest with wrong length", async () => {
      const result = await provider.signDigest(mockWalletProvider, { digest: "abc123" });

      expect(mockWalletProvider.sign).not.toHaveBeenCalled();
      expect(result).toContain("Error: Digest must be exactly 32 bytes");
    });

    it("should handle signing errors", async () => {
      mockWalletProvider.sign.mockRejectedValueOnce(new Error("Signing failed"));

      const result = await provider.signDigest(mockWalletProvider, { digest: validDigest });

      expect(result).toContain("Error signing digest");
    });
  });

  describe("signSafeTransaction", () => {
    const validSafeTxHash = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd";
    const safeAddress = "0xSafe1234567890123456789012345678901234";

    it("should sign a valid Safe transaction hash", async () => {
      const result = await provider.signSafeTransaction(mockWalletProvider, {
        safeAddress,
        safeTxHash: validSafeTxHash,
      });

      expect(mockWalletProvider.sign).toHaveBeenCalledWith(`0x${validSafeTxHash}`);
      expect(result).toContain("Safe transaction signed successfully");
      expect(result).toContain(safeAddress);
    });

    it("should handle 0x prefix in safeTxHash", async () => {
      const result = await provider.signSafeTransaction(mockWalletProvider, {
        safeAddress,
        safeTxHash: `0x${validSafeTxHash}`,
      });

      expect(mockWalletProvider.sign).toHaveBeenCalledWith(`0x${validSafeTxHash}`);
      expect(result).toContain("Safe transaction signed successfully");
    });

    it("should reject invalid safeTxHash length", async () => {
      const result = await provider.signSafeTransaction(mockWalletProvider, {
        safeAddress,
        safeTxHash: "invalid",
      });

      expect(mockWalletProvider.sign).not.toHaveBeenCalled();
      expect(result).toContain("Error: safeTxHash must be exactly 32 bytes");
    });
  });

  describe("getMultisigPubkey", () => {
    it("should return wallet address and network info", async () => {
      const result = await provider.getMultisigPubkey(mockWalletProvider, {});

      expect(result).toContain("Multisig Public Key Info");
      expect(result).toContain("0x1234567890123456789012345678901234567890");
      expect(result).toContain("base-mainnet");
      expect(result).toContain("evm");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      const network = { protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      const network = { protocolFamily: "svm", networkId: "solana-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });

    it("should return false for Bitcoin networks", () => {
      const network = { protocolFamily: "bitcoin", networkId: "bitcoin-mainnet" };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });
});
