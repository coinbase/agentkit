import { MagicEdenActionProvider } from "./magicEdenActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { ME_EVM_BASE_URL } from "./constants";
import { toMagicEdenChain } from "./utils";

const MOCK_ADDRESS = "0xB9efAb38497079b1f35f9E506cEC87203eb4B0ed";
const MOCK_CHAIN_ID = 8453;
const MOCK_NETWORK = {
  chainId: MOCK_CHAIN_ID,
  networkId: "base-mainnet",
  protocolFamily: "evm",
};

describe("MagicEdenActionProvider", () => {
  let actionProvider: MagicEdenActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    actionProvider = new MagicEdenActionProvider();

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(MOCK_NETWORK),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      signTypedData: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("bidMagicEden", () => {
    it("should successfully bid on an NFT", async () => {
      const args = {
        weiPrice: "300000000000000",
        expirationTime: "1738894926",
        apiKey: "test_api_key",
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        // collection not provided
      };

      const fakeResponse = {
        steps: [
          {
            id: "dummy",
            action: "dummy action",
            description: "dummy",
            kind: "transaction",
            items: [
              {
                status: "complete",
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => fakeResponse,
      });

      const response = await actionProvider.bidMagicEden(mockWallet, args);
      const chainName = toMagicEdenChain(MOCK_CHAIN_ID);

      expect(response).toContain("Successfully placed bid");
      expect(global.fetch).toHaveBeenCalledWith(
        `${ME_EVM_BASE_URL}/${chainName}/execute/bid/v5`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.apiKey}`,
          }),
          body: expect.any(String),
        }),
      );
    });

    it("should return an error if fetch fails for bid", async () => {
      const args = {
        weiPrice: "300000000000000",
        expirationTime: "1738894926",
        apiKey: "test_api_key",
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad Request" }),
      });

      const response = await actionProvider.bidMagicEden(mockWallet, args);
      expect(response).toContain("Error placing bid");
    });
  });

  describe("buyMagicEden", () => {
    it("should successfully buy an NFT using a specific token", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        apiKey: "test_api_key",
      };

      const fakeResponse = {
        steps: [
          {
            id: "dummy",
            action: "dummy action",
            description: "dummy",
            kind: "transaction",
            items: [{ status: "complete" }],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => fakeResponse,
      });

      const response = await actionProvider.buyMagicEden(mockWallet, args);
      const chainName = toMagicEdenChain(MOCK_CHAIN_ID);
      expect(response).toContain("Successfully placed buy");
      expect(global.fetch).toHaveBeenCalledWith(
        `${ME_EVM_BASE_URL}/${chainName}/execute/buy/v7`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.apiKey}`,
          }),
          body: expect.any(String),
        }),
      );
    });

    it("should return an error if fetch fails for buy", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        apiKey: "test_api_key",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad Request" }),
      });

      const response = await actionProvider.buyMagicEden(mockWallet, args);
      expect(response).toContain("Error placing buy");
    });
  });

  describe("listMagicEden", () => {
    it("should successfully list an NFT", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        weiPrice: "3000000000000000",
        expirationTime: "1738894926",
        apiKey: "test_api_key",
      };

      const fakeResponse = {
        steps: [
          {
            id: "dummy",
            action: "dummy action",
            description: "dummy",
            kind: "transaction",
            items: [{ status: "complete" }],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => fakeResponse,
      });

      const response = await actionProvider.listMagicEden(mockWallet, args);
      const chainName = toMagicEdenChain(MOCK_CHAIN_ID);
      expect(response).toContain("Successfully placed list");
      expect(global.fetch).toHaveBeenCalledWith(
        `${ME_EVM_BASE_URL}/${chainName}/execute/list/v5`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.apiKey}`,
          }),
          body: expect.any(String),
        }),
      );
    });

    it("should return an error if fetch fails for list", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        weiPrice: "3000000000000000",
        expirationTime: "1738894926",
        apiKey: "test_api_key",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad Request" }),
      });

      const response = await actionProvider.listMagicEden(mockWallet, args);
      expect(response).toContain("Error placing list");
    });
  });

  describe("sellMagicEden", () => {
    it("should successfully accept an offer (sell NFT)", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        apiKey: "test_api_key",
      };

      const fakeResponse = {
        steps: [
          {
            id: "dummy",
            action: "dummy action",
            description: "dummy",
            kind: "transaction",
            items: [{ status: "complete" }],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => fakeResponse,
      });

      const response = await actionProvider.sellMagicEden(mockWallet, args);
      const chainName = toMagicEdenChain(MOCK_CHAIN_ID);
      expect(response).toContain("Successfully placed sell");
      expect(global.fetch).toHaveBeenCalledWith(
        `${ME_EVM_BASE_URL}/${chainName}/execute/sell/v7`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.apiKey}`,
          }),
          body: expect.any(String),
        }),
      );
    });

    it("should return an error if fetch fails for sell", async () => {
      const args = {
        token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799",
        apiKey: "test_api_key",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad Request" }),
      });

      const response = await actionProvider.sellMagicEden(mockWallet, args);
      expect(response).toContain("Error placing sell");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for a supported network (base-mainnet)", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: MOCK_CHAIN_ID.toString(),
      });
      expect(result).toBe(true);
    });

    it("should return false for an unsupported network", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "optimism-mainnet",
        chainId: "10",
      });
      expect(result).toBe(false);
    });
  });
});
