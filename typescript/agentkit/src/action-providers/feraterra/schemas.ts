import { z } from "zod";

/**
 * Input schema for listing active FeraTerra markets.
 */
export const GetMarketsSchema = z
  .object({
    kind: z
      .string()
      .nullable()
      .describe("Optional market kind filter ('spot', 'perp', 'spread_book', 'bounded_claim')"),
    symbol: z
      .string()
      .nullable()
      .describe("Optional case-insensitive symbol substring filter (e.g. 'BTC', 'ETH-USD-PERP')"),
  })
  .strict()
  .describe("Parameters for listing active markets and risk specifications on FeraTerra");

/**
 * Input schema for fetching an L2 orderbook snapshot on FeraTerra.
 */
export const GetOrderbookSchema = z
  .object({
    marketId: z
      .number()
      .int()
      .positive()
      .describe("Numeric market ID to fetch the orderbook for (e.g. 1 for BTC-USD-SPOT)"),
    depth: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .describe("Optional number of L2 price levels per side to return (1-100, defaults to 20)"),
  })
  .strict()
  .describe("Parameters for fetching an aggregated L2 orderbook snapshot on FeraTerra");

/**
 * Input schema for fetching the public Gladiator leaderboard on FeraTerra.
 */
export const GetLeaderboardSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .describe("Optional maximum number of ranked traders to return (1-100, defaults to 20)"),
    sort: z
      .enum(["equity", "pnl", "streak", "volume", "roi"])
      .nullable()
      .describe("Optional ranking metric ('equity', 'pnl', 'streak', 'volume', 'roi')"),
  })
  .strict()
  .describe("Parameters for querying the public Gladiator leaderboard on FeraTerra");

/**
 * Input schema for previewing an order or simulating BBO/sweep execution on FeraTerra.
 */
export const PreviewOrderSchema = z
  .object({
    marketId: z
      .number()
      .int()
      .positive()
      .describe("Numeric market ID to preview the order on (e.g. 1 for BTC-USD-SPOT)"),
    side: z
      .enum(["bid", "ask", "buy", "sell"])
      .describe("Order direction ('bid' or 'buy' for buy, 'ask' or 'sell' for sell)"),
    qtyLots: z
      .number()
      .int()
      .positive()
      .describe("Order size in fixed-point lots (1 lot = 0.0001 base units)"),
    priceTicks: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Limit price in fixed-point ticks (1 tick = $0.01 USD). Null when isMarket=true."),
    tif: z
      .enum(["gtc", "ioc", "fok", "post_only"])
      .nullable()
      .describe("Optional time-in-force policy ('gtc', 'ioc', 'fok', 'post_only'; default 'gtc')"),
    isMarket: z
      .boolean()
      .nullable()
      .describe("Optional flag to preview a market order sweep (defaults to false)"),
    reduceOnly: z
      .boolean()
      .nullable()
      .describe("Optional flag marking the previewed order as reduce-only (defaults to false)"),
    accountId: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Optional trader account ID when authenticated API credentials are configured"),
  })
  .strict()
  .describe("Parameters for running a stateless zero-mutation order preview on FeraTerra");

/**
 * Input schema for requesting Base Sepolia testnet collateral from the FeraTerra faucet.
 */
export const RequestTestnetFaucetSchema = z
  .object({
    asset: z
      .enum(["USD", "BTC", "ETH", "SOL"])
      .nullable()
      .describe("Optional testnet collateral asset symbol ('USD', 'BTC', 'ETH', 'SOL')"),
    amount: z
      .string()
      .nullable()
      .describe("Optional human-readable token amount to mint (defaults to '10000')"),
    dripGas: z
      .boolean()
      .nullable()
      .describe("Optional flag to include a Base Sepolia ETH gas drip (defaults to true)"),
    recipient: z
      .string()
      .nullable()
      .describe("Optional recipient EVM address; defaults to the connected wallet address"),
  })
  .strict()
  .describe("Parameters for requesting Base Sepolia testnet collateral from the FeraTerra faucet");
