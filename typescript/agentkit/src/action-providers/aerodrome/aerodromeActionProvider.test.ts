import { parseUnits, Hex, keccak256, toHex, pad, toBytes } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { approve } from "../../utils";
import { getTokenDetails } from "../erc20/utils";
import { AerodromeActionProvider } from "./aerodromeActionProvider";
import {
  AERODROME_ROUTER_ADDRESS,
  AERODROME_VOTER_ADDRESS,
  AERODROME_VOTING_ESCROW_ADDRESS,
  AERODROME_POOL_FACTORY_ADDRESS,
  AERO_TOKEN_ADDRESS,
  AERODROME_VOTING_ESCROW_ABI,
  EPOCH_DURATION,
} from "./constants";

const MOCK_TOKEN_A = "0x4200000000000000000000000000000000000006";
const MOCK_TOKEN_B = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MOCK_POOL_ADDRESS = "0x1111111111111111111111111111111111111111";
const MOCK_POOL_ADDRESS_2 = "0x5555555555555555555555555555555555555555";
const MOCK_GAUGE_ADDRESS = "0x2222222222222222222222222222222222222222";
const MOCK_GAUGE_ADDRESS_2 = "0x6666666666666666666666666666666666666666";
const MOCK_FEE_ADDRESS = "0x3333333333333333333333333333333333333333";
const MOCK_BRIBE_ADDRESS = "0x4444444444444444444444444444444444444444";
const MOCK_WALLET_ADDRESS = "0x9876543210987654321098765432109876543210";
const MOCK_TX_HASH = "0xabcdef1234567890" as `0x${string}`;
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567, logs: [] };

jest.mock("../../utils");
jest.mock("../erc20/utils");

const mockApprove = approve as jest.MockedFunction<typeof approve>;
const mockGetTokenDetails = getTokenDetails as jest.MockedFunction<typeof getTokenDetails>;

