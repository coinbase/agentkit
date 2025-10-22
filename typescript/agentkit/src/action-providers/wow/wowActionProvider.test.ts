import { encodeFunctionData } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { WowActionProvider } from "./wowActionProvider";
import { WOW_ABI, WOW_FACTORY_ABI, GENERIC_TOKEN_METADATA_URI } from "./constants";
import { getBuyQuote, getSellQuote } from "./utils";
import { getHasGraduated } from "./uniswap/utils";
import { WowBuyTokenInput, WowCreateTokenInput, WowSellTokenInput } from "./schemas";

jest.mock("./utils", () => ({
  getBuyQuote: jest.fn(),
  getSellQuote: jest.fn(),
}));

jest.mock("./uniswap/utils", () => ({
  getHasGraduated: jest.fn(),
}));

describe("WowActionProvider", () => {
  const MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const INVALID_ADDRESS = "0xinvalid" as `0x${string}`;
  const MOCK_AMOUNT_ETH_IN_WEI = BigInt("100000000000000000");
  const INVALID_WEI = "1.5"; // Wei amounts can't have decimals
  const MOCK_AMOUNT_TOKENS_IN_WEI = BigInt("1000000000000000000");
  const MOCK_NAME = "Test Token";
  const MOCK_SYMBOL = "TEST";
  const MOCK_URI = "ipfs://QmY1GqprFYvojCcUEKgqHeDj9uhZD9jmYGrQTfA9vAE78J";
  const INVALID_URI = "not-a-url";
  const MOCK_TX_HASH = "0xabcdef1234567890";
  const MOCK_ADDRESS = "0x9876543210987654321098765432109876543210" as `0x${string}`;

  let provider: WowActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    provider = new WowActionProvider();

    (getBuyQuote as jest.Mock).mockResolvedValue("1000000000000000000");
    (getSellQuote as jest.Mock).mockResolvedValue("1000000000000000000");
    (getHasGraduated as jest.Mock).mockResolvedValue(true);
  });

  describe("Input Validation", () => {
    describe("buyToken", () => {
      it("should validate Ethereum addresses", () => {
        const result = WowBuyTokenInput.safeParse({
          contractAddress: INVALID_ADDRESS,
          amountEthInWei: MOCK_AMOUNT_ETH_IN_WEI.toString(),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("Invalid address");
        }
      });

      it("should validate wei amount format", () => {
        const result = WowBuyTokenInput.safeParse({
          contractAddress: MOCK_CONTRACT_ADDRESS,
          amountEthInWei: INVALID_WEI,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Must be a valid wei amount");
        }
      });

      it("should accept valid input", () => {
        const result = WowBuyTokenInput.safeParse({
          contractAddress: MOCK_CONTRACT_ADDRESS,
          amountEthInWei: MOCK_AMOUNT_ETH_IN_WEI.toString(),
        });
        expect(result.success).toBe(true);
      });
    });

    describe("createToken", () => {
      it("should require non-empty name", () => {
        const result = WowCreateTokenInput.safeParse({
          name: "",
          symbol: MOCK_SYMBOL,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].code).toBe("too_small");
        }
      });

      it("should require non-empty symbol", () => {
        const result = WowCreateTokenInput.safeParse({
          name: MOCK_NAME,
          symbol: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].code).toBe("too_small");
        }
      });

      it("should validate tokenUri format if provided", () => {
        const result = WowCreateTokenInput.safeParse({
          name: MOCK_NAME,
          symbol: MOCK_SYMBOL,
          tokenUri: INVALID_URI,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].code).toBe("invalid_string");
        }
      });

      it("should accept valid input with proper URL", () => {
        const result = WowCreateTokenInput.safeParse({
          name: MOCK_NAME,
          symbol: MOCK_SYMBOL,
          tokenUri: MOCK_URI,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("sellToken", () => {
      it("should validate Ethereum addresses", () => {
        const result = WowSellTokenInput.safeParse({
          contractAddress: INVALID_ADDRESS,
          amountTokensInWei: MOCK_AMOUNT_TOKENS_IN_WEI.toString(),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("Invalid address");
        }
      });

      it("should validate wei amount format", () => {
        const result = WowSellTokenInput.safeParse({
          contractAddress: MOCK_CONTRACT_ADDRESS,
          amountTokensInWei: INVALID_WEI,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Must be a valid wei amount");
        }
      });

      it("should accept valid input", () => {
        const result = WowSellTokenInput.safeParse({
          contractAddress: MOCK_CONTRACT_ADDRESS,
          amountTokensInWei: MOCK_AMOUNT_TOKENS_IN_WEI.toString(),
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("supportsNetwork", () => {
    const testCases = [
      { network: { protocolFamily: "evm", networkId: "base-mainnet" }, expected: true },
      { network: { protocolFamily: "evm", networkId: "base-sepolia" }, expected: true },
      { network: { protocolFamily: "evm", networkId: "ethereum" }, expected: false },
      { network: { protocolFamily: "evm", networkId: "optimism" }, expected: false },
      { network: { protocolFamily: "bitcoin", networkId: "base-mainnet" }, expected: false },
    ];

    testCases.forEach(({ network, expected }) => {
      it(`should ${expected ? "support" : "not support"} ${network.protocolFamily}/${network.networkId}`, () => {
        expect(provider.supportsNetwork(network)).toBe(expected);
      });
    });
  });

  describe("buyToken", () => {
    it("should successfully buy tokens", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT_ADDRESS,
        amountEthInWei: MOCK_AMOUNT_ETH_IN_WEI.toString(),
      };

      const response = await provider.buyToken(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_CONTRACT_ADDRESS,
        data: encodeFunctionData({
          abi: WOW_ABI,
          functionName: "buy",
          args: [
            MOCK_ADDRESS,
            MOCK_ADDRESS,
            "0x0000000000000000000000000000000000000000",
            "",
            1n,
            BigInt(Math.floor(Number("1000000000000000000") * 99)) / BigInt(100),
            0n,
          ],
        }),
        value: MOCK_AMOUNT_ETH_IN_WEI,
      });

      expect(response).toContain("Purchased WoW ERC20 memecoin");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle buy errors", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT_ADDRESS,
        amountEthInWei: MOCK_AMOUNT_ETH_IN_WEI.toString(),
      };

      const error = new Error("Buy failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const response = await provider.buyToken(mockWallet, args);
      expect(response).toBe(`Error buying Zora Wow ERC20 memecoin: ${error}`);
    });
  });

  describe("createToken", () => {
    it("should successfully create a token", async () => {
      const args = {
        name: MOCK_NAME,
        symbol: MOCK_SYMBOL,
        tokenUri: MOCK_URI,
      };

      const response = await provider.createToken(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: expect.any(String),
        data: encodeFunctionData({
          abi: WOW_FACTORY_ABI,
          functionName: "deploy",
          args: [
            MOCK_ADDRESS,
            "0x0000000000000000000000000000000000000000",
            MOCK_URI,
            MOCK_NAME,
            MOCK_SYMBOL,
          ],
        }),
      });

      expect(response).toContain(`Created WoW ERC20 memecoin ${MOCK_NAME}`);
      expect(response).toContain(`with symbol ${MOCK_SYMBOL}`);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should use default token URI if not provided", async () => {
      const args = {
        name: MOCK_NAME,
        symbol: MOCK_SYMBOL,
      };

      await provider.createToken(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: expect.any(String),
        data: encodeFunctionData({
          abi: WOW_FACTORY_ABI,
          functionName: "deploy",
          args: [
            MOCK_ADDRESS,
            "0x0000000000000000000000000000000000000000",
            GENERIC_TOKEN_METADATA_URI,
            MOCK_NAME,
            MOCK_SYMBOL,
          ],
        }),
      });
    });

    it("should handle create errors", async () => {
      const args = {
        name: MOCK_NAME,
        symbol: MOCK_SYMBOL,
      };

      const error = new Error("Create failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const response = await provider.createToken(mockWallet, args);
      expect(response).toBe(`Error creating Zora Wow ERC20 memecoin: ${error}`);
    });
  });

  describe("sellToken", () => {
    it("should successfully sell tokens", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT_ADDRESS,
        amountTokensInWei: MOCK_AMOUNT_TOKENS_IN_WEI.toString(),
      };

      const response = await provider.sellToken(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_CONTRACT_ADDRESS,
        data: encodeFunctionData({
          abi: WOW_ABI,
          functionName: "sell",
          args: [
            MOCK_AMOUNT_TOKENS_IN_WEI,
            MOCK_ADDRESS,
            "0x0000000000000000000000000000000000000000",
            "",
            1n,
            BigInt(Math.floor(Number("1000000000000000000") * 98)) / BigInt(100),
            0n,
          ],
        }),
      });

      expect(response).toContain("Sold WoW ERC20 memecoin");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle sell errors", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT_ADDRESS,
        amountTokensInWei: MOCK_AMOUNT_TOKENS_IN_WEI.toString(),
      };

      const error = new Error("Sell failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const response = await provider.sellToken(mockWallet, args);
      expect(response).toBe(`Error selling Zora Wow ERC20 memecoin: ${error}`);
    });
  });
});
