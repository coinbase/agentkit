import { z } from "zod";
import { encodeFunctionData, Hex, parseUnits, getAddress } from "viem";
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
} from "./constants";
import { CreateLockSchema, VoteSchema, SwapExactTokensSchema } from "./schemas";
import { Network } from "../../network";

export const SUPPORTED_NETWORKS = ["base-mainnet"];
const SECONDS_IN_WEEK = BigInt(604800);
const MIN_LOCK_DURATION = SECONDS_IN_WEEK; // 1 week
const MAX_LOCK_DURATION = BigInt(126144000); // 4 years

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

      const decimals = await wallet.readContract({
        address: AERO_ADDRESS as Hex,
        abi: ERC20_ABI,
        functionName: "decimals",
      });

      const atomicAmount = parseUnits(args.aeroAmount, decimals);
      if (atomicAmount <= 0n) {
        return "Error: AERO amount must be greater than 0";
      }

      console.log(`
        [Aerodrome Provider] Approving ${atomicAmount} AERO wei for VotingEscrow (${VOTING_ESCROW_ADDRESS})...
      `);
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
      console.log("[Aerodrome Provider] Approval successful or already sufficient.");

      console.log(`[Aerodrome Provider] Encoding create_lock transaction...`);
      const data = encodeFunctionData({
        abi: VOTING_ESCROW_ABI,
        functionName: "create_lock",
        args: [atomicAmount, lockDurationSeconds],
      });

      console.log(`
        [Aerodrome Provider] Sending create_lock transaction to ${VOTING_ESCROW_ADDRESS}...
      `);
      const txHash = await wallet.sendTransaction({
        to: VOTING_ESCROW_ADDRESS as Hex,
        data,
      });
      console.log(`[Aerodrome Provider] Transaction sent: ${txHash}. Waiting for receipt...`);

      const receipt = await wallet.waitForTransactionReceipt(txHash);
      console.log(`[Aerodrome Provider] Transaction confirmed. Gas used: ${receipt.gasUsed}`);

      return `Successfully created veAERO lock with ${args.aeroAmount} AERO for ${args.lockDurationSeconds} seconds. Transaction: ${txHash}. Gas used: ${receipt.gasUsed}`;
    } catch (error: unknown) {
      console.error("[Aerodrome Provider] Error creating veAERO lock:", error);
      return `Error creating veAERO lock: ${error instanceof Error ? error.message : String(error)}`;
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
    console.log(`[Aerodrome Provider] Executing vote for ${ownerAddress} with args:`, args);

    try {
      const tokenId = BigInt(args.veAeroTokenId);
      const poolAddresses = args.poolAddresses.map(addr => getAddress(addr) as Hex);
      const weights = args.weights.map(w => BigInt(w));

      const currentEpochStart = this._getCurrentEpochStart();
      console.log(`[Aerodrome Provider] Current epoch start timestamp: ${currentEpochStart}`);
      const lastVotedTs = await wallet.readContract({
        address: VOTER_ADDRESS as Hex,
        abi: VOTER_ABI,
        functionName: "lastVoted",
        args: [tokenId],
      });
      console.log(`[Aerodrome Provider] Last voted timestamp for token ${tokenId}: ${lastVotedTs}`);

      if (lastVotedTs >= currentEpochStart) {
        const nextEpochTime = new Date(
          Number((currentEpochStart + SECONDS_IN_WEEK) * BigInt(1000)),
        ).toISOString();
        return `Error: Already voted with token ID ${tokenId} in the current epoch (since ${new Date(
          Number(currentEpochStart * 1000n),
        ).toISOString()}). You can vote again after ${nextEpochTime}.`;
      }

      console.log("[Aerodrome Provider] Verifying gauges for provided pools...");
      for (const poolAddress of poolAddresses) {
        const gauge = await wallet.readContract({
          address: VOTER_ADDRESS as Hex,
          abi: VOTER_ABI,
          functionName: "gauges",
          args: [poolAddress],
        });
        if (gauge === ZERO_ADDRESS) {
          return `Error: Pool ${poolAddress} does not have a registered gauge. Only pools with gauges can receive votes.`;
        }
      }
      console.log("[Aerodrome Provider] All specified pools have valid gauges.");

      console.log(`[Aerodrome Provider] Encoding vote transaction...`);
      const data = encodeFunctionData({
        abi: VOTER_ABI,
        functionName: "vote",
        args: [tokenId, poolAddresses, weights],
      });

      console.log(`[Aerodrome Provider] Sending vote transaction to ${VOTER_ADDRESS}...`);
      const txHash = await wallet.sendTransaction({
        to: VOTER_ADDRESS as Hex,
        data,
      });
      console.log(`[Aerodrome Provider] Transaction sent: ${txHash}. Waiting for receipt...`);

      const receipt = await wallet.waitForTransactionReceipt(txHash);
      console.log(`[Aerodrome Provider] Transaction confirmed. Gas used: ${receipt.gasUsed}`);

      let voteAllocation = "";
      const totalWeight = weights.reduce((sum, w) => sum + w, BigInt(0));
      for (let i = 0; i < poolAddresses.length; i++) {
        const percentage =
          totalWeight > 0
            ? (Number((weights[i] * BigInt(10000)) / totalWeight) / 100).toFixed(2)
            : "N/A";
        voteAllocation += `\n  - Pool ${poolAddresses[i]}: ${weights[i]} weight (~${percentage}%)`;
      }
      const responseMessage = `Successfully voted with veAERO NFT #${args.veAeroTokenId}. Vote allocation: ${voteAllocation}\nTransaction: ${txHash}. Gas used: ${receipt.gasUsed}`;
      return responseMessage;
    } catch (error: unknown) {
      console.error("[Aerodrome Provider] Error casting votes:", error);
      if (error instanceof Error && error.message?.includes("NotApprovedOrOwner")) {
        return `Error casting votes: Wallet ${ownerAddress} does not own or is not approved for veAERO token ID ${args.veAeroTokenId}.`;
      }
      return `Error casting votes: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Swaps an exact amount of input tokens for a minimum amount of output tokens on Aerodrome (Base Mainnet).
   *
   * @param wallet - The EVM wallet provider used to execute the transaction
   * @param args - Parameters for the swap as defined in SwapExactTokensSchema
   * @returns A promise resolving to the transaction result as a string
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
    console.log(`
      [Aerodrome Provider] Executing swapExactTokens for ${ownerAddress} with args:
      ${JSON.stringify(args, null, 2)}
    `);

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

      const [decimals, tokenInSymbol, tokenOutSymbol] = await Promise.all([
        wallet.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: "decimals" }),
        wallet.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: "symbol" }),
        wallet.readContract({ address: tokenOut, abi: ERC20_ABI, functionName: "symbol" }),
      ]);

      const atomicAmountIn = parseUnits(args.amountIn, decimals);
      if (atomicAmountIn <= 0n) {
        return "Error: Swap amount must be greater than 0";
      }
      const amountOutMin = BigInt(args.amountOutMin);

      console.log(`
        [Aerodrome Provider] Approving ${atomicAmountIn} ${tokenInSymbol} wei for Router (${ROUTER_ADDRESS})...
      `);
      const approvalResult = await approve(wallet, tokenIn, ROUTER_ADDRESS, atomicAmountIn);

      if (approvalResult.startsWith("Error")) {
        console.error("[Aerodrome Provider] Approval Error:", approvalResult);
        return `Error approving Router contract: ${approvalResult}`;
      }
      console.log("[Aerodrome Provider] Approval successful or already sufficient.");

      const route = [
        {
          from: tokenIn,
          to: tokenOut,
          stable: useStable,
          factory: ZERO_ADDRESS as Hex,
        },
      ];
      console.log(`
        [Aerodrome Provider] Using route: ${tokenInSymbol} -> ${tokenOutSymbol} (Stable: ${useStable})
      `);

      console.log(`[Aerodrome Provider] Encoding swapExactTokensForTokens transaction...`);
      const data = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [atomicAmountIn, amountOutMin, route, recipient, deadline],
      });

      console.log(`[Aerodrome Provider] Sending swap transaction to ${ROUTER_ADDRESS}...`);
      const txHash = await wallet.sendTransaction({
        to: ROUTER_ADDRESS as Hex,
        data,
      });
      console.log(`[Aerodrome Provider] Transaction sent: ${txHash}. Waiting for receipt...`);

      const receipt = await wallet.waitForTransactionReceipt(txHash);
      console.log(`[Aerodrome Provider] Transaction confirmed. Gas used: ${receipt.gasUsed}`);

      return `Successfully initiated swap of ${args.amountIn} ${tokenInSymbol} for at least ${args.amountOutMin} wei of ${tokenOutSymbol}. Recipient: ${recipient}\nTransaction: ${txHash}. Gas used: ${receipt.gasUsed}`;
    } catch (error: unknown) {
      console.error("[Aerodrome Provider] Error swapping tokens:", error);
      if (error instanceof Error && error.message?.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
        return "Error swapping tokens: Insufficient output amount. Slippage may be too high or amountOutMin too strict for current market conditions.";
      }
      if (error instanceof Error && error.message?.includes("INSUFFICIENT_LIQUIDITY")) {
        return "Error swapping tokens: Insufficient liquidity for this trade pair and amount.";
      }
      if (error instanceof Error && error.message?.includes("Expired")) {
        return `Error swapping tokens: Transaction deadline (${args.deadline}) likely passed during execution.`;
      }
      return `Error swapping tokens: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Aerodrome action provider supports the given network.
   * Currently supports Base Mainnet ONLY.
   *
   * @param network - The network to check for support
   * @returns True if the network is supported, false otherwise
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);

  /**
   * Helper to get the start of the current epoch.
   *
   * @returns The timestamp (in seconds) of the start of the current week's epoch as a bigint
   */
  private _getCurrentEpochStart(): bigint {
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    // Unix epoch (Jan 1 1970) was a Thursday, so simple division works.
    const epochStart = (nowSeconds / SECONDS_IN_WEEK) * SECONDS_IN_WEEK;
    return epochStart;
  }
}

export const aerodromeActionProvider = () => new AerodromeActionProvider();
