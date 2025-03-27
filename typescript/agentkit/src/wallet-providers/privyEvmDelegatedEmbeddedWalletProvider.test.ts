import axios from "axios";
import { PrivyEvmDelegatedEmbeddedWalletProvider } from "./privyEvmDelegatedEmbeddedWalletProvider";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("PrivyEvmDelegatedEmbeddedWalletProvider", () => {
  const mockConfig = {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    authorizationPrivateKey: "test-auth-key",
    walletId: "test-wallet-id",
    networkId: "base-sepolia",
  };

  const mockWalletAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the wallet fetch API call
    mockedAxios.get.mockResolvedValue({
      data: {
        address: mockWalletAddress,
      },
    });

    // Mock all other API calls
    mockedAxios.post.mockResolvedValue({
      data: {
        data: {
          signature: "0xsignature",
          hash: "0xhash",
          result: "0x1000",
        },
      },
    });
  });

  describe("configureWithWallet", () => {
    it("should fetch wallet address and create provider", async () => {
      const provider =
        await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://api.privy.io/v1/wallets/${mockConfig.walletId}`,
        expect.any(Object),
      );

      expect(provider.getAddress()).toBe(mockWalletAddress);
      expect(provider.getNetwork().networkId).toBe(mockConfig.networkId);
      expect(provider.getName()).toBe("privy_embedded_wallet_provider");
    });

    it("should throw an error if wallet address cannot be fetched", async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} });

      await expect(
        PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(mockConfig),
      ).rejects.toThrow("Could not find wallet address for wallet ID");
    });
  });

  describe("wallet operations", () => {
    let provider: PrivyEvmDelegatedEmbeddedWalletProvider;

    beforeEach(async () => {
      provider = await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(mockConfig);
    });

    it("should sign messages", async () => {
      const signature = await provider.signMessage("Hello, world!");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.privy.io/v1/wallets/rpc",
        expect.objectContaining({
          address: mockWalletAddress,
          chain_type: "ethereum",
          method: "personal_sign",
          params: expect.objectContaining({
            message: "Hello, world!",
          }),
        }),
        expect.any(Object),
      );

      expect(signature).toBe("0xsignature");
    });

    it("should send transactions", async () => {
      const transaction = {
        to: "0xrecipient" as `0x${string}`,
        value: BigInt(1000),
        data: "0xdata" as `0x${string}`,
      };

      const hash = await provider.sendTransaction(transaction);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.privy.io/v1/wallets/rpc",
        expect.objectContaining({
          address: mockWalletAddress,
          chain_type: "ethereum",
          method: "eth_sendTransaction",
          params: expect.objectContaining({
            transaction: expect.objectContaining({
              to: transaction.to,
              value: transaction.value,
              data: transaction.data,
            }),
          }),
        }),
        expect.any(Object),
      );

      expect(hash).toBe("0xhash");
    });

    it("should get balance", async () => {
      const balance = await provider.getBalance();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.privy.io/v1/wallets/rpc",
        expect.objectContaining({
          address: mockWalletAddress,
          chain_type: "ethereum",
          method: "eth_getBalance",
          params: [mockWalletAddress, "latest"],
        }),
        expect.any(Object),
      );

      expect(balance).toBe(BigInt("0x1000"));
    });

    it("should perform native transfers", async () => {
      const hash = await provider.nativeTransfer("0xrecipient", "1000");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.privy.io/v1/wallets/rpc",
        expect.objectContaining({
          address: mockWalletAddress,
          chain_type: "ethereum",
          method: "eth_sendTransaction",
          params: expect.objectContaining({
            transaction: expect.objectContaining({
              to: "0xrecipient",
              value: "0x3e8", // hex for 1000
            }),
          }),
        }),
        expect.any(Object),
      );

      expect(hash).toBe("0xhash");
    });

    it("should export wallet data", () => {
      const walletData = provider.exportWallet();

      expect(walletData).toEqual({
        walletId: mockConfig.walletId,
        networkId: mockConfig.networkId,
        chainId: expect.any(String),
      });
    });
  });
});
