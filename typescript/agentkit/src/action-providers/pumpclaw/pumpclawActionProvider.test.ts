import { EvmWalletProvider } from "../../wallet-providers";
import { PumpclawActionProvider } from "./pumpclawActionProvider";
import { getFactoryAddress, getSwapRouterAddress } from "./constants";

describe("PumpclawActionProvider", () => {
  const MOCK_TOKEN_ADDRESS =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const MOCK_POOL_ADDRESS =
    "0x2345678901234567890123456789012345678901" as `0x${string}`;
  const MOCK_CREATOR_ADDRESS =
    "0x3456789012345678901234567890123456789012" as `0x${string}`;
  const MOCK_WALLET_ADDRESS =
    "0x9876543210987654321098765432109876543210" as `0x${string}`;
  const MOCK_TX_HASH = "0xabcdef1234567890";
  const MOCK_TOTAL_SUPPLY = "1000000000000000000000000000"; // 1B tokens
  const MOCK_INITIAL_FDV = "10000000000000000000"; // 10 ETH

  let provider: PumpclawActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_WALLET_ADDRESS),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest
        .fn()
        .mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    provider = new PumpclawActionProvider();
  });

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);
    });

    it("should not support base-sepolia", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-sepolia",
        }),
      ).toBe(false);
    });

    it("should not support non-EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "bitcoin",
          networkId: "base-mainnet",
        }),
      ).toBe(false);
    });
  });

  describe("createToken", () => {
    it("should create a token successfully", async () => {
      const response = await provider.createToken(mockWallet, {
        name: "Test Token",
        symbol: "TEST",
        imageUrl: "https://example.com/image.png",
        totalSupply: MOCK_TOTAL_SUPPLY,
        initialFdv: MOCK_INITIAL_FDV,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: getFactoryAddress("base-mainnet"),
        }),
      );
      expect(response).toContain("Successfully created");
      expect(response).toContain("Test Token");
      expect(response).toContain("TEST");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle creation failure", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("create failed"));

      const response = await provider.createToken(mockWallet, {
        name: "Test Token",
        symbol: "TEST",
        imageUrl: "https://example.com/image.png",
        totalSupply: MOCK_TOTAL_SUPPLY,
        initialFdv: MOCK_INITIAL_FDV,
      });
      expect(response).toContain("Error creating");
    });
  });

  describe("getTokenInfo", () => {
    beforeEach(() => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "getTokenInfo") {
          return Promise.resolve([
            "Test Token",
            "TEST",
            "https://example.com/image.png",
            BigInt(MOCK_TOTAL_SUPPLY),
            MOCK_CREATOR_ADDRESS,
            MOCK_POOL_ADDRESS,
            BigInt(1640995200),
          ]);
        }
        if (params.functionName === "decimals") {
          return Promise.resolve(18);
        }
        return Promise.resolve(null);
      });
    });

    it("should return token information", async () => {
      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });

      expect(mockWallet.readContract).toHaveBeenCalled();
      expect(response).toContain("Test Token");
      expect(response).toContain("TEST");
      expect(response).toContain("https://example.com/image.png");
      expect(response).toContain(MOCK_CREATOR_ADDRESS);
      expect(response).toContain(MOCK_POOL_ADDRESS);
    });

    it("should handle non-existent token", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "getTokenInfo") {
          return Promise.resolve([
            "",
            "",
            "",
            BigInt(0),
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            BigInt(0),
          ]);
        }
        return Promise.resolve(null);
      });

      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });
      expect(response).toContain("not a valid PumpClaw token");
    });

    it("should handle errors", async () => {
      mockWallet.readContract.mockRejectedValue(new Error("read failed"));

      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });
      expect(response).toContain("Error getting token information");
    });
  });

  describe("listTokens", () => {
    it("should list tokens successfully", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "getTokenCount") {
          return Promise.resolve(BigInt(5));
        }
        if (params.functionName === "getTokens") {
          return Promise.resolve([
            MOCK_TOKEN_ADDRESS,
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
          ]);
        }
        return Promise.resolve(null);
      });

      const response = await provider.listTokens(mockWallet, {
        offset: 0,
        limit: 10,
      });

      expect(response).toContain("showing 3 of 5 total");
      expect(response).toContain(MOCK_TOKEN_ADDRESS);
    });

    it("should handle empty list", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "getTokenCount") {
          return Promise.resolve(BigInt(0));
        }
        return Promise.resolve(null);
      });

      const response = await provider.listTokens(mockWallet, {
        offset: 0,
        limit: 10,
      });
      expect(response).toContain("No PumpClaw tokens");
    });

    it("should handle offset beyond token count", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "getTokenCount") {
          return Promise.resolve(BigInt(5));
        }
        if (params.functionName === "getTokens") {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });

      const response = await provider.listTokens(mockWallet, {
        offset: 10,
        limit: 10,
      });
      expect(response).toContain("No tokens found at offset 10");
    });
  });

  describe("buyToken", () => {
    it("should buy tokens successfully", async () => {
      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        ethAmount: "1000000000000000000",
        minTokensOut: "0",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: getSwapRouterAddress("base-mainnet"),
          value: BigInt("1000000000000000000"),
        }),
      );
      expect(response).toContain("Successfully bought");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle buy failure", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("buy failed"));

      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        ethAmount: "1000000000000000000",
        minTokensOut: "0",
      });
      expect(response).toContain("Error buying");
    });
  });

  describe("sellToken", () => {
    beforeEach(() => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "balanceOf") {
          return Promise.resolve(BigInt("2000000000000000000"));
        }
        if (params.functionName === "allowance") {
          return Promise.resolve(BigInt(0));
        }
        return Promise.resolve(null);
      });
    });

    it("should sell tokens successfully with approval", async () => {
      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensIn: "1000000000000000000",
        minEthOut: "0",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2); // approve + sell
      expect(response).toContain("Successfully sold");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should sell tokens without approval if already approved", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "balanceOf") {
          return Promise.resolve(BigInt("2000000000000000000"));
        }
        if (params.functionName === "allowance") {
          return Promise.resolve(BigInt("2000000000000000000"));
        }
        return Promise.resolve(null);
      });

      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensIn: "1000000000000000000",
        minEthOut: "0",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1); // only sell
      expect(response).toContain("Successfully sold");
    });

    it("should reject when balance is insufficient", async () => {
      mockWallet.readContract.mockImplementation((params: any) => {
        if (params.functionName === "balanceOf") {
          return Promise.resolve(BigInt("100"));
        }
        return Promise.resolve(null);
      });

      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensIn: "1000000000000000000",
        minEthOut: "0",
      });
      expect(response).toContain("Insufficient balance");
    });

    it("should handle sell failure", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("sell failed"));

      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensIn: "1000000000000000000",
        minEthOut: "0",
      });
      expect(response).toContain("Error selling");
    });
  });

  describe("setImageUrl", () => {
    it("should set image URL successfully", async () => {
      const response = await provider.setImageUrl(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        imageUrl: "https://example.com/new-image.png",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: getFactoryAddress("base-mainnet"),
        }),
      );
      expect(response).toContain("Successfully updated");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle non-creator error", async () => {
      mockWallet.sendTransaction.mockRejectedValue(
        new Error("Only creator can update"),
      );

      const response = await provider.setImageUrl(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        imageUrl: "https://example.com/new-image.png",
      });
      expect(response).toContain("Error updating");
      expect(response).toContain("Only the token creator");
    });
  });
});
