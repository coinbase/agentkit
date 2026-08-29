import { z } from "zod";
import { encodeFunctionData, parseUnits, formatUnits, Hex, decodeEventLog } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { getTokenDetails } from "../erc20/utils";
import { Network } from "../../network";
import {
  AERODROME_ROUTER_ADDRESS,
  AERODROME_VOTER_ADDRESS,
  AERODROME_VOTING_ESCROW_ADDRESS,
  AERODROME_POOL_FACTORY_ADDRESS,
  AERO_TOKEN_ADDRESS,
  AERODROME_ROUTER_ABI,
  AERODROME_VOTING_ESCROW_ABI,
  AERODROME_VOTER_ABI,
  DEFAULT_DEADLINE_SECONDS,
  DEFAULT_SLIPPAGE_BPS,
  MAX_LOCK_DURATION,
  MIN_LOCK_DURATION,
  EPOCH_DURATION,
} from "./constants";
import {
  AerodromeGetQuoteSchema,
  AerodromeSwapSchema,
  AerodromeAddLiquiditySchema,
  AerodromeRemoveLiquiditySchema,
  AerodromeCreateLockSchema,
  AerodromeVoteSchema,
  AerodromeIncreaseAmountSchema,
  AerodromeIncreaseUnlockTimeSchema,
  AerodromeWithdrawSchema,
  AerodromeClaimRewardsSchema,
} from "./schemas";

const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * AerodromeActionProvider provides actions for interacting with Aerodrome Finance,
 * the leading DEX on Base. Supports token swaps, liquidity provision, veAERO
 * governance locking, voting, reward claiming, and lock management.
 */
