import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { GetActiveTruthMarketsSchema, GetMarketDetailsSchema } from "./schemas";
import {
  TruthMarketABI,
  TruthMarketManagerABI,
  TruthMarketManager_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  UniswapV3PoolABI,
  YESNO_DECIMALS,
} from "./constants";
import { abi as ERC20ABI } from "../erc20/constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { Hex, formatUnits, createPublicClient, http, PublicClient } from "viem";
import { GetMarketStatus } from "./utils";
import { base } from "viem/chains";
/**
 * Interface representing a TruthMarket
 */
interface TruthMarket {
  id: number;
  address: string;
  marketQuestion: string;
}

/**
 * Configuration options for the TrueMarketsActionProvider.
 */
export interface TrueMarketsActionProviderConfig {
  /**
   * RPC URL for creating the Viem public client
   */
  RPC_URL?: string;
}

/**
 * TrueMarketsActionProvider provides actions to interact with TrueMarkets contracts.
 */
export class TrueMarketsActionProvider extends ActionProvider<EvmWalletProvider> {
  #publicClient: PublicClient;

  /**
   * Constructor for the TrueMarketsActionProvider.
   *
   * @param config - The configuration options for the TrueMarketsActionProvider.
   */
  constructor(config?: TrueMarketsActionProviderConfig) {
    super("truemarkets", []);
    this.#publicClient = createPublicClient({
      chain: base,
      transport: config?.RPC_URL ? http(config.RPC_URL) : http(),
    }) as PublicClient;
  }

  /**
   * Gets active markets from the TruthMarketManager contract.
   *
   * @param walletProvider - The wallet provider to use for contract interactions.
   * @param args - The input arguments for the action, including pagination and sorting options.
   * @returns A message containing the active markets information.
   */
  @CreateAction({
    name: "get_active_markets",
    description: `
    This tool will retrieve active markets from the Truemarkets platform.
    It returns a list of markets with their ID, contract address and market question.
    You can paginate results using limit and offset parameters, and sort them in ascending or descending order.
    Market IDs are sorted by their creation date, with the oldest market having ID 0.
    `,
    schema: GetActiveTruthMarketsSchema,
  })
  async getActiveMarkets(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetActiveTruthMarketsSchema>,
  ): Promise<string> {
    try {
      const limit = args.limit;
      const offset = args.offset;
      const sortOrder = args.sortOrder;

      // Get total number of active markets
      const numMarkets = await walletProvider.readContract({
        address: TruthMarketManager_ADDRESS as Hex,
        abi: TruthMarketManagerABI,
        functionName: "numberOfActiveMarkets",
      });

      if (numMarkets === 0n) {
        return "No active markets found.";
      }

      const totalMarkets = Number(numMarkets);
      const adjustedOffset = Math.min(offset, totalMarkets - 1);
      const adjustedLimit = Math.min(limit, totalMarkets - adjustedOffset);

      // Create an array of indices to fetch based on sort order
      const indices: number[] = [];
      if (sortOrder === "desc") {
        // For descending order, start from the end
        for (
          let i = totalMarkets - 1 - adjustedOffset;
          i >= Math.max(0, totalMarkets - adjustedOffset - adjustedLimit);
          i--
        ) {
          indices.push(i);
        }
      } else {
        // For ascending order, start from the beginning
        for (let i = adjustedOffset; i < adjustedOffset + adjustedLimit; i++) {
          indices.push(i);
        }
      }

      // Use multicall to fetch all market addresses in a single call
      const addressCalls = indices.map(index => ({
        address: TruthMarketManager_ADDRESS as Hex,
        abi: TruthMarketManagerABI,
        functionName: "getActiveMarketAddress",
        args: [BigInt(index)],
      }));

      const marketAddresses = await this.#publicClient.multicall({
        contracts: addressCalls,
      });

      // Filter out errors and extract results
      const validAddresses = marketAddresses
        .filter(result => result.status === "success")
        .map(result => result.result as unknown as Hex);

      if (validAddresses.length === 0) {
        return "Failed to retrieve market addresses.";
      }

      // Use multicall to fetch all market questions in a single call
      const questionCalls = validAddresses.map(address => ({
        address,
        abi: TruthMarketABI,
        functionName: "marketQuestion",
      }));

      const marketQuestionsResult = await this.#publicClient.multicall({
        contracts: questionCalls,
      });

      // Create market objects mapping indices to addresses and questions
      const markets: TruthMarket[] = indices
        .filter((_, idx) => idx < validAddresses.length)
        .map((id, idx) => ({
          id,
          address: validAddresses[idx],
          marketQuestion:
            marketQuestionsResult[idx].status === "success"
              ? (marketQuestionsResult[idx].result as string)
              : "Failed to retrieve question",
        }));

      // Format the results
      let result = `Found ${markets.length} active markets (out of ${totalMarkets} total):\n\n`;

      markets.forEach(market => {
        result += `Market #${market.id} (${market.address}): ${market.marketQuestion}\n`;
      });

      return result;
    } catch (error) {
      return `Error retrieving active markets: ${error}`;
    }
  }

  /**
   * Gets detailed information for a specific market address.
   *
   * @param walletProvider - The wallet provider to use for contract interactions.
   * @param args - The input arguments for the action, containing the market address.
   * @returns A message containing detailed market information.
   */
  @CreateAction({
    name: "get_market_details",
    description: `
    This tool will retrieve detailed information about a specific Truemarkets market.
    It returns comprehensive data including market question, status, pool information, liquidity, 
    prices for YES/NO tokens, and Total Value Locked (TVL).
    If the price of YES tokens is larger than of NO tokens, the market favors a YES outcome and vice versa.
    `,
    schema: GetMarketDetailsSchema,
  })
  async getMarketDetails(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetMarketDetailsSchema>,
  ): Promise<string> {
    try {
      const marketAddress = args.marketAddress as Hex;

      // Get basic market info
      const [question, additionalInfo, source, statusNum, endOfTrading, pools] = await Promise.all([
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "marketQuestion",
        }),
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "additionalInfo",
        }),
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "marketSource",
        }),
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "getCurrentStatus",
        }),
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "endOfTrading",
        }),
        walletProvider.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "getPoolAddresses",
        }),
      ]);

      // Get pool addresses
      const [yesPool, noPool] = pools as [Hex, Hex];

      // Get pool token information
      const [yesToken0, yesToken1, noToken0, noToken1] = await Promise.all([
        walletProvider.readContract({
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "token0",
        }),
        walletProvider.readContract({
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "token1",
        }),
        walletProvider.readContract({
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "token0",
        }),
        walletProvider.readContract({
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "token1",
        }),
      ]);

      // Determine which token is the YES/NO token and which is USDC in each pool
      const yesToken = yesToken0 === USDC_ADDRESS ? yesToken1 : yesToken0;
      const noToken = noToken0 === USDC_ADDRESS ? noToken1 : noToken0;
      const isYesToken0 = yesToken0 === yesToken;
      const isNoToken0 = noToken0 === noToken;

      // Get pool balances
      const [yesPoolUsdcBalance, yesPoolTokenBalance, noPoolUsdcBalance, noPoolTokenBalance] =
        await Promise.all([
          walletProvider.readContract({
            address: USDC_ADDRESS,
            abi: ERC20ABI,
            functionName: "balanceOf",
            args: [yesPool],
          }),
          walletProvider.readContract({
            address: yesToken,
            abi: ERC20ABI,
            functionName: "balanceOf",
            args: [yesPool],
          }),
          walletProvider.readContract({
            address: USDC_ADDRESS,
            abi: ERC20ABI,
            functionName: "balanceOf",
            args: [noPool],
          }),
          walletProvider.readContract({
            address: noToken,
            abi: ERC20ABI,
            functionName: "balanceOf",
            args: [noPool],
          }),
        ]);

      // Get liquidity and price data
      const [yesSlot0, noSlot0] = await Promise.all([
        walletProvider.readContract({
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "slot0",
        }),
        walletProvider.readContract({
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "slot0",
        }),
      ]);

      // Calculate prices from slot0 data
      const calculatePrice = (
        sqrtPriceX96: bigint,
        isTokenZero: boolean,
        usdcDecimals_: number,
        tokenDecimals_: number,
      ) => {
        const Q96 = 2n ** 96n;
        const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
        const price = sqrtPrice * sqrtPrice;

        // Decimal adjustment between USDC and YES/NO tokens
        const decimalAdjustment = 10 ** (Number(tokenDecimals_) - Number(usdcDecimals_));

        if (isTokenZero) {
          // If YES/NO token is token0, price = price * decimalAdjustment
          return price * decimalAdjustment;
        } else {
          // If YES/NO token is token1, price = 1/price * decimalAdjustment
          return (1 / price) * decimalAdjustment;
        }
      };

      // Calculate TVL based on token balances and prices
      const usdcDecimals_ = Number(USDC_DECIMALS);
      const yesNoTokenDecimals_ = Number(YESNO_DECIMALS);

      const yesSlot0Data = yesSlot0 as [bigint, number, number, number, number, number, boolean];
      const noSlot0Data = noSlot0 as [bigint, number, number, number, number, number, boolean];

      const yesPrice = calculatePrice(
        yesSlot0Data[0],
        isYesToken0,
        usdcDecimals_,
        yesNoTokenDecimals_,
      );
      const noPrice = calculatePrice(
        noSlot0Data[0],
        isNoToken0,
        usdcDecimals_,
        yesNoTokenDecimals_,
      );

      // Calculate TVL using token balances
      const yesPoolUsdcValue = Number(
        formatUnits((yesPoolUsdcBalance as bigint) || 0n, usdcDecimals_),
      );
      const yesPoolTokenValue =
        Number(formatUnits((yesPoolTokenBalance as bigint) || 0n, yesNoTokenDecimals_)) * yesPrice;
      const noPoolUsdcValue = Number(
        formatUnits((noPoolUsdcBalance as bigint) || 0n, usdcDecimals_),
      );
      const noPoolTokenValue =
        Number(formatUnits((noPoolTokenBalance as bigint) || 0n, yesNoTokenDecimals_)) * noPrice;

      const yesTVL = yesPoolUsdcValue + yesPoolTokenValue;
      const noTVL = noPoolUsdcValue + noPoolTokenValue;
      const totalTVL = yesTVL + noTVL;

      // Format the status
      const status = GetMarketStatus[Number(statusNum)] || "Unknown";

      // Format the end of trading time
      const endOfTradingTime = new Date(Number(endOfTrading) * 1000).toISOString();

      // Build the response
      let result = `Market Details for ${marketAddress}:\n\n`;
      result += `Question: ${question}\n`;
      result += `Additional Info: ${additionalInfo}\n`;
      result += `Source: ${source}\n`;
      result += `Status: ${status}\n`;
      result += `Earliest possible resolution: ${endOfTradingTime}\n\n`;

      result += `YES: $${yesPrice.toFixed(2)}\n`;
      result += `NO: $${noPrice.toFixed(2)}\n\n`;
      result += `TVL: $${totalTVL.toFixed(2)}`;

      result += `Pool Addresses:\n`;
      result += `- YES Pool: ${yesPool} (Pool Size: $${yesTVL.toFixed(2)})\n`;
      result += `- NO Pool: ${noPool} (Pool Size: $${noTVL.toFixed(2)})\n\n`;

      return result;
    } catch (error) {
      return `Error retrieving market details: ${error}`;
    }
  }

  /**
   * Checks if the TrueMarkets action provider supports the given network.
   * Currently only supports Base mainnet.
   *
   * @param network - The network to check.
   * @returns True if the TrueMarkets action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.networkId === "base-mainnet";
}

export const truemarketsActionProvider = (config?: TrueMarketsActionProviderConfig) =>
  new TrueMarketsActionProvider(config);
