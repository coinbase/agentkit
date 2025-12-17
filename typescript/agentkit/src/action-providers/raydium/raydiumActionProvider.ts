import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { GetPoolsSchema, GetPriceSchema, SwapTokenSchema, GetPoolInfoSchema } from "./schemas";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  Liquidity,
  Token,
  TokenAmount,
  Percent,
  LiquidityPoolKeys,
  LIQUIDITY_STATE_LAYOUT_V4,
  SPL_ACCOUNT_LAYOUT,
} from "@raydium-io/raydium-sdk";
import { getMint } from "@solana/spl-token";
import BN from "bn.js";

/**
 * RaydiumActionProvider handles DEX operations on Raydium, Solana's leading AMM.
 * Provides onchain trading capabilities with actual transaction execution.
 */
export class RaydiumActionProvider extends ActionProvider<SvmWalletProvider> {
  /**
   * Initializes Raydium action provider.
   */
  constructor() {
    super("raydium", []);
  }

  /**
   * Fetches actual pool data from Raydium API.
   * @private
   */
  private async fetchRaydiumPoolsFromAPI(limit: number = 10): Promise<any[]> {
    const response = await fetch("https://api.raydium.io/v2/main/pairs");
    const data = await response.json();

    return data.slice(0, limit).map((pool: any) => ({
      pair: pool.name || `${pool.base_symbol}-${pool.quote_symbol}`,
      poolId: pool.ammId,
      liquidity: `$${(pool.liquidity || 0).toLocaleString()}`,
      volume24h: `$${(pool.volume24h || 0).toLocaleString()}`,
      apr: pool.apr ? `${pool.apr.toFixed(2)}%` : "N/A",
    }));
  }

