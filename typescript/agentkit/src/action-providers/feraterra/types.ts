/**
 * Configuration options for FeraterraActionProvider.
 */
export interface FeraterraActionProviderConfig {
  /**
   * Base HTTPS gateway URL (defaults to https://testnet.feraterra.app).
   */
  baseUrl?: string;

  /**
   * Optional API key for authenticated endpoints such as POST /order/preview.
   */
  apiKey?: string;

  /**
   * Optional API secret (hex/string) used for HMAC-SHA256 request signing.
   */
  apiSecret?: string;

  /**
   * Optional default numeric trader account ID for authenticated previews.
   */
  accountId?: number;
}

/**
 * Market specification returned by GET /markets.
 */
export interface FeraterraMarket {
  market_id: number;
  symbol: string;
  kind: string;
  trading_status: string;
  imr_bps?: number;
  mmr_bps?: number;
  maker_fee_bps?: number;
  taker_fee_bps?: number;
  mark_price_ticks?: number;
  last_trade_price_ticks?: number;
  best_bid_ticks?: number;
  best_bid_lots?: number;
  best_ask_ticks?: number;
  best_ask_lots?: number;
  open_interest_lots?: number;
  resting_orders?: number;
  total_trades?: number;
}

/**
 * Response payload from GET /markets.
 */
export interface FeraterraMarketsResponse {
  ok: boolean;
  wal_seq?: number;
  markets: FeraterraMarket[];
}

/**
 * Object representation of an L2 orderbook price level.
 */
export interface FeraterraBookLevelObject {
  price_ticks: number;
  qty_lots: number;
  order_count?: number;
}

/**
 * Raw L2 level tuple [price_ticks, qty_lots, order_count?] or object.
 */
export type FeraterraRawBookLevel = [number, number, number?] | FeraterraBookLevelObject;

/**
 * Normalized L2 orderbook level with fixed-point and human-readable units.
 */
export interface FeraterraNormalizedBookLevel {
  priceTicks: number;
  priceUsd: string;
  qtyLots: number;
  qtyUnits: string;
  orderCount: number;
}

/**
 * Response payload from GET /book.
 */
export interface FeraterraOrderbookResponse {
  ok: boolean;
  wal_seq?: number;
  market_id: number;
  symbol: string;
  kind: string;
  trading_status?: string;
  maker_fee_bps?: number;
  taker_fee_bps?: number;
  mark_price_ticks: number;
  best_bid_ticks: number;
  best_bid_lots: number;
  best_ask_ticks: number;
  best_ask_lots: number;
  bids: FeraterraRawBookLevel[];
  asks: FeraterraRawBookLevel[];
}

/**
 * Leaderboard entry returned by GET /leaderboard.
 */
export interface FeraterraLeaderboardEntry {
  rank: number;
  account_id: number;
  wallet_masked?: string;
  trader?: string;
  equity_micro?: number;
  equity_usd?: string;
  net_pnl_micro?: number;
  net_pnl_usd?: string;
  roi_bps?: number;
  bbo_uptime_multiplier?: string;
  total_volume_micro_128?: string;
  open_orders?: number;
  open_positions?: number;
}

/**
 * Response payload from GET /leaderboard.
 */
export interface FeraterraLeaderboardResponse {
  ok: boolean;
  wal_seq?: number;
  chain_id?: number;
  clearinghouse_address?: string;
  sort_by?: string;
  limit?: number;
  total_traders?: number;
  total_trades?: number;
  entries: FeraterraLeaderboardEntry[];
}

/**
 * Response payload from POST /order/preview.
 */
export interface FeraterraOrderPreviewResponse {
  ok: boolean;
  preview: boolean;
  stateless: boolean;
  would_accept: boolean;
  status: string;
  wal_seq: number;
  account_id?: number;
  market_id?: number;
  side?: string;
  tif?: string;
  effective_price_ticks: number;
  mark_price_ticks?: number;
  best_bid_ticks?: number;
  best_ask_ticks?: number;
  qty_lots?: number;
  estimated_filled_lots: number;
  estimated_resting_lots: number;
  estimated_avg_price_ticks?: number;
  estimated_notional_micro?: number;
  estimated_slippage_bps?: number;
  estimated_fee_micro?: number;
  post_imr_micro: number;
  post_free_margin_micro: number;
}

/**
 * Response payload from POST /faucet.
 */
export interface FeraterraFaucetResponse {
  ok?: boolean;
  error?: string;
  recipient?: string;
  asset?: string;
  amount?: string;
  chain_id?: number;
  tx_hash?: string;
  gas_tx_hash?: string;
  [key: string]: unknown;
}
