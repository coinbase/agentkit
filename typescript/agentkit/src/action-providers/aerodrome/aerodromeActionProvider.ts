import { z } from "zod";
import { encodeFunctionData, Hex, parseUnits, getAddress, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import {
  ERC20_ABI,
  VOTING_ESCROW_ABI,
  VOTER_ABI,
  ROUTER_ABI,
  AERO_ADDRESS,
  VOTING_ESCROW_ADDRESS,
  VOTER_ADDRESS,
  ROUTER_ADDRESS,
  ZERO_ADDRESS,
  MIN_LOCK_DURATION,
  MAX_LOCK_DURATION,
  WEEK_SECONDS,
} from "./constants";
import { CreateLockSchema, VoteSchema, SwapExactTokensSchema } from "./schemas";
import { Network } from "../../network";
import {
  getTokenInfo,
  formatTransactionResult,
  handleTransactionError,
  formatDuration,
  getCurrentEpochStart,
} from "./utils";

export const SUPPORTED_NETWORKS = ["base-mainnet"];
const SECONDS_IN_WEEK = BigInt(WEEK_SECONDS);

/**
 * AerodromeActionProvider enables AI agents to interact with Aerodrome Finance on Base Mainnet.
 * Supported actions: create veAERO locks, vote for gauge emissions, swap tokens.
 */
export class AerodromeActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the AerodromeActionProvider class.
   */
  constructor() {
    super("aerodrome", []);
  }

  /**
   * Creates a new veAERO lock by depositing AERO tokens for a specified duration on Base Mainnet.
   *
   * @param wallet - The EVM wallet provider used to interact with the blockchain
   * @param args - The parameters for creating a lock, including aeroAmount and lockDurationSeconds
   * @returns A string containing the transaction result or error message
   */
  @CreateAction({
    name: "createLock",
    description: `Create a new veAERO lock on Aerodrome (Base Mainnet) by depositing AERO tokens for a specified duration. Requires: aeroAmount (e.g., '100.5'), lockDurationSeconds (min 604800 for 1 week, max 126144000 for 4 years). The contract rounds duration down to the nearest week. Creates a veAERO NFT for governance.`,
    schema: CreateLockSchema,
  })
  async createLock(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CreateLockSchema>,
  ): Promise<string> {
    const ownerAddress = wallet.getAddress();
    if (!ownerAddress || ownerAddress === ZERO_ADDRESS) {
      return "Error: Wallet address is not available.";
    }
    console.log(`[Aerodrome Provider] Executing createLock for ${ownerAddress} with args:`, args);

    try {
      const lockDurationSeconds = BigInt(args.lockDurationSeconds);

      if (lockDurationSeconds < MIN_LOCK_DURATION) {
        return `Error: Lock duration (${lockDurationSeconds}s) must be at least 1 week (${MIN_LOCK_DURATION}s)`;
      }
      if (lockDurationSeconds > MAX_LOCK_DURATION) {
        return `Error: Lock duration (${lockDurationSeconds}s) cannot exceed 4 years (${MAX_LOCK_DURATION}s)`;
      }

      const { decimals, symbol } = await getTokenInfo(wallet, AERO_ADDRESS as Hex);

      const atomicAmount = parseUnits(args.aeroAmount, decimals);
      if (atomicAmount <= 0n) {
        return "Error: AERO amount must be greater than 0";
      }

      const balance = await wallet.readContract({
        address: AERO_ADDRESS as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ownerAddress as Hex],
      });

      if (BigInt(balance) < atomicAmount) {
        return `Error: Insufficient AERO balance. You have ${formatUnits(BigInt(balance), decimals)} ${symbol}, but attempted to lock ${args.aeroAmount} ${symbol}.`;
      }

      console.log(`[Aerodrome Provider] Approving ${atomicAmount} AERO wei for VotingEscrow...`);
      const approvalResult = await approve(
        wallet,
        AERO_ADDRESS,
        VOTING_ESCROW_ADDRESS,
        atomicAmount,
      );

      if (approvalResult.startsWith("Error")) {
        console.error("[Aerodrome Provider] Approval Error:", approvalResult);
        return `Error approving VotingEscrow contract: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: VOTING_ESCROW_ABI,
        functionName: "create_lock",
        args: [atomicAmount, lockDurationSeconds],
      });

      const txHash = await wallet.sendTransaction({
        to: VOTING_ESCROW_ADDRESS as Hex,
        data,
      });
      const receipt = await wallet.waitForTransactionReceipt(txHash);

      const durationText = formatDuration(Number(lockDurationSeconds));

      return formatTransactionResult(
        "created veAERO lock",
        `Locked ${args.aeroAmount} ${symbol} for ${durationText}.`,
        txHash,
        receipt,
      );
    } catch (error: unknown) {
      return handleTransactionError("creating veAERO lock", error);
    }
  }

  /**
   * Casts votes on Aerodrome Finance (Base Mainnet) for liquidity pool emissions
   * using the specified veAERO NFT.
   *
   * @param wallet - The EVM wallet provider to use for the transaction
   * @param args - The voting parameters
   * @returns A formatted string with the transaction result or an error message
   */
  @CreateAction({
    name: "vote",
    description: `Cast votes on Aerodrome (Base Mainnet) for liquidity pool emissions using a specific veAERO NFT. Requires: veAeroTokenId, poolAddresses (array), and weights (array of positive integers corresponding to pools). Allocates voting power proportionally. Can only vote once per weekly epoch.`,
    schema: VoteSchema,
  })
  async vote(wallet: EvmWalletProvider, args: z.infer<typeof VoteSchema>): Promise<string> {
    const ownerAddress = wallet.getAddress();
    if (!ownerAddress || ownerAddress === ZERO_ADDRESS) {
      return "Error: Wallet address is not available.";
    }
    console.log(`[Aerodrome Provider] Executing vote with args:`, args);

    try {
      const tokenId = BigInt(args.veAeroTokenId);
      const poolAddresses = args.poolAddresses.map(addr => getAddress(addr) as Hex);
      const weights = args.weights.map(w => BigInt(w));

      const ownerOf = await wallet
        .readContract({
          address: VOTING_ESCROW_ADDRESS as Hex,
          abi: VOTING_ESCROW_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        })
        .catch(() => ZERO_ADDRESS);

      if (ownerOf !== ownerAddress) {
        return `Error: Wallet ${ownerAddress} does not own veAERO token ID ${args.veAeroTokenId}.`;
      }

      const currentEpochStart = getCurrentEpochStart(SECONDS_IN_WEEK);
      const lastVotedTs = await wallet.readContract({
        address: VOTER_ADDRESS as Hex,
        abi: VOTER_ABI,
        functionName: "lastVoted",
        args: [tokenId],
      });

      if (lastVotedTs >= currentEpochStart) {
        const nextEpochTime = new Date(
          Number((currentEpochStart + SECONDS_IN_WEEK) * BigInt(1000)),
        ).toISOString();
        return `Error: Already voted with token ID ${tokenId} in the current epoch (since ${new Date(
          Number(currentEpochStart * 1000n),
        ).toISOString()}). You can vote again after ${nextEpochTime}.`;
      }

      const votingPower = await wallet.readContract({
        address: VOTING_ESCROW_ADDRESS as Hex,
        abi: VOTING_ESCROW_ABI,
        functionName: "balanceOfNFT",
        args: [tokenId],
      });

      console.log(`[Aerodrome Provider] veAERO #${tokenId} has voting power: ${votingPower}`);

      console.log("[Aerodrome Provider] Verifying gauges for provided pools...");
      for (let i = 0; i < poolAddresses.length; i++) {
        const gauge = await wallet.readContract({
          address: VOTER_ADDRESS as Hex,
          abi: VOTER_ABI,
          functionName: "gauges",
          args: [poolAddresses[i]],
        });

        if (gauge === ZERO_ADDRESS) {
          return `Error: Pool ${poolAddresses[i]} does not have a registered gauge. Only pools with gauges can receive votes.`;
        }
      }

      const data = encodeFunctionData({
        abi: VOTER_ABI,
        functionName: "vote",
        args: [tokenId, poolAddresses, weights],
      });

      const txHash = await wallet.sendTransaction({
        to: VOTER_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      let voteAllocation = "";
      const totalWeight = weights.reduce((sum, w) => sum + w, BigInt(0));
      for (let i = 0; i < poolAddresses.length; i++) {
        const percentage =
          totalWeight > 0
            ? (Number((weights[i] * BigInt(10000)) / totalWeight) / 100).toFixed(2)
            : "N/A";
        voteAllocation += `\n  - Pool ${poolAddresses[i]}: ${weights[i]} weight (~${percentage}%)`;
      }

      return formatTransactionResult(
        "cast votes",
        `Voted with veAERO NFT #${args.veAeroTokenId} (voting power: ${votingPower}).${voteAllocation}`,
        txHash,
        receipt,
      );
    } catch (error: unknown) {
      return handleTransactionError("casting votes", error);
    }
  }

  /**
   * Swaps an exact amount of one token for a minimum amount of another token
   * through the Aerodrome Router on Base Mainnet.
   *
   * @param wallet - The EVM wallet provider to use for the transaction
   * @param args - The swap parameters
   * @returns A formatted string with the transaction result or an error message
   */
  @CreateAction({
    name: "swapExactTokensForTokens",
    description: `Swap an exact amount of an input token for a minimum amount of an output token on Aerodrome (Base Mainnet). Requires: tokenInAddress, tokenOutAddress, amountIn (e.g., '1.5'), amountOutMin (atomic units/wei), to (recipient address), deadline (Unix timestamp), and optionally useStablePool (boolean, default false for volatile). Note: Assumes a direct route exists.`,
    schema: SwapExactTokensSchema,
  })
  async swapExactTokens(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SwapExactTokensSchema>,
  ): Promise<string> {
    const ownerAddress = wallet.getAddress();
    if (!ownerAddress || ownerAddress === ZERO_ADDRESS) {
      return "Error: Wallet address is not available.";
    }
    console.log(`[Aerodrome Provider] Executing swapExactTokens with args:`, args);

    try {
      const tokenIn = getAddress(args.tokenInAddress);
      const tokenOut = getAddress(args.tokenOutAddress);
      const recipient = getAddress(args.to);
      const deadline = BigInt(args.deadline);
      const useStable = args.useStablePool ?? false;

      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      if (deadline <= currentTimestamp) {
        return `Error: Deadline (${args.deadline}) has already passed (Current time: ${currentTimestamp}). Please provide a future timestamp.`;
      }

      const [tokenInInfo, tokenOutInfo] = await Promise.all([
        getTokenInfo(wallet, tokenIn as Hex),
        getTokenInfo(wallet, tokenOut as Hex),
      ]);

      const atomicAmountIn = parseUnits(args.amountIn, tokenInInfo.decimals);
      if (atomicAmountIn <= 0n) {
        return "Error: Swap amount must be greater than 0";
      }

      const balance = await wallet.readContract({
        address: tokenIn as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ownerAddress as Hex],
      });

      if (BigInt(balance) < atomicAmountIn) {
        return `Error: Insufficient ${tokenInInfo.symbol} balance. You have ${formatUnits(BigInt(balance), tokenInInfo.decimals)} ${tokenInInfo.symbol}, but attempted to swap ${args.amountIn} ${tokenInInfo.symbol}.`;
      }

      const route = [
        {
          from: tokenIn as Hex,
          to: tokenOut as Hex,
          stable: useStable,
          factory: ZERO_ADDRESS as Hex,
        },
      ];

      let estimatedOutput;
      try {
        const amountsOut = await wallet.readContract({
          address: ROUTER_ADDRESS as Hex,
          abi: ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [atomicAmountIn, route],
        });

        estimatedOutput = amountsOut[1];

        const amountOutMin = BigInt(args.amountOutMin);
        if (estimatedOutput > 0n && amountOutMin < (estimatedOutput * 95n) / 100n) {
          console.log(
            `[Aerodrome Provider] Warning: amountOutMin (${amountOutMin}) is more than 5% lower than estimated output (${estimatedOutput}). This allows for high slippage.`,
          );
        }

        if (amountOutMin > estimatedOutput) {
          console.log(
            `[Aerodrome Provider] Warning: amountOutMin (${amountOutMin}) is higher than estimated output (${estimatedOutput}). Transaction is likely to fail.`,
          );
        }
      } catch (error) {
        console.error("[Aerodrome Provider] Error getting price quote:", error);
        console.log("[Aerodrome Provider] Continuing with swap attempt without quote...");
      }

      console.log(
        `[Aerodrome Provider] Approving ${atomicAmountIn} ${tokenInInfo.symbol} for Router...`,
      );
      const approvalResult = await approve(wallet, tokenIn, ROUTER_ADDRESS, atomicAmountIn);
      if (approvalResult.startsWith("Error")) {
        return `Error approving Router contract: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [atomicAmountIn, BigInt(args.amountOutMin), route, recipient as Hex, deadline],
      });

      const txHash = await wallet.sendTransaction({
        to: ROUTER_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      let outputDetails = `${args.amountIn} ${tokenInInfo.symbol} for at least ${args.amountOutMin} wei of ${tokenOutInfo.symbol}`;
      if (estimatedOutput) {
        outputDetails += ` (estimated output: ${estimatedOutput} wei)`;
      }

      return formatTransactionResult(
        "completed swap",
        `Swapped ${outputDetails}. Recipient: ${recipient}`,
        txHash,
        receipt,
      );
    } catch (error: unknown) {
      return handleTransactionError("swapping tokens", error);
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the action provider supports the network, false otherwise.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      !!network.networkId &&
      SUPPORTED_NETWORKS.includes(network.networkId)
    );
  }

  /**
   * Private method to get the start timestamp for the current voting epoch
   * Used for testing.
   *
   * @returns The timestamp (seconds since epoch) of the current epoch start
   */
  private _getCurrentEpochStart(): bigint {
    return getCurrentEpochStart(SECONDS_IN_WEEK);
  }
}

export const aerodromeActionProvider = (): AerodromeActionProvider => new AerodromeActionProvider();