export class AerodromeActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("aerodrome", []);
  }

  /**
   * Gets a swap quote from Aerodrome Router.
   */
  @CreateAction({
    name: "aerodrome_get_quote",
    description: `Get a swap quote from Aerodrome Finance on Base. Returns the expected output amount for a given input.

It takes:
- tokenIn: The address of the input token
- tokenOut: The address of the output token (must differ from tokenIn)
- amountIn: The amount of input tokens in whole units (e.g., '1.5' for 1.5 WETH)
- stable: Whether to use the stable pool (for correlated assets like stablecoins) or volatile pool (default: false)`,
    schema: AerodromeGetQuoteSchema,
  })
  async getQuote(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeGetQuoteSchema>,
  ): Promise<string> {
    try {
      const tokenInDetails = await getTokenDetails(wallet, args.tokenIn);
      const tokenOutDetails = await getTokenDetails(wallet, args.tokenOut);

      if (!tokenInDetails || !tokenOutDetails) {
        return "Error: Could not fetch token details. Please verify the token addresses are valid ERC20 tokens on Base.";
      }

      const atomicAmountIn = parseUnits(args.amountIn, tokenInDetails.decimals);

      const route = {
        from: args.tokenIn as Hex,
        to: args.tokenOut as Hex,
        stable: args.stable,
        factory: AERODROME_POOL_FACTORY_ADDRESS,
      };

      const amounts = (await wallet.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AERODROME_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [atomicAmountIn, [route]],
      })) as readonly bigint[];

      const amountOut = amounts[amounts.length - 1];

      // H-2 fix: guard against zero output from non-existent pool
      if (amountOut === 0n) {
        return "Error: Quote returned zero output. The pool may not exist or have insufficient liquidity for this pair.";
      }

      const formattedOut = formatUnits(amountOut, tokenOutDetails.decimals);

      return `Quote: ${args.amountIn} ${tokenInDetails.name} → ${formattedOut} ${tokenOutDetails.name} (${args.stable ? "stable" : "volatile"} pool)`;
    } catch (error) {
      return `Error getting quote: ${error}`;
    }
  }

  /**
   * Swaps tokens on Aerodrome using the Router.
   */
  @CreateAction({
    name: "aerodrome_swap",
    description: `Swap tokens on Aerodrome Finance (Base). Uses a slippage tolerance to compute the minimum output amount automatically.

It takes:
- tokenIn: The address of the input token
- tokenOut: The address of the output token (must differ from tokenIn)
- amountIn: The amount of input tokens in whole units (e.g., '1.5' for 1.5 WETH)
- slippageBps: Maximum slippage in basis points (100 = 1%, default: 1%, max: 10%)
- stable: Whether to use the stable pool or volatile pool (default: false)

The action will first get a quote, apply slippage tolerance, handle token approval, then execute the swap. Base uses a private sequencer which reduces but does not eliminate MEV risk for large swaps.`,
    schema: AerodromeSwapSchema,
  })
  async swap(wallet: EvmWalletProvider, args: z.infer<typeof AerodromeSwapSchema>): Promise<string> {
    try {
      const tokenInDetails = await getTokenDetails(wallet, args.tokenIn);
      const tokenOutDetails = await getTokenDetails(wallet, args.tokenOut);

      if (!tokenInDetails || !tokenOutDetails) {
        return "Error: Could not fetch token details. Please verify the token addresses are valid ERC20 tokens on Base.";
      }

      const atomicAmountIn = parseUnits(args.amountIn, tokenInDetails.decimals);

      if (atomicAmountIn > tokenInDetails.balance) {
        return `Error: Insufficient balance. You have ${tokenInDetails.formattedBalance} ${tokenInDetails.name} but tried to swap ${args.amountIn}.`;
      }

      const route = {
        from: args.tokenIn as Hex,
        to: args.tokenOut as Hex,
        stable: args.stable,
        factory: AERODROME_POOL_FACTORY_ADDRESS,
      };

      const amounts = (await wallet.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AERODROME_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [atomicAmountIn, [route]],
      })) as readonly bigint[];

      const expectedOut = amounts[amounts.length - 1];

      // H-2 fix: guard against zero output
      if (expectedOut === 0n) {
        return "Error: Quote returned zero output. The pool may not exist or have insufficient liquidity for this pair.";
      }

      const slippage = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const amountOutMin = (expectedOut * BigInt(10000 - slippage)) / BigInt(10000);

      const approvalResult = await approve(
        wallet,
        args.tokenIn,
        AERODROME_ROUTER_ADDRESS,
        atomicAmountIn,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving tokens: ${approvalResult}`;
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);
      const walletAddress = wallet.getAddress();

      const data = encodeFunctionData({
        abi: AERODROME_ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [atomicAmountIn, amountOutMin, [route], walletAddress as Hex, deadline],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_ROUTER_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      const formattedMinOut = formatUnits(amountOutMin, tokenOutDetails.decimals);
      const formattedExpected = formatUnits(expectedOut, tokenOutDetails.decimals);

      return `Swapped ${args.amountIn} ${tokenInDetails.name} for ~${formattedExpected} ${tokenOutDetails.name} (min: ${formattedMinOut}, slippage: ${slippage / 100}%) on Aerodrome.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error swapping tokens: ${error}`;
    }
  }

  /**
   * Adds liquidity to an Aerodrome pool.
   */
  @CreateAction({
    name: "aerodrome_add_liquidity",
    description: `Add liquidity to an Aerodrome pool on Base. Deposits two tokens into a pool and receives LP tokens.

It takes:
- tokenA: The address of the first token
- tokenB: The address of the second token (must differ from tokenA)
- amountA: The amount of the first token in whole units (e.g., '1.5')
- amountB: The amount of the second token in whole units (e.g., '1.5')
- stable: Whether this is a stable pool (for correlated assets) or volatile pool (default: false)
- slippageBps: Maximum slippage in basis points (100 = 1%, default: 1%, max: 10%)

Warning: Providing liquidity to volatile pools carries impermanent loss risk. If token prices diverge significantly, you may receive less value back than deposited. Stable pools minimize this risk for correlated assets.`,
    schema: AerodromeAddLiquiditySchema,
  })
  async addLiquidity(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeAddLiquiditySchema>,
  ): Promise<string> {
    try {
      const tokenADetails = await getTokenDetails(wallet, args.tokenA);
      const tokenBDetails = await getTokenDetails(wallet, args.tokenB);

      if (!tokenADetails || !tokenBDetails) {
        return "Error: Could not fetch token details. Please verify the token addresses are valid ERC20 tokens on Base.";
      }

      const atomicAmountA = parseUnits(args.amountA, tokenADetails.decimals);
      const atomicAmountB = parseUnits(args.amountB, tokenBDetails.decimals);

      if (atomicAmountA > tokenADetails.balance) {
        return `Error: Insufficient ${tokenADetails.name} balance. Have ${tokenADetails.formattedBalance}, need ${args.amountA}.`;
      }
      if (atomicAmountB > tokenBDetails.balance) {
        return `Error: Insufficient ${tokenBDetails.name} balance. Have ${tokenBDetails.formattedBalance}, need ${args.amountB}.`;
      }

      // BUG-2 fix: Use quoteAddLiquidity to get pool-ratio-adjusted amounts, then apply slippage
      const quoteResult = (await wallet.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AERODROME_ROUTER_ABI,
        functionName: "quoteAddLiquidity",
        args: [
          args.tokenA as Hex,
          args.tokenB as Hex,
          args.stable,
          AERODROME_POOL_FACTORY_ADDRESS,
          atomicAmountA,
          atomicAmountB,
        ],
      })) as readonly [bigint, bigint, bigint];

      const quotedAmountA = quoteResult[0];
      const quotedAmountB = quoteResult[1];

      const approvalA = await approve(wallet, args.tokenA, AERODROME_ROUTER_ADDRESS, atomicAmountA);
      if (approvalA.startsWith("Error")) {
        return `Error approving ${tokenADetails.name}: ${approvalA}`;
      }

      const approvalB = await approve(wallet, args.tokenB, AERODROME_ROUTER_ADDRESS, atomicAmountB);
      if (approvalB.startsWith("Error")) {
        return `Error approving ${tokenBDetails.name}: ${approvalB}`;
      }

      const slippage = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const amountAMin = (quotedAmountA * BigInt(10000 - slippage)) / BigInt(10000);
      const amountBMin = (quotedAmountB * BigInt(10000 - slippage)) / BigInt(10000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);
      const walletAddress = wallet.getAddress();

      const data = encodeFunctionData({
        abi: AERODROME_ROUTER_ABI,
        functionName: "addLiquidity",
        args: [
          args.tokenA as Hex,
          args.tokenB as Hex,
          args.stable,
          atomicAmountA,
          atomicAmountB,
          amountAMin,
          amountBMin,
          walletAddress as Hex,
          deadline,
        ],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_ROUTER_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Added liquidity: ${args.amountA} ${tokenADetails.name} + ${args.amountB} ${tokenBDetails.name} to Aerodrome ${args.stable ? "stable" : "volatile"} pool.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error adding liquidity: ${error}`;
    }
  }

  /**
   * Removes liquidity from an Aerodrome pool.
   * C-1 fix: Uses quoteRemoveLiquidity for proper slippage protection.
   */
  @CreateAction({
    name: "aerodrome_remove_liquidity",
    description: `Remove liquidity from an Aerodrome pool on Base. Burns LP tokens and receives the underlying tokens back with slippage protection.

It takes:
- tokenA: The address of the first token
- tokenB: The address of the second token (must differ from tokenA)
- liquidity: The amount of LP tokens to burn in whole units
- stable: Whether this is a stable pool or volatile pool (default: false)
- slippageBps: Maximum slippage in basis points (100 = 1%, default: 1%, max: 10%)`,
    schema: AerodromeRemoveLiquiditySchema,
  })
  async removeLiquidity(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeRemoveLiquiditySchema>,
  ): Promise<string> {
    try {
      const poolAddress = (await wallet.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AERODROME_ROUTER_ABI,
        functionName: "poolFor",
        args: [args.tokenA as Hex, args.tokenB as Hex, args.stable, AERODROME_POOL_FACTORY_ADDRESS],
      })) as Hex;

      const lpDetails = await getTokenDetails(wallet, poolAddress);
      if (!lpDetails) {
        return "Error: Could not fetch LP token details. The pool may not exist for this token pair.";
      }

      const atomicLiquidity = parseUnits(args.liquidity, lpDetails.decimals);

      if (atomicLiquidity > lpDetails.balance) {
        return `Error: Insufficient LP balance. Have ${lpDetails.formattedBalance}, tried to remove ${args.liquidity}.`;
      }

      // C-1 fix: Quote expected output amounts and apply slippage
      const quoteResult = (await wallet.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AERODROME_ROUTER_ABI,
        functionName: "quoteRemoveLiquidity",
        args: [
          args.tokenA as Hex,
          args.tokenB as Hex,
          args.stable,
          AERODROME_POOL_FACTORY_ADDRESS,
          atomicLiquidity,
        ],
      })) as readonly [bigint, bigint];

      const expectedAmountA = quoteResult[0];
      const expectedAmountB = quoteResult[1];

      const slippage = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const amountAMin = (expectedAmountA * BigInt(10000 - slippage)) / BigInt(10000);
      const amountBMin = (expectedAmountB * BigInt(10000 - slippage)) / BigInt(10000);

      const approvalResult = await approve(
        wallet,
        poolAddress,
        AERODROME_ROUTER_ADDRESS,
        atomicLiquidity,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving LP tokens: ${approvalResult}`;
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);
      const walletAddress = wallet.getAddress();

      const data = encodeFunctionData({
        abi: AERODROME_ROUTER_ABI,
        functionName: "removeLiquidity",
        args: [
          args.tokenA as Hex,
          args.tokenB as Hex,
          args.stable,
          atomicLiquidity,
          amountAMin,
          amountBMin,
          walletAddress as Hex,
          deadline,
        ],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_ROUTER_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Removed ${args.liquidity} LP tokens from Aerodrome ${args.stable ? "stable" : "volatile"} pool (slippage: ${slippage / 100}%).\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error removing liquidity: ${error}`;
    }
  }

  /**
   * Creates a veAERO lock by depositing AERO tokens.
   */
  @CreateAction({
    name: "aerodrome_create_lock",
    description: `Create a veAERO lock by depositing AERO tokens on Aerodrome. Locks AERO to receive a veAERO NFT that grants voting power for directing pool emissions.

It takes:
- amount: The amount of AERO tokens to lock in whole units (e.g., '100')
- lockDurationDays: Lock duration in days (min 7, max 1460 / 4 years). Longer locks give more voting power

Important notes:
- Voting power decays linearly toward zero at unlock time. Longer locks = more voting power.
- Lock duration is rounded down to the nearest Thursday epoch boundary on-chain. For example, locking for 8 days starting on a Friday effectively gives ~7 days of lock.
- Returns the veAERO NFT token ID which can be used for voting on pool emissions.`,
    schema: AerodromeCreateLockSchema,
  })
  async createLock(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeCreateLockSchema>,
  ): Promise<string> {
    try {
      const aeroDetails = await getTokenDetails(wallet, AERO_TOKEN_ADDRESS);
      if (!aeroDetails) {
        return "Error: Could not fetch AERO token details.";
      }

      const atomicAmount = parseUnits(args.amount, aeroDetails.decimals);

      if (atomicAmount > aeroDetails.balance) {
        return `Error: Insufficient AERO balance. Have ${aeroDetails.formattedBalance}, tried to lock ${args.amount}.`;
      }

      const lockDurationSeconds = args.lockDurationDays * 24 * 60 * 60;

      if (lockDurationSeconds < MIN_LOCK_DURATION) {
        return "Error: Lock duration must be at least 7 days.";
      }
      if (lockDurationSeconds > MAX_LOCK_DURATION) {
        return "Error: Lock duration cannot exceed 4 years (1460 days).";
      }

      const approvalResult = await approve(
        wallet,
        AERO_TOKEN_ADDRESS,
        AERODROME_VOTING_ESCROW_ADDRESS,
        atomicAmount,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving AERO tokens: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "createLock",
        args: [atomicAmount, BigInt(lockDurationSeconds)],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_VOTING_ESCROW_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      // Extract veAERO tokenId from the Deposit event logs
      // H-4 fix: filter by emitting contract address
      let tokenId = "unknown";
      try {
        for (const log of receipt.logs || []) {
          if (log.address?.toLowerCase() !== AERODROME_VOTING_ESCROW_ADDRESS.toLowerCase()) {
            continue;
          }
          try {
            const decoded = decodeEventLog({
              abi: AERODROME_VOTING_ESCROW_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "Deposit") {
              tokenId = String((decoded.args as { tokenId: bigint }).tokenId);
              break;
            }
          } catch {
            // Skip logs that don't match the Deposit event
          }
        }
      } catch {
        // If log parsing fails entirely, tokenId stays "unknown"
      }

      return `Locked ${args.amount} AERO for ${args.lockDurationDays} days on Aerodrome. veAERO NFT token ID: ${tokenId}.\nUse this token ID to vote on pool emissions.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error creating veAERO lock: ${error}`;
    }
  }

  /**
   * Votes with a veAERO NFT for pool emissions on Aerodrome.
   * H-3 fix: Verifies NFT ownership and voting power before voting.
   * M-4 fix: Checks if already voted this epoch.
   */
  @CreateAction({
    name: "aerodrome_vote",
    description: `Vote with a veAERO NFT to direct AERO emissions to specific liquidity pools on Aerodrome.

It takes:
- tokenId: The veAERO NFT token ID to vote with (must be owned by your wallet)
- pools: Array of pool addresses to vote for
- weights: Array of vote weights (relative, normalized by the contract). Must match pools array length

Important: Votes are cast per epoch (weekly, Thursday to Thursday UTC). Voting directs AERO emissions proportionally to the pools you vote for. veAERO voters earn trading fees and bribes from voted pools.`,
    schema: AerodromeVoteSchema,
  })
  async vote(wallet: EvmWalletProvider, args: z.infer<typeof AerodromeVoteSchema>): Promise<string> {
    try {
      // H-3 fix: Verify wallet owns the veAERO NFT
      const owner = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.tokenId)],
      })) as Hex;

      const walletAddress = wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Error: Your wallet (${walletAddress}) does not own veAERO #${args.tokenId}. Owner is ${owner}.`;
      }

      // Check voting power
      const votingPower = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "balanceOfNFT",
        args: [BigInt(args.tokenId)],
      })) as bigint;

      if (votingPower === 0n) {
        return `Error: veAERO #${args.tokenId} has zero voting power. The lock may have expired.`;
      }

      // M-4 fix: Check if already voted this epoch
      const lastVotedTimestamp = (await wallet.readContract({
        address: AERODROME_VOTER_ADDRESS,
        abi: AERODROME_VOTER_ABI,
        functionName: "lastVoted",
        args: [BigInt(args.tokenId)],
      })) as bigint;

      const currentEpochStart = BigInt(
        Math.floor(Math.floor(Date.now() / 1000) / EPOCH_DURATION) * EPOCH_DURATION,
      );
      if (lastVotedTimestamp >= currentEpochStart) {
        return `Error: veAERO #${args.tokenId} has already voted this epoch (Thursday to Thursday). You can vote again after the next epoch starts.`;
      }

      // Validate gauges exist for all pools
      for (const pool of args.pools) {
        const gauge = (await wallet.readContract({
          address: AERODROME_VOTER_ADDRESS,
          abi: AERODROME_VOTER_ABI,
          functionName: "gauges",
          args: [pool as Hex],
        })) as Hex;

        if (!gauge || gauge === "0x0000000000000000000000000000000000000000") {
          return `Error: No gauge found for pool ${pool}. This pool may not have an active gauge.`;
        }
      }

      const data = encodeFunctionData({
        abi: AERODROME_VOTER_ABI,
        functionName: "vote",
        args: [BigInt(args.tokenId), args.pools as Hex[], args.weights.map(w => BigInt(w))],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_VOTER_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      const totalWeight = args.weights.reduce((a, b) => a + b, 0);
      const voteDetails = args.pools
        .map((pool, i) => `  ${pool}: ${((args.weights[i] / totalWeight) * 100).toFixed(1)}%`)
        .join("\n");

      return `Voted with veAERO #${args.tokenId} on Aerodrome:\n${voteDetails}\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error voting: ${error}`;
    }
  }

  /**
   * Increases the locked AERO amount in an existing veAERO position.
   */
  @CreateAction({
    name: "aerodrome_increase_amount",
    description: `Add more AERO tokens to an existing veAERO lock on Aerodrome. Increases your voting power without creating a new lock.

It takes:
- tokenId: The veAERO NFT token ID to add more AERO to
- amount: The additional amount of AERO tokens to lock in whole units`,
    schema: AerodromeIncreaseAmountSchema,
  })
  async increaseAmount(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeIncreaseAmountSchema>,
  ): Promise<string> {
    try {
      // NEW-1 fix: verify ownership
      const owner = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.tokenId)],
      })) as Hex;

      const walletAddress = wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Error: Your wallet (${walletAddress}) does not own veAERO #${args.tokenId}. Owner is ${owner}.`;
      }

      const aeroDetails = await getTokenDetails(wallet, AERO_TOKEN_ADDRESS);
      if (!aeroDetails) {
        return "Error: Could not fetch AERO token details.";
      }

      const atomicAmount = parseUnits(args.amount, aeroDetails.decimals);

      if (atomicAmount > aeroDetails.balance) {
        return `Error: Insufficient AERO balance. Have ${aeroDetails.formattedBalance}, tried to add ${args.amount}.`;
      }

      const approvalResult = await approve(
        wallet,
        AERO_TOKEN_ADDRESS,
        AERODROME_VOTING_ESCROW_ADDRESS,
        atomicAmount,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving AERO tokens: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "increaseAmount",
        args: [BigInt(args.tokenId), atomicAmount],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_VOTING_ESCROW_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Added ${args.amount} AERO to veAERO #${args.tokenId} on Aerodrome.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error increasing lock amount: ${error}`;
    }
  }

  /**
   * Extends the lock duration of an existing veAERO position.
   */
  @CreateAction({
    name: "aerodrome_increase_unlock_time",
    description: `Extend the lock duration of an existing veAERO position on Aerodrome. Increases your voting power by locking for longer.

It takes:
- tokenId: The veAERO NFT token ID to extend the lock for
- additionalDays: Additional days to extend the lock (total lock cannot exceed 4 years from now)

Note: The new unlock time is rounded down to the nearest Thursday epoch boundary on-chain.`,
    schema: AerodromeIncreaseUnlockTimeSchema,
  })
  async increaseUnlockTime(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeIncreaseUnlockTimeSchema>,
  ): Promise<string> {
    try {
      // NEW-1 fix: verify ownership
      const owner = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.tokenId)],
      })) as Hex;

      const walletAddress = wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Error: Your wallet (${walletAddress}) does not own veAERO #${args.tokenId}. Owner is ${owner}.`;
      }

      // D-1/D-2 fix: check lock is not expired and not permanent
      const lockInfo = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "locked",
        args: [BigInt(args.tokenId)],
      })) as readonly [bigint, bigint, boolean];

      const currentEnd = lockInfo[1];
      const isPermanent = lockInfo[2];
      const now = BigInt(Math.floor(Date.now() / 1000));

      if (isPermanent) {
        return `Error: veAERO #${args.tokenId} is permanently locked. Cannot extend unlock time on a permanent lock.`;
      }

      if (currentEnd <= now) {
        return `Error: veAERO #${args.tokenId} lock has already expired. Cannot extend an expired lock — create a new lock instead.`;
      }
      const additionalSeconds = BigInt(args.additionalDays * 24 * 60 * 60);

      // BUG-1 fix: The contract computes new end as (block.timestamp + _lockDuration).
      // So _lockDuration must be the TOTAL desired duration from NOW, not a delta.
      // To "extend by X days", we compute: (currentEnd - now) + additionalSeconds
      // This gives the contract: now + (currentEnd - now) + additionalSeconds = currentEnd + additionalSeconds
      const remainingSeconds = currentEnd > now ? currentEnd - now : 0n;
      const totalDurationFromNow = remainingSeconds + additionalSeconds;

      // Ceiling check: new end = now + totalDurationFromNow. Must not exceed now + MAX_LOCK_DURATION.
      if (totalDurationFromNow > BigInt(MAX_LOCK_DURATION)) {
        const maxAdditionalDays = Number((BigInt(MAX_LOCK_DURATION) - remainingSeconds) / BigInt(86400));
        return `Error: Extending by ${args.additionalDays} days would exceed the 4-year maximum lock. Maximum additional days allowed: ~${maxAdditionalDays}.`;
      }

      const data = encodeFunctionData({
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "increaseUnlockTime",
        args: [BigInt(args.tokenId), totalDurationFromNow],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_VOTING_ESCROW_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Extended veAERO #${args.tokenId} lock by ${args.additionalDays} days on Aerodrome.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error extending lock duration: ${error}`;
    }
  }

  /**
   * Withdraws unlocked AERO from an expired veAERO position.
   */
  @CreateAction({
    name: "aerodrome_withdraw",
    description: `Withdraw unlocked AERO tokens from an expired veAERO position on Aerodrome. The lock must have expired before withdrawal is possible.

It takes:
- tokenId: The veAERO NFT token ID to withdraw from (lock must be expired)`,
    schema: AerodromeWithdrawSchema,
  })
  async withdraw(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeWithdrawSchema>,
  ): Promise<string> {
    try {
      // NEW-1 fix: verify ownership
      const owner = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.tokenId)],
      })) as Hex;

      const walletAddress = wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Error: Your wallet (${walletAddress}) does not own veAERO #${args.tokenId}. Owner is ${owner}.`;
      }

      // Check lock status
      const lockInfo = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "locked",
        args: [BigInt(args.tokenId)],
      })) as readonly [bigint, bigint, boolean];

      const lockEnd = lockInfo[1];
      const isPermanent = lockInfo[2];
      const now = BigInt(Math.floor(Date.now() / 1000));

      if (isPermanent) {
        return `Error: veAERO #${args.tokenId} is permanently locked. Call unlockPermanent first.`;
      }

      if (lockEnd > now) {
        const daysRemaining = Number((lockEnd - now) / BigInt(86400));
        return `Error: veAERO #${args.tokenId} lock has not expired yet. ${daysRemaining} days remaining until unlock.`;
      }

      const data = encodeFunctionData({
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "withdraw",
        args: [BigInt(args.tokenId)],
      });

      const txHash = await wallet.sendTransaction({
        to: AERODROME_VOTING_ESCROW_ADDRESS,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Withdrawn AERO from expired veAERO #${args.tokenId} on Aerodrome.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error withdrawing: ${error}`;
    }
  }

  /**
   * Claims trading fees and bribes from voted pools.
   */
  @CreateAction({
    name: "aerodrome_claim_rewards",
    description: `Claim trading fees and bribes earned from veAERO voting on Aerodrome.

It takes:
- tokenId: The veAERO NFT token ID to claim rewards for
- pools: Array of pool addresses to claim fees and bribes from
- feeTokens: Array of arrays of fee token addresses per pool (the pool's underlying tokens, e.g., [WETH, USDC])
- bribeTokens: Array of arrays of bribe reward token addresses per pool (incentive tokens deposited by protocols)

veAERO voters earn 100% of trading fees and bribes from the pools they voted for. Fee tokens and bribe tokens are different — fees are the pool's underlying tokens, bribes are incentives from protocols.`,
    schema: AerodromeClaimRewardsSchema,
  })
  async claimRewards(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AerodromeClaimRewardsSchema>,
  ): Promise<string> {
    try {
      // D-3 fix: verify ownership (consistent with all other veAERO actions)
      const owner = (await wallet.readContract({
        address: AERODROME_VOTING_ESCROW_ADDRESS,
        abi: AERODROME_VOTING_ESCROW_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.tokenId)],
      })) as Hex;

      const walletAddress = wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Error: Your wallet (${walletAddress}) does not own veAERO #${args.tokenId}. Owner is ${owner}.`;
      }

      // Get fee and bribe contract addresses for each pool's gauge
      const feeAddresses: Hex[] = [];
      const bribeAddresses: Hex[] = [];

      for (const pool of args.pools) {
        const gauge = (await wallet.readContract({
          address: AERODROME_VOTER_ADDRESS,
          abi: AERODROME_VOTER_ABI,
          functionName: "gauges",
          args: [pool as Hex],
        })) as Hex;

        if (!gauge || gauge === "0x0000000000000000000000000000000000000000") {
          return `Error: No gauge found for pool ${pool}.`;
        }

        const feeAddress = (await wallet.readContract({
          address: AERODROME_VOTER_ADDRESS,
          abi: AERODROME_VOTER_ABI,
          functionName: "gaugeToFees",
          args: [gauge],
        })) as Hex;

        const bribeAddress = (await wallet.readContract({
          address: AERODROME_VOTER_ADDRESS,
          abi: AERODROME_VOTER_ABI,
          functionName: "gaugeToBribe",
          args: [gauge],
        })) as Hex;

        feeAddresses.push(feeAddress);
        bribeAddresses.push(bribeAddress);
      }

      const results: string[] = [];

      // Claim fees
      try {
        const feeData = encodeFunctionData({
          abi: AERODROME_VOTER_ABI,
          functionName: "claimFees",
          args: [feeAddresses, args.feeTokens as Hex[][], BigInt(args.tokenId)],
        });

        const feeTxHash = await wallet.sendTransaction({
          to: AERODROME_VOTER_ADDRESS,
          data: feeData,
        });
        await wallet.waitForTransactionReceipt(feeTxHash);
        results.push(`Claimed trading fees. Tx: ${feeTxHash}`);
      } catch (error) {
        results.push(`Fee claim skipped or failed: ${error}`);
      }

      // Claim bribes
      try {
        const bribeData = encodeFunctionData({
          abi: AERODROME_VOTER_ABI,
          functionName: "claimBribes",
          args: [bribeAddresses, args.bribeTokens as Hex[][], BigInt(args.tokenId)],
        });

        const bribeTxHash = await wallet.sendTransaction({
          to: AERODROME_VOTER_ADDRESS,
          data: bribeData,
        });
        await wallet.waitForTransactionReceipt(bribeTxHash);
        results.push(`Claimed bribes. Tx: ${bribeTxHash}`);
      } catch (error) {
        results.push(`Bribe claim skipped or failed: ${error}`);
      }

      // NEW-5 fix: reflect actual outcome in message
      const hasSuccess = results.some(r => r.startsWith("Claimed"));
      const prefix = hasSuccess
        ? `Claimed rewards for veAERO #${args.tokenId} on Aerodrome:`
        : `Warning: No rewards were successfully claimed for veAERO #${args.tokenId}:`;
      return `${prefix}\n${results.join("\n")}`;
    } catch (error) {
      return `Error claiming rewards: ${error}`;
    }
  }

  /**
   * Checks if the Aerodrome action provider supports the given network.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const aerodromeActionProvider = () => new AerodromeActionProvider();
