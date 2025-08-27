import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { GetTruthMarketsSchema, GetTruthMarketDetailsSchema } from "./schemas";
import {
  TruthMarketABI,
  TruthMarketManagerABI,
  TruthMarketManager_ADDRESS,
  USDC_ADDRESS,
  TYD_ADDRESS,
  USDC_DECIMALS,
  TYD_DECIMALS,
  UniswapV3PoolABI,
  YESNO_DECIMALS,
} from "./constants";
import { abi as ERC20ABI } from "../erc20/constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { Hex, formatUnits } from "viem";
import { TruthMarket, Slot0Result } from "./utils";

/**
 * Action provider for TrueMarkets interactions.
 */
export class TrueMarketsActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Creates a new TrueMarkets action provider.
   */
  constructor() {
    super("truemarkets", []);
  }

  /**
   * Gets active markets from the TruthMarketManager contract.
   *
   * @param walletProvider - The wallet provider to use for contract interactions.
   * @param args - The input arguments for the action, including pagination and sorting options.
   * @returns JSON object containing the active markets information.
   */
  @CreateAction({
    name: "get_prediction_markets",
    description: `
    This tool will retrieve prediction markets from the Truemarkets platform.
    It returns a list of markets with their ID, contract address and market question.
    You can paginate results using limit and offset parameters, and sort them in ascending or descending order.
    Market IDs are sorted by their creation date, with the oldest market having ID 0.
    `,
    schema: GetTruthMarketsSchema,
  })
  async getPredictionMarkets(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTruthMarketsSchema>,
  ): Promise<string> {
    try {
      const limit = args.limit;
      const offset = args.offset;
      const sortOrder = args.sortOrder;

      // Get total number of markets
      const numMarkets = await walletProvider.readContract({
        address: TruthMarketManager_ADDRESS as Hex,
        abi: TruthMarketManagerABI,
        functionName: "numberOfActiveMarkets",
      });

      if (numMarkets === 0n) {
        return JSON.stringify({
          success: true,
          totalMarkets: 0,
          markets: [],
        });
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

      const marketAddresses = await walletProvider.getPublicClient().multicall({
        contracts: addressCalls,
      });

      // Filter out errors and extract results
      const validAddresses = marketAddresses
        .filter(result => result.status === "success")
        .map(result => result.result as unknown as Hex);

      if (validAddresses.length === 0) {
        return JSON.stringify({
          success: false,
          error: "Failed to retrieve market addresses",
        });
      }

      // Use multicall to fetch all market questions in a single call
      const questionCalls = validAddresses.map(address => ({
        address,
        abi: TruthMarketABI,
        functionName: "marketQuestion",
      }));

      const marketQuestionsResult = await walletProvider.getPublicClient().multicall({
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

      return JSON.stringify({
        success: true,
        totalMarkets,
        markets,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error retrieving active markets: ${error}`,
      });
    }
  }

  /**
   * Gets detailed information for a specific market address.
   *
   * @param walletProvider - The wallet provider to use for contract interactions.
   * @param args - The input arguments for the action, containing the market address.
   * @returns JSON object containing detailed market information.
   */
  @CreateAction({
    name: "get_market_details",
    description: `
    This tool will retrieve detailed information about a specific Truemarkets prediction market.
    It returns comprehensive data including market question, status, liquidity pool information, 
    prices for YES/NO tokens and Total Value Locked (TVL).
    The prices of the YES/NO token reflect the odds of the outcome.
    If the price of YES tokens is larger than of NO tokens, the market favors a YES outcome and vice versa.
    You can query using either:
    - marketAddress: The direct contract address of the market
    - id: The market ID (numeric identifier of the market)
    `,
    schema: GetTruthMarketDetailsSchema,
  })
  async getPredictionMarketDetails(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTruthMarketDetailsSchema>,
  ): Promise<string> {
    try {
      let marketAddress: Hex;

      // Check if input is an Ethereum address
      const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

      if (ethAddressRegex.test(args)) {
        marketAddress = args as Hex;
      } else {
        // Try to parse as market ID
        const marketId = parseInt(args, 10);
        if (isNaN(marketId) || marketId < 0) {
          return JSON.stringify({
            success: false,
            error: `Invalid input: "${args}". Must be either a valid Ethereum address (0x...) or a non-negative market ID number.`,
          });
        }

        try {
          marketAddress = (await walletProvider.getPublicClient().readContract({
            address: TruthMarketManager_ADDRESS as Hex,
            abi: TruthMarketManagerABI,
            functionName: "getActiveMarketAddress",
            args: [BigInt(marketId)],
          })) as Hex;
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: `Error retrieving market address for ID ${marketId}: ${error}`,
          });
        }
      }

      // Get basic market info using multicall
      const basicInfoCalls = [
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "marketQuestion",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "additionalInfo",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "marketSource",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "getCurrentStatus",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "endOfTrading",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "getPoolAddresses",
        },
        {
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: "winningPosition",
        },
      ];

      const basicInfoResults = await walletProvider.getPublicClient().multicall({
        contracts: basicInfoCalls,
      });

      // Extract results, handling potential errors
      if (basicInfoResults.some(result => result.status === "failure")) {
        return JSON.stringify({
          success: false,
          error: "Error retrieving basic market information",
        });
      }

      const question = basicInfoResults[0].result as string;
      const additionalInfo = basicInfoResults[1].result as string;
      const source = basicInfoResults[2].result as string;
      const statusNum = basicInfoResults[3].result as bigint;
      const endOfTrading = basicInfoResults[4].result as bigint;
      const pools = basicInfoResults[5].result as [Hex, Hex];
      const marketWinningPosition = Number(basicInfoResults[6].result as bigint);

      // Get pool addresses
      const [yesPool, noPool] = pools;

      // Get pool token information using multicall
      const poolInfoCalls = [
        {
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "token0",
        },
        {
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "token1",
        },
        {
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "token0",
        },
        {
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "token1",
        },
        {
          address: yesPool,
          abi: UniswapV3PoolABI,
          functionName: "slot0",
        },
        {
          address: noPool,
          abi: UniswapV3PoolABI,
          functionName: "slot0",
        },
      ];

      const poolInfoResults = await walletProvider.getPublicClient().multicall({
        contracts: poolInfoCalls,
      });

      if (poolInfoResults.some(result => result.status === "failure")) {
        return JSON.stringify({
          success: false,
          error: "Error retrieving pool information",
        });
      }

      const yesToken0 = poolInfoResults[0].result as Hex;
      const yesToken1 = poolInfoResults[1].result as Hex;
      const noToken0 = poolInfoResults[2].result as Hex;
      const noToken1 = poolInfoResults[3].result as Hex;
      const yesSlot0 = poolInfoResults[4].result as Slot0Result;
      const noSlot0 = poolInfoResults[5].result as Slot0Result;

      // Determine payment token (USDC or TYD) - should be the same for both pools
      const payToken =
        yesToken0 === USDC_ADDRESS || yesToken0 === TYD_ADDRESS ? yesToken0 : yesToken1;

      // Determine which token is the YES/NO token in each pool
      const yesToken = yesToken0 === payToken ? yesToken1 : yesToken0;
      const noToken = noToken0 === payToken ? noToken1 : noToken0;
      const isYesToken0 = yesToken0 === yesToken;
      const isNoToken0 = noToken0 === noToken;

      // Extract sqrtPriceX96 from slot0 results
      const yesSqrtPriceX96 = yesSlot0[0];
      const noSqrtPriceX96 = noSlot0[0];

      // Get pool balances using multicall
      const balanceCalls = [
        {
          address: payToken,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [yesPool],
        },
        {
          address: yesToken,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [yesPool],
        },
        {
          address: payToken,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [noPool],
        },
        {
          address: noToken,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [noPool],
        },
      ];

      const balanceResults = await walletProvider.getPublicClient().multicall({
        contracts: balanceCalls,
      });

      if (balanceResults.some(result => result.status === "failure")) {
        return JSON.stringify({
          success: false,
          error: "Error retrieving token balances",
        });
      }

      const yesPoolStableBalance = balanceResults[0].result as bigint;
      const yesPoolTokenBalance = balanceResults[1].result as bigint;
      const noPoolStableBalance = balanceResults[2].result as bigint;
      const noPoolTokenBalance = balanceResults[3].result as bigint;

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
      const payDecimals = payToken === USDC_ADDRESS ? Number(USDC_DECIMALS) : Number(TYD_DECIMALS);
      const yesNoTokenDecimals_ = Number(YESNO_DECIMALS);

      const yesPrice = calculatePrice(
        yesSqrtPriceX96,
        isYesToken0,
        payDecimals,
        yesNoTokenDecimals_,
      );
      const noPrice = calculatePrice(noSqrtPriceX96, isNoToken0, payDecimals, yesNoTokenDecimals_);

      // Calculate TVL using token balances
      const yesPoolStableValue = Number(formatUnits(yesPoolStableBalance || 0n, payDecimals));
      const yesPoolTokenValue =
        Number(formatUnits(yesPoolTokenBalance || 0n, yesNoTokenDecimals_)) * yesPrice;
      const noPoolStableValue = Number(formatUnits(noPoolStableBalance || 0n, payDecimals));
      const noPoolTokenValue =
        Number(formatUnits(noPoolTokenBalance || 0n, yesNoTokenDecimals_)) * noPrice;

      const yesTVL = yesPoolStableValue + yesPoolTokenValue;
      const noTVL = noPoolStableValue + noPoolTokenValue;
      const totalTVL = yesTVL + noTVL;

      // Map winning position to string
      let winningPositionString = "Open";
      switch (marketWinningPosition) {
        case 1:
          winningPositionString = "Yes";
          break;
        case 2:
          winningPositionString = "No";
          break;
        case 3:
          winningPositionString = "Canceled";
          break;
        default:
          winningPositionString = "Open";
      }

      return JSON.stringify({
        success: true,
        marketAddress,
        question,
        additionalInfo,
        source,
        status: Number(statusNum),
        resolutionTime: Number(endOfTrading),
        prices: {
          yes: parseFloat(yesPrice.toFixed(6)),
          no: parseFloat(noPrice.toFixed(6)),
        },
        tokens: {
          yes: {
            tokenAddress: yesToken,
            lpAddress: yesPool,
            poolSize: parseFloat(yesTVL.toFixed(2)),
          },
          no: {
            tokenAddress: noToken,
            lpAddress: noPool,
            poolSize: parseFloat(noTVL.toFixed(2)),
          },
          payToken: {
            tokenAddress: payToken,
            tokenName: payToken === USDC_ADDRESS ? "USDC" : "TYD",
          },
        },
        tvl: parseFloat(totalTVL.toFixed(2)),
        winningPosition: marketWinningPosition,
        winningPositionString,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error retrieving market details: ${error}`,
      });
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

export const truemarketsActionProvider = () => new TrueMarketsActionProvider();
