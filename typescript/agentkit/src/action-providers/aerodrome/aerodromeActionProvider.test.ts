/**
 * AerodromeActionProvider Tests
 */

import { encodeFunctionData, parseUnits, ReadContractParameters, Abi, Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { approve } from "../../utils";
import { AerodromeActionProvider } from "./aerodromeActionProvider";
import { Network } from "../../network";
import {
  VOTING_ESCROW_ABI,
  VOTER_ABI,
  ROUTER_ABI,
  AERO_ADDRESS,
  VOTING_ESCROW_ADDRESS,
  VOTER_ADDRESS,
  ROUTER_ADDRESS,
  ZERO_ADDRESS,
} from "./constants";
import * as utilsModule from "./utils";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_POOL_ADDRESS_1 = "0xaaaa567890123456789012345678901234567890";
const MOCK_POOL_ADDRESS_2 = "0xbbbb567890123456789012345678901234567890";
const MOCK_TOKEN_IN = "0xcccc567890123456789012345678901234567890";
const MOCK_TOKEN_OUT = "0xdddd567890123456789012345678901234567890";
const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_DECIMALS = 18;
const MOCK_RECEIPT = { gasUsed: 100000n };

jest.mock("../../utils");
jest.mock("./utils");
const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("AerodromeActionProvider", () => {
  const provider = new AerodromeActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockImplementation((params: ReadContractParameters<Abi, string>) => {
        if (params.functionName === "decimals") return Promise.resolve(MOCK_DECIMALS);
        if (params.functionName === "symbol") {
          if (params.address && params.address.toLowerCase() === MOCK_TOKEN_IN.toLowerCase()) {
            return Promise.resolve("TOKEN_IN");
          }
          if (params.address && params.address.toLowerCase() === MOCK_TOKEN_OUT.toLowerCase()) {
            return Promise.resolve("TOKEN_OUT");
          }
          return Promise.resolve("AERO");
        }
        if (params.functionName === "lastVoted") return Promise.resolve(0n);
        if (params.functionName === "gauges") return Promise.resolve(MOCK_POOL_ADDRESS_1);
        if (params.functionName === "balanceOf") {
          return Promise.resolve(parseUnits("1000000", MOCK_DECIMALS));
        }
        if (params.functionName === "getAmountsOut") {
          const amount = params.args?.[0] as bigint;
          return Promise.resolve([amount, amount * 2n]);
        }
        if (params.functionName === "ownerOf") {
          return Promise.resolve(MOCK_ADDRESS);
        }
        return Promise.resolve(0);
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockApprove.mockResolvedValue("Approval successful");

    jest
      .spyOn(utilsModule, "getTokenInfo")
      .mockImplementation(async (wallet: EvmWalletProvider, address: Hex) => {
        if (address?.toLowerCase() === MOCK_TOKEN_IN.toLowerCase()) {
          return { decimals: MOCK_DECIMALS, symbol: "TOKEN_IN" };
        }
        if (address?.toLowerCase() === MOCK_TOKEN_OUT.toLowerCase()) {
          return { decimals: MOCK_DECIMALS, symbol: "TOKEN_OUT" };
        }
        return { decimals: MOCK_DECIMALS, symbol: "AERO" };
      });

    jest
      .spyOn(utilsModule, "formatTransactionResult")
      .mockImplementation(
        (
          action: string,
          details: string,
          txHash: Hex,
          receipt: { gasUsed?: bigint | string },
        ): string => {
          return `Successfully ${action}. ${details}\nTransaction: ${txHash}. Gas used: ${receipt.gasUsed}`;
        },
      );

    jest
      .spyOn(utilsModule, "handleTransactionError")
      .mockImplementation((action: string, error: unknown): string => {
        if (error instanceof Error) {
          if (error.message.includes("NotApprovedOrOwner")) {
            return `Error ${action}: Wallet ${MOCK_ADDRESS} does not own or is not approved for veAERO token ID`;
          }
          if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            return `Error ${action}: Insufficient output amount. Slippage may be too high or amountOutMin too strict for current market conditions.`;
          }
          if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return `Error ${action}: Insufficient liquidity for this trade pair and amount.`;
          }
          if (error.message.includes("Expired")) {
            return `Error ${action}: Transaction deadline likely passed during execution.`;
          }
          return `Error ${action}: ${error.message}`;
        }
        return `Error ${action}: ${String(error)}`;
      });

    jest.spyOn(utilsModule, "formatDuration").mockImplementation((/* _seconds: number */) => {
      return "1 week";
    });

    jest.spyOn(utilsModule, "getCurrentEpochStart").mockImplementation(() => 1680739200n);

    jest.spyOn(Date, "now").mockImplementation(() => 1681315200000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Network Support", () => {
    it("should support base-mainnet network", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(true);
    });

    it("should not support other evm networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        } as Network),
      ).toBe(false);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({ protocolFamily: "invalid-protocol" } as Network)).toBe(
        false,
      );
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("createLock", () => {
    it("should successfully create a veAERO lock", async () => {
      const args = {
        aeroAmount: "100.5",
        lockDurationSeconds: "604800",
      };

      const atomicAmount = parseUnits(args.aeroAmount, MOCK_DECIMALS);

      const response = await provider.createLock(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        AERO_ADDRESS,
        VOTING_ESCROW_ADDRESS,
        atomicAmount,
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: VOTING_ESCROW_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: VOTING_ESCROW_ABI,
          functionName: "create_lock",
          args: [atomicAmount, BigInt(args.lockDurationSeconds)],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Successfully created veAERO lock`);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error if lock duration is too short", async () => {
      const args = {
        aeroAmount: "100.5",
        lockDurationSeconds: "604799",
      };

      const response = await provider.createLock(mockWallet, args);
      expect(response).toContain("Error: Lock duration");
      expect(response).toContain("must be at least 1 week");
    });

    it("should return error if lock duration is too long", async () => {
      const args = {
        aeroAmount: "100.5",
        lockDurationSeconds: "126144001",
      };

      const response = await provider.createLock(mockWallet, args);
      expect(response).toContain("Error: Lock duration");
      expect(response).toContain("cannot exceed 4 years");
    });

    it("should return error if AERO amount is not positive", async () => {
      const args = {
        aeroAmount: "0",
        lockDurationSeconds: "604800",
      };

      const response = await provider.createLock(mockWallet, args);
      expect(response).toContain("Error: AERO amount must be greater than 0");
    });

    it("should handle approval errors", async () => {
      const args = {
        aeroAmount: "100.5",
        lockDurationSeconds: "604800",
      };

      mockApprove.mockResolvedValue("Error: Insufficient balance");

      const response = await provider.createLock(mockWallet, args);
      expect(response).toContain("Error approving VotingEscrow contract");
    });

    it("should handle transaction errors", async () => {
      const args = {
        aeroAmount: "100.5",
        lockDurationSeconds: "604800",
      };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

      const response = await provider.createLock(mockWallet, args);
      expect(response).toContain("Error creating veAERO lock");
    });
  });

  describe("vote", () => {
    it("should successfully cast votes", async () => {
      const args = {
        veAeroTokenId: "1",
        poolAddresses: [MOCK_POOL_ADDRESS_1, MOCK_POOL_ADDRESS_2],
        weights: ["100", "50"],
      };

      const response = await provider.vote(mockWallet, args);

      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: VOTER_ADDRESS as `0x${string}`,
        abi: VOTER_ABI,
        functionName: "lastVoted",
        args: [1n],
      });

      expect(mockWallet.readContract).toHaveBeenCalled();
      const callArgs = mockWallet.readContract.mock.calls.flat();

      const gaugeCalls = callArgs.filter(
        (call: ReadContractParameters<Abi | readonly unknown[], string, readonly unknown[]>) =>
          call?.functionName === "gauges" &&
          typeof call?.args?.[0] === "string" &&
          (call?.args?.[0].toLowerCase() === MOCK_POOL_ADDRESS_1.toLowerCase() ||
            call?.args?.[0].toLowerCase() === MOCK_POOL_ADDRESS_2.toLowerCase()),
      );
      expect(gaugeCalls.length).toBeGreaterThanOrEqual(2);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: VOTER_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: VOTER_ABI,
          functionName: "vote",
          args: [1n, [MOCK_POOL_ADDRESS_1, MOCK_POOL_ADDRESS_2], [100n, 50n]],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Successfully cast votes`);
    });

    it("should return error if already voted in current epoch", async () => {
      const args = {
        veAeroTokenId: "1",
        poolAddresses: [MOCK_POOL_ADDRESS_1],
        weights: ["100"],
      };

      mockWallet.readContract = jest
        .fn()
        .mockImplementation((params: ReadContractParameters<Abi, string>) => {
          if (params.functionName === "lastVoted") return Promise.resolve(1681315200n);
          if (params.functionName === "gauges") return Promise.resolve(MOCK_POOL_ADDRESS_1);
          if (params.functionName === "ownerOf") return Promise.resolve(MOCK_ADDRESS);
          return Promise.resolve(MOCK_DECIMALS);
        });

      const response = await provider.vote(mockWallet, args);
      expect(response).toContain("Error: Already voted with token ID");
      expect(response).toContain("in the current epoch");
    });

    it("should return error if pool does not have a registered gauge", async () => {
      const args = {
        veAeroTokenId: "1",
        poolAddresses: [MOCK_POOL_ADDRESS_1],
        weights: ["100"],
      };

      mockWallet.readContract = jest
        .fn()
        .mockImplementation((params: ReadContractParameters<Abi, string>) => {
          if (params.functionName === "gauges") return Promise.resolve(ZERO_ADDRESS);
          if (params.functionName === "ownerOf") return Promise.resolve(MOCK_ADDRESS);
          return Promise.resolve(0);
        });

      const response = await provider.vote(mockWallet, args);
      expect(response).toContain("Error: Pool");
      expect(response).toContain("does not have a registered gauge");
    });

    it("should handle transaction errors", async () => {
      const args = {
        veAeroTokenId: "1",
        poolAddresses: [MOCK_POOL_ADDRESS_1],
        weights: ["100"],
      };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

      const response = await provider.vote(mockWallet, args);
      expect(response).toContain("Error casting votes");
    });

    it("should correctly handle NotApprovedOrOwner errors", async () => {
      const args = {
        veAeroTokenId: "1",
        poolAddresses: [MOCK_POOL_ADDRESS_1],
        weights: ["100"],
      };

      mockWallet.readContract = jest
        .fn()
        .mockImplementation((params: ReadContractParameters<Abi, string>) => {
          if (params.functionName === "lastVoted") return Promise.resolve(0n);
          if (params.functionName === "gauges") return Promise.resolve(MOCK_POOL_ADDRESS_1);
          if (params.functionName === "ownerOf") return Promise.resolve(MOCK_ADDRESS);
          return Promise.resolve(0);
        });

      const notApprovedError = new Error("execution reverted: NotApprovedOrOwner");
      mockWallet.sendTransaction.mockRejectedValue(notApprovedError);

      const response = await provider.vote(mockWallet, args);
      expect(response).toContain("Error casting votes");
      expect(response).toContain("does not own or is not approved for veAERO token ID");
    });
  });

  describe("swapExactTokens", () => {
    it("should successfully swap tokens", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      const atomicAmountIn = parseUnits(args.amountIn, MOCK_DECIMALS);

      const response = await provider.swapExactTokens(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        expect.stringMatching(new RegExp(MOCK_TOKEN_IN, "i")),
        ROUTER_ADDRESS,
        atomicAmountIn,
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: ROUTER_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [
            atomicAmountIn,
            BigInt(args.amountOutMin),
            [
              {
                from: MOCK_TOKEN_IN,
                to: MOCK_TOKEN_OUT,
                stable: false,
                factory: ZERO_ADDRESS as `0x${string}`,
              },
            ],
            MOCK_ADDRESS,
            BigInt(args.deadline),
          ],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Successfully completed swap`);
    });

    it("should return error if deadline has already passed", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1681315199",
        useStablePool: false,
      };

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error: Deadline");
      expect(response).toContain("has already passed");
    });

    it("should return error if swap amount is not positive", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "0",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error: Swap amount must be greater than 0");
    });

    it("should handle approval errors", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      mockApprove.mockResolvedValue("Error: Insufficient balance");

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error approving Router contract");
    });

    it("should handle transaction errors", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      mockWallet.sendTransaction.mockReset();
      mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error swapping tokens");
    });

    it("should handle INSUFFICIENT_OUTPUT_AMOUNT errors", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      mockWallet.sendTransaction.mockReset();
      const slippageError = new Error("execution reverted: INSUFFICIENT_OUTPUT_AMOUNT");
      mockWallet.sendTransaction.mockRejectedValue(slippageError);

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error swapping tokens");
      expect(response).toContain("Slippage may be too high");
    });

    it("should handle INSUFFICIENT_LIQUIDITY errors", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1000000",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      mockWallet.sendTransaction.mockReset();
      const liquidityError = new Error("execution reverted: INSUFFICIENT_LIQUIDITY");
      mockWallet.sendTransaction.mockRejectedValue(liquidityError);

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error swapping tokens");
      expect(response).toContain("Insufficient liquidity");
    });

    it("should handle Expired errors", async () => {
      const args = {
        tokenInAddress: MOCK_TOKEN_IN,
        tokenOutAddress: MOCK_TOKEN_OUT,
        amountIn: "1.5",
        amountOutMin: "1000000000",
        to: MOCK_ADDRESS,
        deadline: "1691315200",
        useStablePool: false,
      };

      mockWallet.sendTransaction.mockReset();
      const expiredError = new Error("execution reverted: Expired");
      mockWallet.sendTransaction.mockRejectedValue(expiredError);

      const response = await provider.swapExactTokens(mockWallet, args);
      expect(response).toContain("Error swapping tokens");
      expect(response).toContain("deadline");
    });
  });

  describe("getCurrentEpochStart function", () => {
    it("should correctly calculate epoch start time", () => {
      expect(utilsModule.getCurrentEpochStart(BigInt(604800))).toBe(1680739200n);
    });
  });
});