describe("Aerodrome Action Provider", () => {
  const actionProvider = new AerodromeActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_WALLET_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn(),
      getPublicClient: jest.fn().mockReturnValue({ multicall: jest.fn() }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockApprove.mockResolvedValue("Approval successful");

    mockGetTokenDetails.mockImplementation(async (_wallet, address) => {
      if (address === MOCK_TOKEN_A) {
        return { name: "WETH", decimals: 18, balance: parseUnits("10", 18), formattedBalance: "10.0" };
      }
      if (address === MOCK_TOKEN_B) {
        return { name: "USDC", decimals: 6, balance: parseUnits("5000", 6), formattedBalance: "5000.0" };
      }
      if (address === AERO_TOKEN_ADDRESS) {
        return { name: "AERO", decimals: 18, balance: parseUnits("1000", 18), formattedBalance: "1000.0" };
      }
      if (address === MOCK_POOL_ADDRESS) {
        return { name: "vAMM-WETH/USDC", decimals: 18, balance: parseUnits("5", 18), formattedBalance: "5.0" };
      }
      return null;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getQuote
  // ═══════════════════════════════════════════════════════════════
  describe("getQuote", () => {
    it("should successfully get a swap quote", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), parseUnits("3000", 6)]);
      const response = await actionProvider.getQuote(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", stable: false,
      });
      expect(response).toContain("Quote:");
      expect(response).toContain("WETH");
      expect(response).toContain("USDC");
      expect(response).toContain("volatile");
    });

    it("should show stable pool type in quote", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1000", 6), parseUnits("999", 6)]);
      const response = await actionProvider.getQuote(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1000", stable: true,
      });
      expect(response).toContain("stable");
    });

    it("should return error for zero output (non-existent pool)", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), 0n]);
      const response = await actionProvider.getQuote(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", stable: false,
      });
      expect(response).toContain("zero output");
    });

    it("should handle invalid token addresses", async () => {
      mockGetTokenDetails.mockResolvedValue(null);
      const response = await actionProvider.getQuote(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", stable: false,
      });
      expect(response).toContain("Could not fetch token details");
    });

    it("should handle readContract error (catch block)", async () => {
      mockWallet.readContract.mockRejectedValue(new Error("RPC error"));
      const response = await actionProvider.getQuote(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", stable: false,
      });
      expect(response).toContain("Error getting quote");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // swap
  // ═══════════════════════════════════════════════════════════════
  describe("swap", () => {
    it("should successfully swap tokens", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), parseUnits("3000", 6)]);
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(mockApprove).toHaveBeenCalledWith(mockWallet, MOCK_TOKEN_A, AERODROME_ROUTER_ADDRESS, parseUnits("1", 18));
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Swapped 1 WETH");
      expect(response).toContain("slippage: 1%");
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error when token details are null", async () => {
      mockGetTokenDetails.mockResolvedValue(null);
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(response).toContain("Could not fetch token details");
    });

    it("should fail with insufficient balance", async () => {
      mockGetTokenDetails.mockImplementation(async (_w, addr) => {
        if (addr === MOCK_TOKEN_A) return { name: "WETH", decimals: 18, balance: parseUnits("0.1", 18), formattedBalance: "0.1" };
        return { name: "USDC", decimals: 6, balance: parseUnits("5000", 6), formattedBalance: "5000.0" };
      });
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(response).toContain("Insufficient balance");
    });

    it("should return error for zero quote output inside swap", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), 0n]);
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(response).toContain("zero output");
      expect(mockApprove).not.toHaveBeenCalled();
    });

    it("should fail when approval fails", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), parseUnits("3000", 6)]);
      mockApprove.mockResolvedValue("Error: insufficient allowance");
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(response).toContain("Error approving tokens");
    });

    it("should handle sendTransaction error", async () => {
      mockWallet.readContract.mockResolvedValue([parseUnits("1", 18), parseUnits("3000", 6)]);
      mockWallet.sendTransaction.mockRejectedValue(new Error("INSUFFICIENT_OUTPUT_AMOUNT"));
      const response = await actionProvider.swap(mockWallet, {
        tokenIn: MOCK_TOKEN_A, tokenOut: MOCK_TOKEN_B, amountIn: "1", slippageBps: 100, stable: false,
      });
      expect(response).toContain("Error swapping tokens");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // addLiquidity
  // ═══════════════════════════════════════════════════════════════
  describe("addLiquidity", () => {
    it("should successfully add liquidity", async () => {
      mockWallet.readContract.mockResolvedValueOnce([parseUnits("1", 18), parseUnits("3000", 6), parseUnits("1", 18)]);
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(mockApprove).toHaveBeenCalledTimes(2);
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Added liquidity");
    });

    it("should return error when token details are null", async () => {
      mockGetTokenDetails.mockResolvedValue(null);
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Could not fetch token details");
    });

    it("should fail with insufficient token A balance", async () => {
      mockGetTokenDetails.mockImplementation(async (_w, addr) => {
        if (addr === MOCK_TOKEN_A) return { name: "WETH", decimals: 18, balance: parseUnits("0.1", 18), formattedBalance: "0.1" };
        return { name: "USDC", decimals: 6, balance: parseUnits("5000", 6), formattedBalance: "5000.0" };
      });
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Insufficient WETH balance");
    });

    it("should fail with insufficient token B balance", async () => {
      mockGetTokenDetails.mockImplementation(async (_w, addr) => {
        if (addr === MOCK_TOKEN_A) return { name: "WETH", decimals: 18, balance: parseUnits("10", 18), formattedBalance: "10.0" };
        return { name: "USDC", decimals: 6, balance: parseUnits("100", 6), formattedBalance: "100.0" };
      });
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Insufficient USDC balance");
    });

    it("should fail when token A approval fails", async () => {
      mockWallet.readContract.mockResolvedValueOnce([parseUnits("1", 18), parseUnits("3000", 6), parseUnits("1", 18)]);
      mockApprove.mockResolvedValue("Error: approval reverted");
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Error approving WETH");
    });

    it("should fail when token B approval fails but token A succeeds", async () => {
      mockWallet.readContract.mockResolvedValueOnce([parseUnits("1", 18), parseUnits("3000", 6), parseUnits("1", 18)]);
      mockApprove
        .mockResolvedValueOnce("Approval successful") // tokenA succeeds
        .mockResolvedValueOnce("Error: approval reverted"); // tokenB fails
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Error approving USDC");
    });

    it("should handle sendTransaction error", async () => {
      mockWallet.readContract.mockResolvedValueOnce([parseUnits("1", 18), parseUnits("3000", 6), parseUnits("1", 18)]);
      mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
      const response = await actionProvider.addLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, amountA: "1", amountB: "3000", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Error adding liquidity");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // removeLiquidity
  // ═══════════════════════════════════════════════════════════════
  describe("removeLiquidity", () => {
    it("should successfully remove liquidity with slippage protection", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_POOL_ADDRESS) // poolFor
        .mockResolvedValueOnce([parseUnits("0.5", 18), parseUnits("1500", 6)]); // quoteRemoveLiquidity
      const response = await actionProvider.removeLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, liquidity: "1", stable: false, slippageBps: 100,
      });
      expect(mockApprove).toHaveBeenCalled();
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Removed 1 LP tokens");
      expect(response).toContain("slippage: 1%");
    });

    it("should return error when LP token details are null (pool does not exist)", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x7777777777777777777777777777777777777777"); // poolFor returns unknown addr
      // getTokenDetails returns null for unknown pool
      const response = await actionProvider.removeLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, liquidity: "1", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Could not fetch LP token details");
    });

    it("should fail with insufficient LP balance", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_POOL_ADDRESS)
        .mockResolvedValueOnce([parseUnits("0.5", 18), parseUnits("1500", 6)]);
      mockGetTokenDetails.mockImplementation(async (_w, addr) => {
        if (addr === MOCK_POOL_ADDRESS) return { name: "vAMM-WETH/USDC", decimals: 18, balance: parseUnits("0.5", 18), formattedBalance: "0.5" };
        return null;
      });
      const response = await actionProvider.removeLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, liquidity: "1", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Insufficient LP balance");
    });

    it("should fail when approval fails", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_POOL_ADDRESS)
        .mockResolvedValueOnce([parseUnits("0.5", 18), parseUnits("1500", 6)]);
      mockApprove.mockResolvedValue("Error: approval failed");
      const response = await actionProvider.removeLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, liquidity: "1", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Error approving LP tokens");
    });

    it("should handle sendTransaction error", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_POOL_ADDRESS)
        .mockResolvedValueOnce([parseUnits("0.5", 18), parseUnits("1500", 6)]);
      mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
      const response = await actionProvider.removeLiquidity(mockWallet, {
        tokenA: MOCK_TOKEN_A, tokenB: MOCK_TOKEN_B, liquidity: "1", stable: false, slippageBps: 100,
      });
      expect(response).toContain("Error removing liquidity");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // createLock
  // ═══════════════════════════════════════════════════════════════
  describe("createLock", () => {
    it("should successfully create a veAERO lock and extract tokenId from logs", async () => {
      // Manually construct Deposit event log topics and data
      // Deposit(address indexed provider, uint256 indexed tokenId, uint8 indexed depositType, uint256 value, uint256 locktime, uint256 ts)
      const eventSig = keccak256(toBytes("Deposit(address,uint256,uint8,uint256,uint256,uint256)"));
      const providerTopic = pad(MOCK_WALLET_ADDRESS as Hex, { size: 32 });
      const tokenIdTopic = pad(toHex(42n), { size: 32 });
      const depositTypeTopic = pad(toHex(1), { size: 32 });
      // Non-indexed data: value, locktime, ts (each 32 bytes)
      const data = (pad(toHex(parseUnits("100", 18)), { size: 32 }) +
        pad(toHex(BigInt(Math.floor(Date.now() / 1000) + 86400 * 365)), { size: 32 }).slice(2) +
        pad(toHex(BigInt(Math.floor(Date.now() / 1000))), { size: 32 }).slice(2)) as Hex;

      const receiptWithLogs = {
        status: 1,
        blockNumber: 1234567,
        logs: [{
          address: AERODROME_VOTING_ESCROW_ADDRESS,
          data,
          topics: [eventSig, providerTopic, tokenIdTopic, depositTypeTopic],
        }],
      };
      mockWallet.waitForTransactionReceipt.mockResolvedValue(receiptWithLogs);

      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });

      expect(mockApprove).toHaveBeenCalledWith(mockWallet, AERO_TOKEN_ADDRESS, AERODROME_VOTING_ESCROW_ADDRESS, parseUnits("100", 18));
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Locked 100 AERO");
      expect(response).toContain("365 days");
      expect(response).toContain("token ID: 42");
    });

    it("should return unknown tokenId when no Deposit logs are present", async () => {
      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("token ID: unknown");
    });

    it("should filter logs by VotingEscrow address (ignore other contracts)", async () => {
      const eventSig2 = keccak256(toBytes("Deposit(address,uint256,uint8,uint256,uint256,uint256)"));
      const receiptWithWrongAddress = {
        status: 1,
        blockNumber: 1234567,
        logs: [{
          address: "0x0000000000000000000000000000000000000001", // wrong contract
          data: pad(toHex(1n), { size: 32 }) as Hex,
          topics: [eventSig2, pad(MOCK_WALLET_ADDRESS as Hex, { size: 32 }), pad(toHex(99n), { size: 32 }), pad(toHex(1), { size: 32 })],
        }],
      };
      mockWallet.waitForTransactionReceipt.mockResolvedValue(receiptWithWrongAddress);

      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("token ID: unknown");
    });

    it("should fail when AERO token details are null", async () => {
      mockGetTokenDetails.mockResolvedValue(null);
      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("Could not fetch AERO token details");
    });

    it("should fail with insufficient AERO balance", async () => {
      mockGetTokenDetails.mockImplementation(async () => ({
        name: "AERO", decimals: 18, balance: parseUnits("10", 18), formattedBalance: "10.0",
      }));
      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("Insufficient AERO balance");
    });

    it("should fail when approval fails", async () => {
      mockApprove.mockResolvedValue("Error: approval reverted");
      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("Error approving AERO tokens");
    });

    it("should handle sendTransaction error", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
      const response = await actionProvider.createLock(mockWallet, {
        amount: "100",
        lockDurationDays: 365,
      });
      expect(response).toContain("Error creating veAERO lock");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // vote
  // ═══════════════════════════════════════════════════════════════
  describe("vote", () => {
    it("should successfully vote with veAERO", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS) // ownerOf
        .mockResolvedValueOnce(parseUnits("100", 18)) // balanceOfNFT
        .mockResolvedValueOnce(0n) // lastVoted
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS); // gauges
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Voted with veAERO #1");
      expect(response).toContain("100.0%");
    });

    it("should vote for multiple pools with weight distribution", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS) // ownerOf
        .mockResolvedValueOnce(parseUnits("100", 18)) // balanceOfNFT
        .mockResolvedValueOnce(0n) // lastVoted
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS) // gauges pool 1
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS_2); // gauges pool 2
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS, MOCK_POOL_ADDRESS_2], weights: [70, 30],
      });
      expect(response).toContain("70.0%");
      expect(response).toContain("30.0%");
    });

    it("should fail when wallet does not own the NFT", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000001");
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(response).toContain("does not own veAERO");
    });

    it("should fail when voting power is zero", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(0n);
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(response).toContain("zero voting power");
    });

    it("should fail when already voted this epoch", async () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(parseUnits("100", 18))
        .mockResolvedValueOnce(now); // lastVoted = now (inside current epoch)
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(response).toContain("already voted this epoch");
    });

    it("should allow voting when last vote was in previous epoch", async () => {
      const currentEpochStart = BigInt(Math.floor(Math.floor(Date.now() / 1000) / EPOCH_DURATION) * EPOCH_DURATION);
      const lastEpochVote = currentEpochStart - 1n; // 1 second before current epoch
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(parseUnits("100", 18))
        .mockResolvedValueOnce(lastEpochVote)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS);
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(response).toContain("Voted with veAERO #1");
    });

    it("should fail when second pool has no gauge", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(parseUnits("100", 18))
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS) // pool 1 has gauge
        .mockResolvedValueOnce("0x0000000000000000000000000000000000000000"); // pool 2 has no gauge
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS, MOCK_POOL_ADDRESS_2], weights: [50, 50],
      });
      expect(response).toContain("No gauge found");
      expect(response).toContain(MOCK_POOL_ADDRESS_2);
    });

    it("should handle sendTransaction error", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(parseUnits("100", 18))
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS);
      mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
      const response = await actionProvider.vote(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS], weights: [100],
      });
      expect(response).toContain("Error voting");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // increaseAmount
  // ═══════════════════════════════════════════════════════════════
  describe("increaseAmount", () => {
    it("should successfully increase lock amount", async () => {
      mockWallet.readContract.mockResolvedValueOnce(MOCK_WALLET_ADDRESS);
      const response = await actionProvider.increaseAmount(mockWallet, { tokenId: "1", amount: "50" });
      expect(mockApprove).toHaveBeenCalled();
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Added 50 AERO to veAERO #1");
    });

    it("should fail when wallet does not own the NFT", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000001");
      const response = await actionProvider.increaseAmount(mockWallet, { tokenId: "1", amount: "50" });
      expect(response).toContain("does not own veAERO");
    });

    it("should fail with insufficient balance", async () => {
      mockWallet.readContract.mockResolvedValueOnce(MOCK_WALLET_ADDRESS);
      mockGetTokenDetails.mockImplementation(async () => ({
        name: "AERO", decimals: 18, balance: parseUnits("10", 18), formattedBalance: "10.0",
      }));
      const response = await actionProvider.increaseAmount(mockWallet, { tokenId: "1", amount: "100" });
      expect(response).toContain("Insufficient AERO balance");
    });

    it("should fail when approval fails", async () => {
      mockWallet.readContract.mockResolvedValueOnce(MOCK_WALLET_ADDRESS);
      mockApprove.mockResolvedValue("Error: reverted");
      const response = await actionProvider.increaseAmount(mockWallet, { tokenId: "1", amount: "50" });
      expect(response).toContain("Error approving AERO tokens");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // increaseUnlockTime
  // ═══════════════════════════════════════════════════════════════
  describe("increaseUnlockTime", () => {
    it("should successfully extend lock duration", async () => {
      const futureEnd = BigInt(Math.floor(Date.now() / 1000) + 86400 * 180);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), futureEnd, false]);
      const response = await actionProvider.increaseUnlockTime(mockWallet, { tokenId: "1", additionalDays: 90 });
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Extended veAERO #1 lock by 90 days");
    });

    it("should fail when wallet does not own the NFT", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000001");
      const response = await actionProvider.increaseUnlockTime(mockWallet, { tokenId: "1", additionalDays: 90 });
      expect(response).toContain("does not own veAERO");
    });

    it("should fail when lock is permanent", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), 0n, true]); // isPermanent
      const response = await actionProvider.increaseUnlockTime(mockWallet, { tokenId: "1", additionalDays: 90 });
      expect(response).toContain("permanently locked");
    });

    it("should fail when lock has expired", async () => {
      const pastEnd = BigInt(Math.floor(Date.now() / 1000) - 86400);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), pastEnd, false]);
      const response = await actionProvider.increaseUnlockTime(mockWallet, { tokenId: "1", additionalDays: 90 });
      expect(response).toContain("lock has already expired");
    });

    it("should fail when extension would exceed 4-year max", async () => {
      const futureEnd = BigInt(Math.floor(Date.now() / 1000) + 86400 * 1400);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), futureEnd, false]);
      const response = await actionProvider.increaseUnlockTime(mockWallet, { tokenId: "1", additionalDays: 365 });
      expect(response).toContain("exceed the 4-year maximum");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // withdraw
  // ═══════════════════════════════════════════════════════════════
  describe("withdraw", () => {
    it("should successfully withdraw from expired lock", async () => {
      const pastTimestamp = BigInt(Math.floor(Date.now() / 1000) - 86400);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), pastTimestamp, false]);
      const response = await actionProvider.withdraw(mockWallet, { tokenId: "1" });
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(response).toContain("Withdrawn AERO from expired veAERO #1");
    });

    it("should fail when wallet does not own the NFT", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000001");
      const response = await actionProvider.withdraw(mockWallet, { tokenId: "1" });
      expect(response).toContain("does not own veAERO");
    });

    it("should fail when lock has not expired", async () => {
      const futureTimestamp = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), futureTimestamp, false]);
      const response = await actionProvider.withdraw(mockWallet, { tokenId: "1" });
      expect(response).toContain("lock has not expired");
      expect(response).toContain("days remaining");
    });

    it("should fail when lock is permanent", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), 0n, true]);
      const response = await actionProvider.withdraw(mockWallet, { tokenId: "1" });
      expect(response).toContain("permanently locked");
    });

    it("should handle sendTransaction error", async () => {
      const pastTimestamp = BigInt(Math.floor(Date.now() / 1000) - 86400);
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce([BigInt(100e18), pastTimestamp, false]);
      mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
      const response = await actionProvider.withdraw(mockWallet, { tokenId: "1" });
      expect(response).toContain("Error withdrawing");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // claimRewards
  // ═══════════════════════════════════════════════════════════════
  describe("claimRewards", () => {
    it("should successfully claim fees and bribes", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS)
        .mockResolvedValueOnce(MOCK_FEE_ADDRESS)
        .mockResolvedValueOnce(MOCK_BRIBE_ADDRESS);
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A, MOCK_TOKEN_B]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("Claimed rewards for veAERO #1");
      expect(response).toContain("Claimed trading fees");
      expect(response).toContain("Claimed bribes");
    });

    it("should warn when fees succeed but bribes fail", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS)
        .mockResolvedValueOnce(MOCK_FEE_ADDRESS)
        .mockResolvedValueOnce(MOCK_BRIBE_ADDRESS);
      // First sendTransaction (fees) succeeds, second (bribes) fails
      mockWallet.sendTransaction
        .mockResolvedValueOnce(MOCK_TX_HASH)
        .mockRejectedValueOnce(new Error("bribe revert"));
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A, MOCK_TOKEN_B]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("Claimed rewards for veAERO #1"); // hasSuccess = true
      expect(response).toContain("Claimed trading fees");
      expect(response).toContain("Bribe claim skipped or failed");
    });

    it("should warn when fees fail but bribes succeed", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS)
        .mockResolvedValueOnce(MOCK_FEE_ADDRESS)
        .mockResolvedValueOnce(MOCK_BRIBE_ADDRESS);
      mockWallet.sendTransaction
        .mockRejectedValueOnce(new Error("fee revert")) // fees fail
        .mockResolvedValueOnce(MOCK_TX_HASH); // bribes succeed
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A, MOCK_TOKEN_B]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("Claimed rewards for veAERO #1"); // hasSuccess = true (bribes succeeded)
      expect(response).toContain("Fee claim skipped or failed");
      expect(response).toContain("Claimed bribes");
    });

    it("should show warning when both fees and bribes fail", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce(MOCK_GAUGE_ADDRESS)
        .mockResolvedValueOnce(MOCK_FEE_ADDRESS)
        .mockResolvedValueOnce(MOCK_BRIBE_ADDRESS);
      mockWallet.sendTransaction
        .mockRejectedValueOnce(new Error("fee revert"))
        .mockRejectedValueOnce(new Error("bribe revert"));
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A, MOCK_TOKEN_B]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("Warning: No rewards were successfully claimed");
      expect(response).toContain("Fee claim skipped or failed");
      expect(response).toContain("Bribe claim skipped or failed");
    });

    it("should fail when wallet does not own the NFT", async () => {
      mockWallet.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000001");
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("does not own veAERO");
    });

    it("should fail when gauge does not exist", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(MOCK_WALLET_ADDRESS)
        .mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
      const response = await actionProvider.claimRewards(mockWallet, {
        tokenId: "1", pools: [MOCK_POOL_ADDRESS],
        feeTokens: [[MOCK_TOKEN_A]], bribeTokens: [[MOCK_TOKEN_A]],
      });
      expect(response).toContain("No gauge found");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // supportsNetwork
  // ═══════════════════════════════════════════════════════════════
  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    });

    it("should return false for Base Sepolia (testnet)", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(false);
    });

    it("should return false for Ethereum mainnet", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" })).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana", networkId: "base-mainnet" })).toBe(false);
    });
  });
});
