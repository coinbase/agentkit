import { encodeFunctionData } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { MintclubActionProvider } from "./mintclubActionProvider";
import { MCV2_BOND_ABI, ERC20_ABI, getBondAddress } from "./constants";
import {
  getTokenBond,
  getTokenInfo,
  getBuyQuote,
  getSellQuote,
  getUsdRate,
  needsApproval,
} from "./utils";
import {
  MintclubGetTokenInfoInput,
  MintclubGetTokenPriceInput,
  MintclubBuyTokenInput,
  MintclubSellTokenInput,
  MintclubCreateTokenInput,
} from "./schemas";

jest.mock("./utils", () => ({
  getTokenBond: jest.fn(),
  getTokenInfo: jest.fn(),
  getBuyQuote: jest.fn(),
  getSellQuote: jest.fn(),
  getUsdRate: jest.fn(),
  needsApproval: jest.fn(),
}));

describe("MintclubActionProvider", () => {
  const MOCK_TOKEN_ADDRESS =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const MOCK_RESERVE_TOKEN =
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
  const MOCK_TOKENS_WEI = "1000000000000000000";
  const MOCK_RESERVE_AMOUNT = "1000000";
  const MOCK_TX_HASH = "0xabcdef1234567890";
  const MOCK_WALLET_ADDRESS =
    "0x9876543210987654321098765432109876543210" as `0x${string}`;
  const MOCK_MAX_SUPPLY = "1000000000000000000000000";

  let provider: MintclubActionProvider;
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

    provider = new MintclubActionProvider();

    (getTokenInfo as jest.Mock).mockResolvedValue({
      symbol: "TEST",
      decimals: 18,
      totalSupply: "1000000000000000000000",
      formattedSupply: "1000.0",
    });

    (getTokenBond as jest.Mock).mockResolvedValue({
      creator: MOCK_WALLET_ADDRESS,
      mintRoyalty: 100,
      burnRoyalty: 100,
      createdAt: 1640995200,
      reserveToken: MOCK_RESERVE_TOKEN,
      reserveBalance: "1000000000000000000",
    });

    (getBuyQuote as jest.Mock).mockResolvedValue({
      reserveAmount: MOCK_RESERVE_AMOUNT,
      royalty: "10000",
    });

    (getSellQuote as jest.Mock).mockResolvedValue({
      refundAmount: MOCK_RESERVE_AMOUNT,
      royalty: "10000",
    });

    (getUsdRate as jest.Mock).mockResolvedValue(1.0);
    (needsApproval as jest.Mock).mockResolvedValue(false);
  });

  describe("Input Validation", () => {
    it("should reject invalid address in getTokenInfo", () => {
      const result = MintclubGetTokenInfoInput.safeParse({
        tokenAddress: "0xinvalid",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid getTokenInfo input", () => {
      const result = MintclubGetTokenInfoInput.safeParse({
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid amount in getTokenPrice", () => {
      const result = MintclubGetTokenPriceInput.safeParse({
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "abc",
      });
      expect(result.success).toBe(false);
    });

    it("should reject decimal wei in buyToken", () => {
      const result = MintclubBuyTokenInput.safeParse({
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: "1.5",
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid buyToken input", () => {
      const result = MintclubBuyTokenInput.safeParse({
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: MOCK_TOKENS_WEI,
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });
      expect(result.success).toBe(true);
    });

    it("should reject royalty exceeding max in createToken", () => {
      const result = MintclubCreateTokenInput.safeParse({
        name: "Test",
        symbol: "TST",
        reserveToken: MOCK_RESERVE_TOKEN,
        maxSupply: MOCK_MAX_SUPPLY,
        stepRanges: [MOCK_MAX_SUPPLY],
        stepPrices: ["1000000000000000"],
        mintRoyalty: 6000,
        burnRoyalty: 100,
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid createToken input", () => {
      const result = MintclubCreateTokenInput.safeParse({
        name: "Test Token",
        symbol: "TST",
        reserveToken: MOCK_RESERVE_TOKEN,
        maxSupply: MOCK_MAX_SUPPLY,
        stepRanges: ["500000000000000000000000", MOCK_MAX_SUPPLY],
        stepPrices: ["1000000000000000", "10000000000000000"],
        mintRoyalty: 100,
        burnRoyalty: 100,
      });
      expect(result.success).toBe(true);
    });
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

  describe("getTokenInfo", () => {
    it("should return token and bond information", async () => {
      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });

      expect(getTokenInfo).toHaveBeenCalledWith(mockWallet, MOCK_TOKEN_ADDRESS);
      expect(getTokenBond).toHaveBeenCalledWith(mockWallet, MOCK_TOKEN_ADDRESS);
      expect(response).toContain("TEST");
      expect(response).toContain("1000.0");
      expect(response).toContain("1.00%");
    });

    it("should handle non-existent token", async () => {
      (getTokenInfo as jest.Mock).mockResolvedValue(null);

      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });
      expect(response).toContain("Error");
    });

    it("should handle non-Mint Club token", async () => {
      (getTokenBond as jest.Mock).mockResolvedValue(null);

      const response = await provider.getTokenInfo(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
      });
      expect(response).toContain("not a Mint Club V2 token");
    });
  });

  describe("getTokenPrice", () => {
    it("should return price with USD value", async () => {
      const response = await provider.getTokenPrice(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "1.0",
      });

      expect(getBuyQuote).toHaveBeenCalled();
      expect(response).toContain("Price for 1.0 TEST");
      expect(response).toContain("USD Value");
    });

    it("should handle missing quote", async () => {
      (getBuyQuote as jest.Mock).mockResolvedValue(null);

      const response = await provider.getTokenPrice(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "1.0",
      });
      expect(response).toContain("Error");
    });
  });

  describe("buyToken", () => {
    it("should buy tokens without needing approval", async () => {
      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: MOCK_TOKENS_WEI,
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(response).toContain("Successfully minted");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle approval + buy when needed", async () => {
      (needsApproval as jest.Mock).mockResolvedValue(true);

      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: MOCK_TOKENS_WEI,
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
      expect(response).toContain("Successfully minted");
    });

    it("should handle non-Mint Club token", async () => {
      (getTokenBond as jest.Mock).mockResolvedValue(null);

      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: MOCK_TOKENS_WEI,
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });
      expect(response).toContain("not a valid Mint Club V2 token");
    });

    it("should handle transaction failure", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("tx failed"));

      const response = await provider.buyToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToMint: MOCK_TOKENS_WEI,
        maxReserveAmount: MOCK_RESERVE_AMOUNT,
      });
      expect(response).toContain("Error buying");
    });
  });

  describe("sellToken", () => {
    beforeEach(() => {
      mockWallet.readContract.mockResolvedValue(
        BigInt("2000000000000000000"),
      );
    });

    it("should sell tokens successfully", async () => {
      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToBurn: MOCK_TOKENS_WEI,
        minRefund: MOCK_RESERVE_AMOUNT,
      });

      expect(response).toContain("Successfully sold");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should reject when balance is insufficient", async () => {
      mockWallet.readContract.mockResolvedValue(BigInt("100"));

      const response = await provider.sellToken(mockWallet, {
        tokenAddress: MOCK_TOKEN_ADDRESS,
        tokensToBurn: MOCK_TOKENS_WEI,
        minRefund: MOCK_RESERVE_AMOUNT,
      });
      expect(response).toContain("Insufficient balance");
    });
  });

  describe("createToken", () => {
    beforeEach(() => {
      // Mock creationFee
      mockWallet.readContract.mockResolvedValue(BigInt(0));
    });

    it("should create a token successfully", async () => {
      const response = await provider.createToken(mockWallet, {
        name: "Test Token",
        symbol: "TST",
        reserveToken: MOCK_RESERVE_TOKEN,
        maxSupply: MOCK_MAX_SUPPLY,
        stepRanges: [MOCK_MAX_SUPPLY],
        stepPrices: ["1000000000000000"],
        mintRoyalty: 100,
        burnRoyalty: 100,
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: getBondAddress("base-mainnet"),
          value: BigInt(0),
        }),
      );
      expect(response).toContain("Successfully created");
      expect(response).toContain("Test Token");
      expect(response).toContain("TST");
    });

    it("should handle creation failure", async () => {
      mockWallet.sendTransaction.mockRejectedValue(
        new Error("create failed"),
      );

      const response = await provider.createToken(mockWallet, {
        name: "Test Token",
        symbol: "TST",
        reserveToken: MOCK_RESERVE_TOKEN,
        maxSupply: MOCK_MAX_SUPPLY,
        stepRanges: [MOCK_MAX_SUPPLY],
        stepPrices: ["1000000000000000"],
        mintRoyalty: 100,
        burnRoyalty: 100,
      });
      expect(response).toContain("Error creating");
    });
  });
});
