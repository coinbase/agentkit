import { parseEther, parseUnits, encodeFunctionData, Hex, Address } from "viem";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { CompoundActionProvider } from "./compoundActionProvider";
import { COMET_ABI, COMET_ADDRESSES, ASSET_ADDRESSES } from "./constants";
import { Network } from "../../network";
import { approve } from "../../utils";

jest.mock("../../utils");
const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("Compound Action Provider", () => {
  const actionProvider = new CompoundActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const MOCK_NETWORK: Network = { protocolFamily: "evm", networkId: "base-mainnet" };
  const MOCK_COMET_ADDRESS = COMET_ADDRESSES["base-mainnet"];
  const MOCK_WETH_ADDRESS = ASSET_ADDRESSES["base-mainnet"]["weth"];
  const MOCK_USDC_ADDRESS = ASSET_ADDRESSES["base-mainnet"]["usdc"];
  const MOCK_TX_HASH = "0xtesttxhash";
  const MOCK_RECEIPT = { status: 1, blockNumber: 123456 };
  const MOCK_WALLET_BALANCE = BigInt("10000000000000000000"); // 10 tokens in wei
  const MOCK_TOKEN_SYMBOL = "WETH";

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue("0xMockAddress"),
      getNetwork: jest.fn().mockReturnValue(MOCK_NETWORK),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as Hex),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockImplementation(async ({ functionName, address }) => {
        // Basic ERC20 mocks
        if (functionName === "decimals") {
          return address === MOCK_USDC_ADDRESS ? 6 : 18;
        }
        if (functionName === "symbol") {
          return address === MOCK_USDC_ADDRESS ? "USDC" : "WETH";
        }
        if (functionName === "balanceOf") {
          return address === MOCK_USDC_ADDRESS ? BigInt("1000000") : parseEther("10");
        }

        // Comet contract mocks
        if (functionName === "collateralBalanceOf") {
          return parseEther("5");
        }
        if (functionName === "borrowBalanceOf") {
          return parseUnits("1000", 6);
        }
        if (functionName === "baseToken") {
          return MOCK_USDC_ADDRESS;
        }
        if (functionName === "baseTokenPriceFeed") {
          return "0xMockPriceFeed" as Address;
        }
        if (functionName === "numAssets") {
          return 1;
        }
        if (functionName === "getAssetInfo") {
          return {
            offset: 0,
            asset: MOCK_WETH_ADDRESS,
            priceFeed: "0xMockPriceFeed",
            scale: BigInt(0),
            borrowCollateralFactor: parseEther("0.8"),
            liquidateCollateralFactor: BigInt(0),
            liquidationFactor: BigInt(0),
            supplyCap: BigInt(0),
          };
        }
        if (functionName === "latestRoundData") {
          return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
        }

        throw new Error(`Unmocked contract call: ${functionName}`);
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    jest.clearAllMocks();
    mockApprove.mockResolvedValue("Approval successful");
  });

  describe("supply", () => {
    it("should successfully supply assets", async () => {
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.supply(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        MOCK_WETH_ADDRESS,
        MOCK_COMET_ADDRESS,
        parseEther("1.0"),
      );

      const expectedTxData = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "supply",
        args: [MOCK_WETH_ADDRESS, parseEther("1.0")],
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_COMET_ADDRESS,
        data: expectedTxData,
      });

      expect(response).toContain("Supplied 1.0 WETH to Compound");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error if approval fails", async () => {
      mockApprove.mockResolvedValueOnce("Error: Approval failed");
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.supply(mockWallet, args);
      expect(response).toContain("Error approving token: Error: Approval failed");
    });

    it("should return error if wallet balance is insufficient", async () => {
      mockWallet.readContract = jest.fn().mockImplementation(async ({ functionName }) => {
        if (functionName === "decimals") return 18;
        if (functionName === "balanceOf") return BigInt("500000000000000000"); // 0.5 tokens
        return MOCK_WALLET_BALANCE;
      });
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.supply(mockWallet, args);
      expect(response).toContain(
        "Error: Insufficient balance. You have 0.5, but trying to supply 1.0",
      );
    });

    it("should handle errors during the supply transaction", async () => {
      mockWallet.sendTransaction.mockRejectedValueOnce(new Error("Failed TX"));
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.supply(mockWallet, args);
      expect(response).toContain("Error supplying to Compound: Failed TX");
    });
  });

  describe("withdraw", () => {
    it("should successfully withdraw assets", async () => {
      // Patch readContract so that borrow balance is 0 (healthy condition)
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, args, abi }) => {
          if (functionName === "borrowBalanceOf") return BigInt(0); // No borrows
          if (functionName === "collateralBalanceOf") return parseEther("5"); // 5 WETH supplied
          if (functionName === "latestRoundData")
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          return originalReadContract({ functionName, address, abi, args: args ?? [] });
        });

      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.withdraw(mockWallet, args);

      const expectedTxData = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "withdraw",
        args: [MOCK_WETH_ADDRESS, parseEther("1.0")],
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_COMET_ADDRESS,
        data: expectedTxData,
      });

      expect(response).toContain("Withdrawn 1.0 WETH from Compound");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error if collateral balance is insufficient", async () => {
      mockWallet.readContract = jest.fn().mockImplementation(async ({ functionName }) => {
        if (functionName === "decimals") return 18;
        if (functionName === "collateralBalanceOf") return parseEther("0.5"); // Less than we're trying to withdraw
        if (functionName === "symbol") return MOCK_TOKEN_SYMBOL;
        return MOCK_WALLET_BALANCE;
      });
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.withdraw(mockWallet, args);
      expect(response).toContain(
        "Error: Insufficient balance. Trying to withdraw 1.0, but only have 0.5 supplied",
      );
    });

    it("should handle errors during withdrawal", async () => {
      // Patch readContract to yield a healthy condition so the TX is attempted
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, args, abi }) => {
          if (functionName === "borrowBalanceOf") return BigInt(0);
          if (functionName === "collateralBalanceOf") return parseEther("5");
          if (functionName === "latestRoundData")
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          return originalReadContract({ functionName, address, abi, args: args ?? [] });
        });

      mockWallet.sendTransaction.mockRejectedValueOnce(new Error("Withdraw TX Failed"));
      const args = { assetId: "weth" as const, amount: "1.0" };
      const response = await actionProvider.withdraw(mockWallet, args);
      expect(response).toContain("Error withdrawing from Compound: Error: Withdraw TX Failed");
    });
  });

  describe("borrow", () => {
    it("should successfully borrow assets", async () => {
      // For a healthy borrow, override:
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, abi }) => {
          if (functionName === "borrowBalanceOf") return BigInt(0);
          if (functionName === "collateralBalanceOf") return parseEther("5000");
          if (functionName === "baseToken") return MOCK_USDC_ADDRESS;
          if (functionName === "baseTokenPriceFeed") return "0xMockPriceFeed" as Address;
          if (functionName === "latestRoundData") {
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          }
          if (functionName === "getAssetInfo") {
            return {
              offset: 0,
              asset: MOCK_WETH_ADDRESS,
              priceFeed: "0xMockPriceFeed",
              scale: BigInt(0),
              borrowCollateralFactor: parseEther("0.8"),
              liquidateCollateralFactor: BigInt(0),
              liquidationFactor: BigInt(0),
              supplyCap: BigInt(0),
            };
          }
          return originalReadContract({ functionName, address, abi, args: [] });
        });

      const args = { assetId: "usdc" as const, amount: "1000" };
      const response = await actionProvider.borrow(mockWallet, args);

      const expectedTxData = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "withdraw",
        args: [MOCK_USDC_ADDRESS, parseUnits("1000", 6)],
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_COMET_ADDRESS,
        data: expectedTxData,
      });
      expect(response).toContain("Borrowed 1000 USDC from Compound");
    });

    it("should handle errors during borrowing", async () => {
      // Set up the same mocks as the success case first
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, abi }) => {
          if (functionName === "borrowBalanceOf") return BigInt(0);
          if (functionName === "collateralBalanceOf") return parseEther("5000");
          if (functionName === "baseToken") return MOCK_USDC_ADDRESS;
          if (functionName === "baseTokenPriceFeed") return "0xMockPriceFeed" as Address;
          if (functionName === "latestRoundData") {
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          }
          if (functionName === "getAssetInfo") {
            return {
              offset: 0,
              asset: MOCK_WETH_ADDRESS,
              priceFeed: "0xMockPriceFeed",
              scale: BigInt(0),
              borrowCollateralFactor: parseEther("0.8"),
              liquidateCollateralFactor: BigInt(0),
              liquidationFactor: BigInt(0),
              supplyCap: BigInt(0),
            };
          }
          return originalReadContract({ functionName, address, abi, args: [] });
        });

      mockWallet.sendTransaction.mockRejectedValueOnce(new Error("Borrow TX Failed"));
      const args = { assetId: "usdc" as const, amount: "1000" };
      const response = await actionProvider.borrow(mockWallet, args);
      expect(response).toContain("Error borrowing from Compound: Error: Borrow TX Failed");
    });
  });

  describe("repay", () => {
    it("should successfully repay assets", async () => {
      // Override token balance for USDC to be sufficient for repayment.
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, args, abi }) => {
          if (functionName === "balanceOf" && address === MOCK_USDC_ADDRESS) {
            // Return 2000 USDC in atomic units (for 6 decimals, 2000 USDC = 2000 * 10^6)
            return BigInt("2000000000");
          }
          if (functionName === "latestRoundData")
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          return originalReadContract({ functionName, address, args, abi });
        });

      const args = { assetId: "usdc" as const, amount: "1000" };
      const response = await actionProvider.repay(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        MOCK_USDC_ADDRESS,
        MOCK_COMET_ADDRESS,
        parseUnits("1000", 6),
      );
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_COMET_ADDRESS,
        data: encodeFunctionData({
          abi: COMET_ABI,
          functionName: "supply",
          args: [MOCK_USDC_ADDRESS, parseUnits("1000", 6)],
        }),
      });
      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Repaid ${args.amount} USDC to Compound`);
    });

    it("should return error if wallet balance is insufficient for repay", async () => {
      mockWallet.readContract = jest.fn().mockImplementation(async ({ functionName }) => {
        if (functionName === "decimals") return 6;
        if (functionName === "balanceOf") return BigInt("500000"); // 0.5 USDC
        return MOCK_WALLET_BALANCE;
      });
      const args = { assetId: "usdc" as const, amount: "1000" };
      const response = await actionProvider.repay(mockWallet, args);
      expect(response).toContain(
        "Error: Insufficient balance. You have 0.5, but trying to repay 1000",
      );
    });

    it("should handle errors during repayment", async () => {
      // Override token balance to be sufficient, but make transaction fail
      const originalReadContract = mockWallet.readContract;
      mockWallet.readContract = jest
        .fn()
        .mockImplementation(async ({ functionName, address, args, abi }) => {
          if (functionName === "balanceOf" && address === MOCK_USDC_ADDRESS) {
            // Return 2000 USDC in atomic units (sufficient balance)
            return BigInt("2000000000");
          }
          if (functionName === "latestRoundData")
            return [BigInt(1), parseUnits("1", 8), BigInt(0), BigInt(1000), BigInt(1)];
          return originalReadContract({ functionName, address, args, abi });
        });

      mockApprove.mockResolvedValueOnce("Approval successful");
      mockWallet.sendTransaction.mockRejectedValueOnce(new Error("Repay TX Failed"));
      const args = { assetId: "usdc" as const, amount: "1000" };
      const response = await actionProvider.repay(mockWallet, args);
      expect(response).toContain("Error repaying to Compound: Error: Repay TX Failed");
    });
  });

  describe("getPortfolio", () => {
    it("should return portfolio details in markdown format", async () => {
      const response = await actionProvider.getPortfolio(mockWallet, {});
      expect(response).toContain("# Portfolio Details");
      expect(response).toContain("## Supply Details");
      expect(response).toContain("## Borrow Details");
      expect(response).toContain("## Overall Health");
    });

    it("should handle errors during portfolio retrieval", async () => {
      mockWallet.readContract.mockRejectedValueOnce(new Error("Failed to fetch"));
      const response = await actionProvider.getPortfolio(mockWallet, {});
      expect(response).toContain("Error getting portfolio details: Failed to fetch");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for supported network", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });
      expect(result).toBe(true);
    });

    it("should return false for unsupported network", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "ethereum",
      });
      expect(result).toBe(false);
    });
  });
});