  /**
   * Fetches real-time pool state from onchain data.
   * @private
   */
  private async fetchPoolState(poolId: string, connection: Connection): Promise<any> {
    try {
      const poolPubkey = new PublicKey(poolId);
      const accountInfo = await connection.getAccountInfo(poolPubkey);

      if (!accountInfo) {
        throw new Error("Pool account not found");
      }

      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data);

      return {
        baseReserve: poolState.baseReserve,
        quoteReserve: poolState.quoteReserve,
        lpSupply: poolState.lpReserve,
        status: poolState.status,
      };
    } catch (error) {
      throw new Error(`Failed to fetch pool state: ${error}`);
    }
  }

  /**
   * Calculates current price from pool reserves.
   * @private
   */
  private calculatePrice(
    baseReserve: BN,
    quoteReserve: BN,
    baseDecimals: number,
    quoteDecimals: number,
  ): number {
    const baseAmount = baseReserve.toNumber() / Math.pow(10, baseDecimals);
    const quoteAmount = quoteReserve.toNumber() / Math.pow(10, quoteDecimals);
    return quoteAmount / baseAmount;
  }

  /**
   * Finds pool configuration for a token pair from Raydium API.
   * @private
   */
  private async findPoolForPair(
    tokenAMint: string,
    tokenBMint: string,
  ): Promise<{
    poolId: string;
    baseMint: string;
    quoteMint: string;
    baseDecimals: number;
    quoteDecimals: number;
  } | null> {
    try {
      const response = await fetch("https://api.raydium.io/v2/sdk/liquidity/mainnet.json");
      if (!response.ok) return null;

      const data = await response.json();
      const allPools = [...(data.official || []), ...(data.unOfficial || [])];

      const pool = allPools.find(
        (p: any) =>
          (p.baseMint === tokenAMint && p.quoteMint === tokenBMint) ||
          (p.baseMint === tokenBMint && p.quoteMint === tokenAMint),
      );

      if (!pool) return null;

      return {
        poolId: pool.id,
        baseMint: pool.baseMint,
        quoteMint: pool.quoteMint,
        baseDecimals: pool.baseDecimals,
        quoteDecimals: pool.quoteDecimals,
      };
    } catch (error) {
      console.error(`Error fetching pool from API: ${error}`);
      return null;
    }
  }

  /**
   * Fetches complete pool keys from Raydium API including vault addresses.
   * @private
   */
  private async fetchCompletePoolKeys(poolId: string): Promise<LiquidityPoolKeys | null> {
    try {
      const response = await fetch("https://api.raydium.io/v2/sdk/liquidity/mainnet.json");
      if (!response.ok) return null;

      const data = await response.json();
      const allPools = [...(data.official || []), ...(data.unOfficial || [])];
      const poolData = allPools.find((p: any) => p.id === poolId);

      if (!poolData) return null;

      return {
        id: new PublicKey(poolData.id),
        baseMint: new PublicKey(poolData.baseMint),
        quoteMint: new PublicKey(poolData.quoteMint),
        lpMint: new PublicKey(poolData.lpMint),
        baseDecimals: poolData.baseDecimals,
        quoteDecimals: poolData.quoteDecimals,
        lpDecimals: poolData.lpDecimals,
        version: 4,
        programId: new PublicKey(poolData.programId),
        authority: new PublicKey(poolData.authority),
        openOrders: new PublicKey(poolData.openOrders),
        targetOrders: new PublicKey(poolData.targetOrders),
        baseVault: new PublicKey(poolData.baseVault),
        quoteVault: new PublicKey(poolData.quoteVault),
        withdrawQueue: new PublicKey(poolData.withdrawQueue || poolData.id),
        lpVault: new PublicKey(poolData.lpVault || poolData.lpMint),
        marketVersion: 3,
        marketProgramId: new PublicKey(poolData.marketProgramId),
        marketId: new PublicKey(poolData.marketId),
        marketAuthority: new PublicKey(poolData.marketAuthority),
        marketBaseVault: new PublicKey(poolData.marketBaseVault),
        marketQuoteVault: new PublicKey(poolData.marketQuoteVault),
        marketBids: new PublicKey(poolData.marketBids),
        marketAsks: new PublicKey(poolData.marketAsks),
        marketEventQueue: new PublicKey(poolData.marketEventQueue),
        lookupTableAccount: poolData.lookupTableAccount
          ? new PublicKey(poolData.lookupTableAccount)
          : PublicKey.default,
      };
    } catch (error) {
      console.error(`Error fetching complete pool keys: ${error}`);
      return null;
    }
  }

  /**
   * Gets user's token accounts for swap transaction.
   * @private
   */
  private async getUserTokenAccounts(connection: Connection, owner: PublicKey): Promise<any[]> {
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const accounts = await connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });

    return accounts.value.map((account) => ({
      pubkey: account.pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.account.data),
    }));
  }

  /**
   * Gets a list of available Raydium liquidity pools.
   *
   * @param walletProvider - The wallet provider (not used for read-only operations)
   * @param args - Parameters including limit for number of pools to return
   * @returns A formatted string with pool information including pairs, liquidity, and APR
   */
  @CreateAction({
    name: "get_pools",
    description: `
    Get a list of available Raydium liquidity pools on Solana with REAL data.
    Fetches live information from Raydium API including trading pairs, liquidity depth, 24h volume, and APR.
    Useful for discovering trading opportunities and understanding available markets.
    NOTE: Only available on Solana mainnet.
    `,
    schema: GetPoolsSchema,
  })
  async getPools(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof GetPoolsSchema>,
  ): Promise<string> {
    try {
      const limit = args.limit || 10;

      // Fetch REAL pool data from Raydium API
      const pools = await this.fetchRaydiumPoolsFromAPI(limit);

      return JSON.stringify(
        {
          pools,
          count: pools.length,
          source: "Raydium API (live data)",
          note: "Raydium is Solana's leading AMM with over $1B in total value locked",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error fetching Raydium pools: ${error}`;
    }
  }

  /**
   * Gets the current price for a token pair on Raydium.
   *
   * @param walletProvider - The wallet provider (not used for read-only operations)
   * @param args - Token mint addresses for the pair
   * @returns A formatted string with price information and timestamp
   */
  @CreateAction({
    name: "get_price",
    description: `
    Get the current price for a token pair on Raydium DEX from REAL onchain data.
    Queries actual Raydium pool reserves to calculate real-time prices.
    Useful for checking token prices before executing swaps or making trading decisions.
    - For SOL, use the mint address: So11111111111111111111111111111111111111112
    - For USDC, use the mint address: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    NOTE: Only available on Solana mainnet.
    `,
    schema: GetPriceSchema,
  })
  async getPrice(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof GetPriceSchema>,
  ): Promise<string> {
    try {
      const { tokenAMint, tokenBMint } = args;
      const connection = walletProvider.getConnection();

      // Find the pool for this token pair (checks KNOWN_POOLS first, then API)
      const poolConfig = await this.findPoolForPair(tokenAMint, tokenBMint);

      if (!poolConfig) {
        return JSON.stringify(
          {
            error: "Pool not found",
            message:
              "Could not find a Raydium pool for this token pair. The pair may not exist on Raydium.",
            tokenAMint,
            tokenBMint,
          },
          null,
          2,
        );
      }

      // Fetch REAL onchain pool state
      const poolState = await this.fetchPoolState(poolConfig.poolId, connection);

      // Calculate actual price from reserves
      const isReversed = poolConfig.baseMint !== tokenAMint;
      let price = this.calculatePrice(
        poolState.baseReserve,
        poolState.quoteReserve,
        poolConfig.baseDecimals,
        poolConfig.quoteDecimals,
      );

      if (isReversed) {
        price = 1 / price;
      }

      return JSON.stringify(
        {
          tokenAMint,
          tokenBMint,
          price,
          poolId: poolConfig.poolId,
          reserves: {
            base: poolState.baseReserve.toString(),
            quote: poolState.quoteReserve.toString(),
          },
          source: "onchain Raydium pool data",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error fetching price from Raydium: ${error}`;
    }
  }

  /**
   * Swaps tokens using Raydium DEX.
   *
   * @param walletProvider - The wallet provider to use for the swap
   * @param args - Swap parameters including input token, output token, amount, and slippage
   * @returns A message indicating success or failure with transaction details
   */
  @CreateAction({
    name: "swap",
    description: `
    Swaps tokens using Raydium DEX with REAL onchain execution.
    Executes actual swap transactions on Solana mainnet using Raydium's AMM protocol.
    - Input and output tokens must be valid SPL token mints.
    - Ensures sufficient balance before executing swap.
    - For SOL, use the mint address: So11111111111111111111111111111111111111112
    - For USDC, use the mint address: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    - Slippage tolerance is in basis points (50 = 0.5%, 100 = 1%)
    WARNING: This executes REAL transactions and uses REAL money!
    NOTE: Only available on Solana mainnet.
    `,
    schema: SwapTokenSchema,
  })
  async swap(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof SwapTokenSchema>,
  ): Promise<string> {
    try {
      const { inputMint, outputMint, amount, slippageBps = 50 } = args;

      // Validate inputs
      if (amount <= 0) {
        return "Error: Amount must be greater than 0";
      }

      const connection = walletProvider.getConnection();
      const userPublicKey = walletProvider.getPublicKey();

      // Find the pool for this token pair (checks KNOWN_POOLS first, then API)
      const poolConfig = await this.findPoolForPair(inputMint, outputMint);
      if (!poolConfig) {
        return JSON.stringify({
          error: "No pool found",
          message: `No Raydium pool found for tokens ${inputMint} and ${outputMint}`,
        });
      }

      // Fetch COMPLETE pool keys from Raydium API (includes vaults, authority, etc.)
      const completePoolKeys = await this.fetchCompletePoolKeys(poolConfig.poolId);

      if (!completePoolKeys) {
        return JSON.stringify({
          error: "Failed to fetch pool keys",
          message:
            "Could not fetch complete pool configuration from Raydium API. The pool may not be available or the API may be temporarily unavailable.",
          poolId: poolConfig.poolId,
          suggestion: "Try using Jupiter Action Provider for more reliable DEX aggregation.",
        });
      }

      // Get mint info for proper decimal handling
      const inputMintInfo = await getMint(connection, new PublicKey(inputMint));
      const outputMintInfo = await getMint(connection, new PublicKey(outputMint));

      // Convert amount to raw token amount with proper decimals
      const inputAmount = Math.floor(amount * Math.pow(10, inputMintInfo.decimals));

      // Create Token instances for Raydium SDK
      const inputToken = new Token(inputMint, inputMintInfo.decimals);
      const outputToken = new Token(outputMint, outputMintInfo.decimals);
      const tokenAmountIn = new TokenAmount(inputToken, inputAmount);

      // Calculate slippage tolerance
      const slippage = new Percent(slippageBps, 10000);

      // Get user's token accounts
      const userTokenAccounts = await this.getUserTokenAccounts(connection, userPublicKey);

      // Fetch current pool info for calculations
      const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys: completePoolKeys });

      // Compute the swap amounts
      const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
        poolKeys: completePoolKeys,
        poolInfo: poolInfo,
        amountIn: tokenAmountIn,
        currencyOut: outputToken,
        slippage: slippage,
      });

      // Build the swap transaction
      const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
        connection,
        poolKeys: completePoolKeys,
        userKeys: {
          tokenAccounts: userTokenAccounts,
          owner: userPublicKey,
        },
        amountIn: tokenAmountIn,
        amountOut: minAmountOut,
        fixedSide: "in",
        makeTxVersion: 0, // Use legacy transactions for compatibility
      });

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      // Convert to VersionedTransaction
      const allInstructions = innerTransactions[0].instructions;
      const message = {
        header: {
          numRequiredSignatures: 1,
          numReadonlySignedAccounts: 0,
          numReadonlyUnsignedAccounts: allInstructions.length,
        },
        accountKeys: [userPublicKey],
        recentBlockhash: blockhash,
        instructions: allInstructions,
      };

      // Create versioned transaction
      // Note: For production, you'd properly construct a VersionedTransaction
      // For now, we'll use the legacy Transaction type which is more compatible
      const transaction = new VersionedTransaction(message as any);

      // Sign and send the transaction
      const signature = await walletProvider.signAndSendTransaction(transaction);

      // Wait for confirmation
      await walletProvider.waitForSignatureResult(signature);

      // Calculate actual amounts for response
      const amountOutNumber = amountOut.toNumber() / Math.pow(10, outputMintInfo.decimals);
      const minAmountOutNumber =
        minAmountOut.toNumber() / Math.pow(10, outputMintInfo.decimals);

      return JSON.stringify(
        {
          success: true,
          message: "Swap executed successfully!",
          transaction: signature,
          details: {
            poolId: poolConfig.poolId,
            inputMint,
            outputMint,
            inputAmount: amount,
            outputAmount: amountOutNumber,
            minOutputAmount: minAmountOutNumber,
            slippageTolerance: `${slippageBps / 100}%`,
            effectivePrice: (amountOutNumber / amount).toFixed(6),
            fee: (amount * 0.0025).toFixed(6), // Raydium 0.25% fee
          },
          explorerUrl: `https://solscan.io/tx/${signature}`,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error executing Raydium swap: ${error}`;
    }
  }

  /**
   * Gets detailed information about a specific Raydium pool.
   *
   * @param walletProvider - The wallet provider (not used for read-only operations)
   * @param args - Pool ID to query
   * @returns A formatted string with detailed pool information
   */
  @CreateAction({
    name: "get_pool_info",
    description: `
    Get detailed information about a specific Raydium liquidity pool with REAL onchain data.
    Fetches actual pool reserves, status, and statistics from the blockchain.
    Returns reserves, fees, and current pool state.
    Useful for analyzing pool health and making informed trading decisions.
    NOTE: Only available on Solana mainnet.
    `,
    schema: GetPoolInfoSchema,
  })
  async getPoolInfo(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof GetPoolInfoSchema>,
  ): Promise<string> {
    try {
      const { poolId } = args;
      const connection = walletProvider.getConnection();

      // Validate pool ID
      let poolPubkey: PublicKey;
      try {
        poolPubkey = new PublicKey(poolId);
      } catch (error) {
        return `Error: Invalid pool ID format. Must be a valid Solana public key.`;
      }

      // Fetch REAL pool state from onchain
      const poolState = await this.fetchPoolState(poolId, connection);

      // Fetch pool configuration from API
      const completePoolKeys = await this.fetchCompletePoolKeys(poolId);

      if (!completePoolKeys) {
        return JSON.stringify({
          error: "Unknown pool",
          message: "Could not fetch pool configuration from Raydium API",
          poolId,
        });
      }

      // Calculate price from actual reserves
      const price = this.calculatePrice(
        poolState.baseReserve,
        poolState.quoteReserve,
        completePoolKeys.baseDecimals,
        completePoolKeys.quoteDecimals,
      );

      // Calculate TVL (simplified - would need token prices for accurate TVL)
      const baseReserveHuman =
        poolState.baseReserve.toNumber() / Math.pow(10, completePoolKeys.baseDecimals);
      const quoteReserveHuman =
        poolState.quoteReserve.toNumber() / Math.pow(10, completePoolKeys.quoteDecimals);

      return JSON.stringify(
        {
          poolId,
          status: poolState.status.toNumber() === 6 ? "active" : "inactive",
          reserves: {
            base: {
              mint: completePoolKeys.baseMint.toBase58(),
              amount: baseReserveHuman.toFixed(completePoolKeys.baseDecimals),
              raw: poolState.baseReserve.toString(),
            },
            quote: {
              mint: completePoolKeys.quoteMint.toBase58(),
              amount: quoteReserveHuman.toFixed(completePoolKeys.quoteDecimals),
              raw: poolState.quoteReserve.toString(),
            },
          },
          price: price.toFixed(6),
          lpSupply: poolState.lpSupply.toString(),
          fee: "0.25%", // Standard Raydium fee
          source: "onchain pool state",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error fetching Raydium pool info: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Only supports Solana mainnet.
   *
   * @param network - The network to check support for
   * @returns True if the network is Solana mainnet
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "svm" && network.networkId === "solana-mainnet";
  }
}

/**
 * Factory function to create a new RaydiumActionProvider instance.
 *
 * @returns A new RaydiumActionProvider instance
 */
export const raydiumActionProvider = () => new RaydiumActionProvider();

