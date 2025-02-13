import { parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { approve } from "../../utils";
import { AaveActionProvider } from "./aaveActionProvider";
import { Network } from "../../network";
import { AAVE_V3_ADDRESSES } from "./constants";
import { ethers } from "ethers";

// Mock dependencies
jest.mock("../../utils");
jest.mock("ethers");
jest.mock("@aave/contract-helpers", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    supply: jest.fn().mockImplementation(args => {
      if (
        args.reserve.toLowerCase() === AAVE_V3_ADDRESSES["base-mainnet"].ASSETS.WETH.toLowerCase()
      ) {
        return Promise.resolve([
          {
            tx: () => ({
              to: AAVE_V3_ADDRESSES["base-mainnet"].POOL,
              data: "0x",
              from: "0x4200000000000000000000000000000000000006",
              value: parseUnits("0.1", 18).toString(),
            }),
          },
        ]);
      } else {
        return Promise.resolve([
          {
            tx: () => ({
              to: AAVE_V3_ADDRESSES["base-mainnet"].POOL,
              data: "0x",
              from: "0x4200000000000000000000000000000000000006",
            }),
          },
        ]);
      }
    }),
    withdraw: jest.fn().mockImplementation(args => {
      const mockTx = {
        to:
          args.reserve.toLowerCase() === AAVE_V3_ADDRESSES["base-mainnet"].ASSETS.WETH.toLowerCase()
            ? AAVE_V3_ADDRESSES["base-mainnet"].WETH_GATEWAY
            : AAVE_V3_ADDRESSES["base-mainnet"].POOL,
        data: "0x",
        from: "0x4200000000000000000000000000000000000006",
        value: "0",
        gas: 300000n,
      };
      return Promise.resolve([
        {
          tx: () => mockTx,
        },
      ]);
    }),
  })),
  WETHGateway: jest.fn().mockImplementation(() => ({
    depositETH: jest.fn().mockResolvedValue([
      {
        tx: () => ({
          to: AAVE_V3_ADDRESSES["base-mainnet"].WETH_GATEWAY,
          data: "0x",
          from: "0x4200000000000000000000000000000000000006",
          value: parseUnits("0.1", 18).toString(),
        }),
      },
    ]),
    withdrawETH: jest.fn().mockResolvedValue([
      {
        tx: () => ({
          to: AAVE_V3_ADDRESSES["base-mainnet"].WETH_GATEWAY,
          data: "0x",
          from: "0x4200000000000000000000000000000000000006",
          value: "0",
          gas: 300000n,
        }),
      },
    ]),
  })),
}));

const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("Aave Action Provider", () => {
  const actionProvider = new AaveActionProvider();
  const MOCK_ADDRESS = "0x4200000000000000000000000000000000000006";
  const MOCK_TX_HASH = "0xabcdef1234567890";
  const MOCK_RECEIPT = { status: "success", blockNumber: 1234567 };
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock ethers Web3Provider
    const mockWeb3Provider = {
      getSigner: jest.fn().mockReturnValue({
        getAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      }),
    };
    (ethers.providers.Web3Provider as unknown as jest.Mock).mockImplementation(
      () => mockWeb3Provider,
    );

    // Mock provider with transport URL
    const mockProvider = {
      getBalance: jest.fn().mockResolvedValue(parseUnits("1", 18)),
      transport: {
        url: process.env.RPC_URL || "http://localhost:8545",
      },
    };

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      getProvider: jest.fn().mockResolvedValue(mockProvider),
      readContract: jest.fn().mockResolvedValue(parseUnits("1", 18)),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockApprove.mockResolvedValue("Approval successful");
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("supply", () => {
    it("should successfully supply ETH to Aave", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "0.1",
        asset: "ETH",
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(response).toContain("Successfully supplied 0.1 ETH");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should successfully supply USDC to Aave", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "100",
        asset: "USDC",
      };

      const atomicAmount = parseUnits("100", 6); // USDC has 6 decimals

      const response = await actionProvider.supply(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        AAVE_V3_ADDRESSES["base-mainnet"].ASSETS.USDC,
        AAVE_V3_ADDRESSES["base-mainnet"].POOL,
        atomicAmount,
      );
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Successfully supplied 100 USDC");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle unsupported chain", async () => {
      const mockWallet = {
        getNetwork: () => ({ networkId: "base-sepolia" }),
        getAddress: () => "0x123",
        sendTransaction: jest.fn(),
      } as unknown as EvmWalletProvider;

      const args = {
        chain: "base-sepolia",
        amount: "0.1",
        asset: "ETH",
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toBe("Error: Aave is only available on Base mainnet...");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle unsupported asset", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "100",
        asset: "INVALID",
      };

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toBe("Error: Unsupported asset INVALID");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle approval failure", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "100",
        asset: "USDC",
      };

      mockApprove.mockResolvedValue("Error: Approval failed");

      const response = await actionProvider.supply(mockWallet, args);

      expect(response).toBe("Error: Failed to approve USDC: Error: Approval failed");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("withdraw", () => {
    beforeEach(() => {
      // Mock aToken balance for withdraw
      mockWallet.readContract.mockResolvedValue(parseUnits("1", 18));
    });

    /*
     * it("should successfully withdraw ETH from Aave", async () => {
     *   const args = {
     *     chain: "base-mainnet",
     *     amount: "0.1",
     *     asset: "ETH",
     *   };
     */

    //   const response = await actionProvider.withdraw(mockWallet, args);

    /*
     *   const expectedTx = {
     *     to: AAVE_V3_ADDRESSES["base-mainnet"].WETH_GATEWAY,
     *     data: "0x",
     *     from: MOCK_ADDRESS,
     *     value: "0",
     *     gas: 300000n,
     *   };
     */

    /*
     *   expect(mockWallet.sendTransaction).toHaveBeenCalledWith(expectedTx);
     *   expect(response).toContain("Successfully withdrew 0.1 ETH");
     *   expect(response).toContain(MOCK_TX_HASH);
     * });
     */

    it("should successfully withdraw USDC from Aave", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "100",
        asset: "USDC",
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Successfully withdrew 100 USDC");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should handle unsupported chain", async () => {
      const args = {
        chain: "ethereum",
        amount: "100",
        asset: "USDC",
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toContain("Error withdrawing from Aave: Chain ethereum is not supported");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle unsupported asset", async () => {
      const args = {
        chain: "base-mainnet",
        amount: "100",
        asset: "INVALID",
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toContain("Error: Unsupported asset INVALID");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum",
        } as Network),
      ).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "bitcoin",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(false);
    });
  });
});
